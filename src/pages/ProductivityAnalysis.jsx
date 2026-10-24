import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { PRODUCTIVITY_FACTORS } from '../productivityFactors';
import {
  calculateProductivityAnalysis,
  formatProductivityPercent,
  getDefaultPresetName,
  MAX_PRODUCTIVITY_WEEKS,
  parseProductivityPercent,
  setSelectedProductivityFactors,
} from '../productivityModel';
import {
  hasProductivityValuesAfter,
  hydrateProductivityDocument,
  resetProductivityMode,
  resizeProductivityDocument,
  serializeProductivityDocument,
  updateProductivityMode,
} from '../productivityDocument';
import './ProductivityUI.css';

const METHODS = ['proactive', 'retroactive'];
const ANALYSIS_PATHS = new Set(['/productivity-analysis', '/proactive', '/retroactive']);
const methodLabel = mode => mode === 'retroactive' ? 'Retroactive' : 'Proactive';
const numberText = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
const hoursFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const displayHours = value => Number.isFinite(value) ? hoursFormat.format(value) : '—';
const draftKey = (mode, kind, index, factorId = '') => `${mode}:${kind}:${factorId}:${index}`;
const emptySnapshot = () => ({ loaded: false, project: null, document: null, revision: null, legacyFingerprint: null, isLegacy: false });

function parseHours(raw) {
  const text = raw.trim();
  if (text === '') return 0;
  if (!numberText.test(text) || !Number.isFinite(Number(text))) throw new Error('Enter a complete, finite number of hours.');
  return Number(text);
}

async function responseData(response) {
  try { return await response.json(); } catch { throw new Error('The server returned an unreadable response. Please reload before saving.'); }
}

function loadFailure(status, data) {
  if (status === 401) return 'Your session has expired. Sign in again to load this project.';
  if (status === 403) return 'You do not have access to this project.';
  if (status === 404) return 'This project could not be found.';
  return typeof data?.error === 'string' ? data.error : 'The saved analysis could not be loaded. Your saved data has not been replaced.';
}

function validatedReply(data, projectId) {
  if (!data || !data.project || !data.document || !Number.isInteger(data.revision) || data.revision < 0) {
    throw new Error('The saved project response is incomplete. Reload the project before editing.');
  }
  const returnedId = data.project.id ?? data.project.project_id;
  if (returnedId === undefined || String(returnedId) !== projectId) throw new Error('The server returned a different project. Editing is blocked.');
  const document = hydrateProductivityDocument(data.document);
  if (Number(data.project.total_weeks) !== document.totalWeeks) throw new Error('The saved project duration does not match its weekly inputs.');
  if (typeof data.isLegacy !== 'boolean') throw new Error('The saved project format could not be verified.');
  if (data.isLegacy && (data.revision !== 0 || typeof data.legacyFingerprint !== 'string' || !data.legacyFingerprint)) {
    throw new Error('The original saved inputs could not be verified. Reload before editing.');
  }
  return { loaded: true, project: data.project, document, revision: data.revision, isLegacy: data.isLegacy, legacyFingerprint: data.isLegacy ? data.legacyFingerprint : null };
}

export default function ProductivityAnalysis() {
  const location = useLocation();
  const { user } = useAuth();
  const query = new URLSearchParams(location.search);
  const fallback = new URLSearchParams(window.location.search);
  const projectId = query.get('productivityLoss') || fallback.get('productivityLoss') || '';
  const requestedMode = query.get('mode') || fallback.get('mode');
  const mode = METHODS.includes(requestedMode) ? requestedMode : location.pathname === '/retroactive' ? 'retroactive' : 'proactive';
  const token = localStorage.getItem('token') || '';
  const identity = `${projectId}:${user?.id ?? user?.user_id ?? ''}:${token}`;
  return <ProductivityEditor key={identity} projectId={projectId} token={token} mode={mode} />;
}

function ProductivityEditor({ projectId, token, mode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const inputPrefix = useId();
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const snapshotRef = useRef(snapshot);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const saveController = useRef(null);
  const mounted = useRef(false);
  const [message, setMessage] = useState(null);
  const [drafts, setDrafts] = useState({});
  const draftsRef = useRef({});
  const [customCells, setCustomCells] = useState({});
  const [durationDraft, setDurationDraft] = useState('');
  const inputRefs = useRef({});
  const tabs = useRef({});
  const navigationWarning = useRef(null);
  const blocker = useBlocker(useCallback(({ currentLocation, nextLocation }) => {
    const nextId = new URLSearchParams(nextLocation.search).get('productivityLoss')
      || new URLSearchParams(window.location.search).get('productivityLoss') || '';
    const nextPath = nextLocation.pathname.replace(/\/+$/, '') || '/';
    const currentPath = currentLocation.pathname.replace(/\/+$/, '') || '/';
    // Switching methods is part of the same draft, rather than leaving it.
    if (ANALYSIS_PATHS.has(nextPath) && nextPath === currentPath && nextId === projectId) return false;
    return dirtyRef.current || saveLock.current;
  }, [projectId]));

  function replaceSnapshot(next) { snapshotRef.current = next; setSnapshot(next); }
  function replaceDrafts(next) { draftsRef.current = next; setDrafts(next); }
  function markDirty() {
    dirtyRef.current = true;
    setDirty(true);
    setMessage(previous => previous?.kind === 'conflict' ? previous : null);
  }

  useEffect(() => {
    mounted.current = true;
    const warnBeforeLeave = event => {
      if (!dirtyRef.current && !saveLock.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    const beforeSignout = event => {
      if (saveLock.current) {
        event.preventDefault();
        setMessage({ kind: 'info', text: 'Both methods are being saved. Please wait before signing out.' });
        return;
      }
      if (!dirtyRef.current) return;
      if (!window.confirm('Sign out and discard your unsaved changes in both methods?')) {
        event.preventDefault();
        return;
      }
      // App clears authentication only after this event is allowed to finish.
      // Approving here must not trigger a second router confirmation afterwards.
      dirtyRef.current = false;
      setDirty(false);
    };
    window.addEventListener('beforeunload', warnBeforeLeave);
    window.addEventListener('hcg-before-signout', beforeSignout);
    return () => {
      mounted.current = false;
      saveController.current?.abort();
      window.removeEventListener('beforeunload', warnBeforeLeave);
      window.removeEventListener('hcg-before-signout', beforeSignout);
    };
  }, []);

  useEffect(() => {
    if (blocker.state === 'blocked') navigationWarning.current?.focus();
  }, [blocker.state]);

  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      setMessage(null);
      replaceSnapshot(emptySnapshot());
      replaceDrafts({});
      setCustomCells({});
      dirtyRef.current = false;
      setDirty(false);
      try {
        if (!/^[1-9]\d*$/.test(projectId)) throw new Error('Choose a project from My projects before opening an analysis.');
        if (!token) throw new Error('Sign in again to load this project.');
        const response = await fetch(`/api/productivity-losses/${encodeURIComponent(projectId)}/v2`, {
          headers: { Authorization: `Bearer ${token}` }, signal: controller.signal,
        });
        const data = await responseData(response);
        if (!response.ok) throw new Error(loadFailure(response.status, data));
        const next = validatedReply(data, projectId);
        if (!current || controller.signal.aborted) return;
        replaceSnapshot(next);
        setDurationDraft(String(next.document.totalWeeks));
      } catch (error) {
        if (current && !controller.signal.aborted) setLoadError(error.message || 'The saved analysis could not be loaded.');
      } finally {
        if (current && !controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => { current = false; controller.abort(); };
  }, [projectId, token, attempt]);

  const document = snapshot.document;
  const analysis = document?.modes[mode];
  const invalidDrafts = Object.values(drafts).filter(entry => entry.error);
  const calculations = useMemo(() => {
    const result = { proactive: null, retroactive: null, errors: {} };
    if (!snapshot.document) return result;
    for (const method of METHODS) {
      if (Object.values(drafts).some(entry => entry.mode === method && entry.error)) {
        result.errors[method] = 'Complete the highlighted number before calculating.';
        continue;
      }
      try { result[method] = calculateProductivityAnalysis(snapshot.document.modes[method], method); }
      catch (error) { result.errors[method] = error.message; }
    }
    return result;
  }, [snapshot.document, drafts]);
  const currentResult = calculations[mode];
  const durationPending = Boolean(document && durationDraft !== String(document.totalWeeks));
  const disabled = !snapshot.loaded || loading || saving;
  const selectedFactors = analysis?.selectedFactorIds.map(id => PRODUCTIVITY_FACTORS.find(factor => factor.id === id)) ?? [];
  const weeks = Array.from({ length: document?.totalWeeks ?? 0 }, (_, index) => index);

  function updatedDocument(next) {
    replaceSnapshot({ ...snapshotRef.current, document: next });
    markDirty();
  }

  function onInput(kind, index, raw, factorId = '') {
    if (saveLock.current || !snapshotRef.current.loaded) return;
    const current = snapshotRef.current.document;
    const methods = current.inputMode === 'shared' ? METHODS : [mode];
    let value;
    let error = '';
    try { value = kind === 'factor' ? parseProductivityPercent(raw) : parseHours(raw); }
    catch (problem) { error = problem.message; }
    const nextDrafts = { ...draftsRef.current };
    for (const method of methods) nextDrafts[draftKey(method, kind, index, factorId)] = { mode: method, kind, index, factorId, raw, error };
    replaceDrafts(nextDrafts);
    if (!error) {
      const active = current.modes[mode];
      const next = kind === 'factor'
        ? { ...active, factors: { ...active.factors, [factorId]: active.factors[factorId].map((old, week) => week === index ? value : old) } }
        : { ...active, [kind]: active[kind].map((old, week) => week === index ? value : old) };
      updatedDocument(updateProductivityMode(current, mode, next));
    } else markDirty();
  }

  function onPreset(factor, index, choice) {
    if (saveLock.current || !snapshotRef.current.loaded) return;
    const current = snapshotRef.current.document;
    const methods = current.inputMode === 'shared' ? METHODS : [mode];
    setCustomCells(previous => {
      const next = { ...previous };
      for (const method of methods) next[draftKey(method, 'factor', index, factor.id)] = choice === 'custom';
      return next;
    });
    if (choice === 'custom') { markDirty(); return; }
    if (!['none', 'minor', 'moderate', 'severe'].includes(choice)) return;
    const value = choice === 'none' ? 0 : factor[choice];
    const active = current.modes[mode];
    const next = { ...active, factors: { ...active.factors, [factor.id]: active.factors[factor.id].map((old, week) => week === index ? value : old) } };
    const nextDrafts = { ...draftsRef.current };
    for (const method of methods) delete nextDrafts[draftKey(method, 'factor', index, factor.id)];
    replaceDrafts(nextDrafts);
    updatedDocument(updateProductivityMode(current, mode, next));
  }

  function toggleFactor(factorId, checked) {
    if (saveLock.current || !snapshotRef.current.loaded) return;
    const current = snapshotRef.current.document;
    const affected = current.inputMode === 'shared' ? METHODS : [mode];
    if (!checked && Object.values(draftsRef.current).some(entry => affected.includes(entry.mode) && entry.factorId === factorId && entry.error)) {
      setMessage({ kind: 'error', text: 'Complete this factor’s highlighted value before removing it from the table.' });
      return;
    }
    const active = current.modes[mode];
    const selected = checked ? [...active.selectedFactorIds, factorId] : active.selectedFactorIds.filter(id => id !== factorId);
    updatedDocument(updateProductivityMode(current, mode, setSelectedProductivityFactors(active, selected)));
  }

  function chooseMode(nextMode) {
    if (saveLock.current) return;
    navigate({ pathname: location.pathname, search: `?${new URLSearchParams({ productivityLoss: projectId, mode: nextMode })}` }, { replace: true });
  }

  function goToProjects() {
    if (saveLock.current) return;
    navigate('/productivity-losses');
  }

  function leaveBlockedPage() {
    if (saveLock.current || blocker.state !== 'blocked') return;
    dirtyRef.current = false;
    setDirty(false);
    blocker.proceed();
  }

  function reloadLatest() {
    if (saveLock.current) return;
    if (dirtyRef.current && !window.confirm('Reload the latest saved analysis and discard your unsaved changes?')) return;
    replaceSnapshot({ ...snapshotRef.current, loaded: false });
    setLoading(true);
    setLoadError('');
    setAttempt(value => value + 1);
  }

  function resetCurrent() {
    if (saveLock.current || !snapshotRef.current.loaded) return;
    const current = snapshotRef.current.document;
    const shared = current.inputMode === 'shared';
    if (!window.confirm(shared ? 'Clear the shared inputs for both methods? Save afterwards to keep the reset.' : `Clear the ${methodLabel(mode)} inputs? Save afterwards to keep the reset.`)) return;
    const affected = shared ? METHODS : [mode];
    replaceDrafts(Object.fromEntries(Object.entries(draftsRef.current).filter(([, entry]) => !affected.includes(entry.mode))));
    setCustomCells(previous => Object.fromEntries(Object.entries(previous).filter(([key]) => !affected.some(method => key.startsWith(`${method}:`)))));
    updatedDocument(resetProductivityMode(current, mode));
  }

  function applyDuration() {
    if (saveLock.current || !snapshotRef.current.loaded) return;
    const current = snapshotRef.current.document;
    try {
      const text = durationDraft.trim();
      const count = Number(text);
      if (!/^\d+$/.test(text) || !Number.isInteger(count) || count < 1 || count > MAX_PRODUCTIVITY_WEEKS) throw new Error(`Enter a whole number from 1 to ${MAX_PRODUCTIVITY_WEEKS} weeks.`);
      if (Object.values(draftsRef.current).some(entry => entry.error)) throw new Error('Complete the highlighted values in both methods before changing the week count.');
      if (count < current.totalWeeks && hasProductivityValuesAfter(current, count)) throw new Error('Later weeks still contain hours or factor values in one of the methods, including hidden factors. Clear those values before shortening the project.');
      const resized = resizeProductivityDocument(current, count);
      replaceDrafts(Object.fromEntries(Object.entries(draftsRef.current).filter(([, entry]) => entry.index < count)));
      setCustomCells({});
      setDurationDraft(String(count));
      updatedDocument(resized);
    } catch (error) { setMessage({ kind: 'error', text: error.message }); }
  }

  async function save() {
    if (saveLock.current || !snapshotRef.current.loaded) return;
    const current = snapshotRef.current;
    try {
      const invalid = Object.entries(draftsRef.current).find(([, entry]) => entry.error);
      if (invalid) {
        const [key, entry] = invalid;
        inputRefs.current[key]?.focus();
        throw new Error(`${methodLabel(entry.mode)} has an incomplete number. Complete the highlighted value before saving.`);
      }
      if (durationDraft !== String(current.document.totalWeeks)) throw new Error('Apply the project week count before saving.');
      const serialized = serializeProductivityDocument(current.document);
      saveLock.current = true;
      setSaving(true);
      setMessage(null);
      const controller = new AbortController();
      saveController.current = controller;
      const response = await fetch(`/api/productivity-losses/${encodeURIComponent(projectId)}/v2`, {
        method: 'PUT', signal: controller.signal,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ expectedRevision: current.revision, expectedLegacyFingerprint: current.legacyFingerprint, document: serialized }),
      });
      const data = await responseData(response);
      if (!mounted.current || controller.signal.aborted) return;
      if (response.status === 409) {
        setMessage({ kind: 'conflict', text: 'This project was changed in another tab or session. Your edits are still here. Reload the latest saved version before saving again.' });
        return;
      }
      if (!response.ok) throw new Error(loadFailure(response.status, data));
      if (!Number.isInteger(data.revision) || data.revision <= current.revision || !data.document) throw new Error('The save response could not be verified. Reload the latest version before saving again.');
      const returned = serializeProductivityDocument(hydrateProductivityDocument(data.document));
      if (JSON.stringify(returned) !== JSON.stringify(serialized)) throw new Error('The saved response differs from your submitted inputs. Reload the latest version before saving again.');
      const project = data.project ?? { ...current.project, total_weeks: returned.totalWeeks };
      const returnedId = project.id ?? project.project_id;
      if (String(returnedId) !== projectId) throw new Error('The server returned a different project after saving. Reload the project.');
      replaceSnapshot({ loaded: true, project, document: returned, revision: data.revision, legacyFingerprint: null, isLegacy: false });
      replaceDrafts({});
      setCustomCells({});
      setDurationDraft(String(returned.totalWeeks));
      dirtyRef.current = false;
      setDirty(false);
      setMessage({ kind: 'success', text: 'Both methods have been saved.' });
    } catch (error) {
      if (mounted.current && error.name !== 'AbortError') setMessage({ kind: 'error', text: error.message || 'The analysis could not be saved. Your edits are still here.' });
    } finally {
      saveLock.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  function numericInput(kind, index, factorId = '') {
    const key = draftKey(mode, kind, index, factorId);
    const entry = drafts[key];
    const stored = kind === 'factor' ? analysis.factors[factorId][index] : analysis[kind][index];
    const value = entry ? entry.raw : kind === 'factor' ? formatProductivityPercent(stored) : stored === 0 ? '' : String(stored);
    const factor = kind === 'factor' ? PRODUCTIVITY_FACTORS.find(item => item.id === factorId) : null;
    const name = factor ? `${factor.label} impact percentage` : kind === 'planned' ? 'Planned work hours' : 'Change order hours';
    const id = `${inputPrefix}-${key}`;
    return <>
      <input id={id} ref={node => { inputRefs.current[key] = node; }} type="text" inputMode="decimal" autoComplete="off"
        value={value} placeholder="0" className={`pa-input${kind === 'factor' ? ' pa-custom-percent' : ''}`}
        disabled={disabled} aria-label={`${name}, week ${index + 1}, ${methodLabel(mode)}`}
        aria-invalid={Boolean(entry?.error)} aria-describedby={entry?.error ? `${id}-error` : undefined}
        onChange={event => onInput(kind, index, event.target.value, factorId)} />
      {entry?.error && <span id={`${id}-error`} className="pa-error">{entry.error}</span>}
    </>;
  }

  return <div className="hcg-tools hcg-prod hcg-prod-analysis">
    <button className="pa-back" type="button" disabled={saving} onClick={goToProjects}>← My projects</button>
    <p className="prod-eyebrow">Productivity · Project analysis</p>
    <h1 className="pa-title">{snapshot.project?.project_name || 'Productivity analysis'}</h1>

    {blocker.state === 'blocked' && <section className="pa-message pa-navigation-warning" ref={navigationWarning} tabIndex={-1}
      role="alertdialog" aria-labelledby={`${inputPrefix}-leave-title`} aria-describedby={`${inputPrefix}-leave-description`}>
      <h2 id={`${inputPrefix}-leave-title`}>{saving ? 'Saving your analysis' : dirty ? 'Leave without saving?' : 'Your changes have been saved'}</h2>
      <p id={`${inputPrefix}-leave-description`}>{saving
        ? 'Please wait while both methods are saved. This page will stay open until saving finishes.'
        : dirty ? 'You have unsaved inputs in this project. Stay to keep editing, or discard them and leave.' : 'You can continue to the page you selected.'}</p>
      <div className="pa-toolbar-actions">
        <button type="button" className="pa-projectBtn" onClick={() => blocker.reset()}>Stay on this page</button>
        {!saving && <button type="button" className="pa-resetBtn" onClick={leaveBlockedPage}>{dirty ? 'Discard and leave' : 'Continue'}</button>}
      </div>
    </section>}

    <div className="pa-tabContainer" role="tablist" aria-label="Calculation method">
      {METHODS.map(method => <button key={method} ref={node => { tabs.current[method] = node; }} type="button" role="tab"
        className={`pa-tab${mode === method ? ' is-active' : ''}`} aria-selected={mode === method}
        id={`${inputPrefix}-${method}-tab`} aria-controls={`${inputPrefix}-analysis-panel`} disabled={saving}
        tabIndex={mode === method ? 0 : -1} onClick={() => chooseMode(method)}
        onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 'proactive' : event.key === 'End' ? 'retroactive' : METHODS.find(item => item !== method);
          chooseMode(next); tabs.current[next]?.focus();
        }}>{methodLabel(method)}{invalidDrafts.some(entry => entry.mode === method) ? ' · incomplete' : ''}</button>)}
    </div>

    {loading && <div className="pa-empty" role="status">Loading saved analysis…</div>}
    {!loading && loadError && <div className="pa-message pa-error" role="alert"><p>{loadError}</p>
      {/^[1-9]\d*$/.test(projectId) && token && <button type="button" className="pa-projectBtn" onClick={reloadLatest}>Retry loading</button>}
    </div>}

    {snapshot.loaded && document && <section id={`${inputPrefix}-analysis-panel`} role="tabpanel" aria-labelledby={`${inputPrefix}-${mode}-tab`}>
      <p className="pa-method-note">{document.inputMode === 'separate'
        ? 'Proactive and Retroactive keep separate inputs. Switching methods preserves your edits in each.'
        : 'Both methods use the same inputs. Editing either method updates both.'}</p>
      {snapshot.isLegacy && <p className="pa-import-note">Your original saved weekly inputs are preserved in both methods.{document.inputMode === 'separate' ? ' Each method can now be edited separately.' : ''}</p>}
      {message && <div className={`pa-message${message.kind === 'error' || message.kind === 'conflict' ? ' pa-error' : ''}`} role={message.kind === 'success' ? 'status' : 'alert'}>
        <p>{message.text}</p>{message.kind === 'conflict' && <button type="button" className="pa-projectBtn" disabled={saving} onClick={reloadLatest}>Reload latest saved version</button>}
      </div>}
      {Object.entries(calculations.errors).map(([method, text]) => <p key={method} className="pa-message pa-error" role="alert">{methodLabel(method)}: {text}</p>)}

      <div className="pa-project-settings">
        <label htmlFor={`${inputPrefix}-weeks`}>Project weeks</label>
        <input id={`${inputPrefix}-weeks`} type="text" inputMode="numeric" value={durationDraft} disabled={disabled}
          aria-label="Project weeks" aria-describedby={`${inputPrefix}-weeks-note`}
          onChange={event => { if (!saveLock.current) { setDurationDraft(event.target.value); markDirty(); } }} />
        <button type="button" className="pa-projectBtn" disabled={disabled || !durationPending} onClick={applyDuration}>Apply to both methods</button>
        <span id={`${inputPrefix}-weeks-note`}>1–{MAX_PRODUCTIVITY_WEEKS} weeks</span>
      </div>

      <div className="pa-toolbar">
        <div className="pa-toolbar-actions"><button type="button" className="pa-resetBtn" disabled={disabled} onClick={resetCurrent}>Reset {document.inputMode === 'shared' ? 'both methods' : methodLabel(mode)}</button></div>
        <div className="pa-save-state" role="status">{saving ? 'Saving both methods…' : dirty ? 'Unsaved changes' : 'Saved inputs loaded'}</div>
        <button type="button" className="pa-calculateBtn" disabled={disabled || !dirty || invalidDrafts.length > 0 || durationPending || Object.keys(calculations.errors).length > 0} onClick={save}>{saving ? 'Saving…' : 'Save both methods'}</button>
        <div className="pa-totalBox">{methodLabel(mode)} total loss: <strong>{displayHours(currentResult?.totalLoss)}</strong> hrs</div>
      </div>

      <div className="pa-factor-toolbar"><strong>{selectedFactors.length} of {PRODUCTIVITY_FACTORS.length} factors selected</strong><Link to="/factors" target="_blank" rel="noopener noreferrer">Factor reference ↗</Link></div>
      <details className="pa-factor-picker"><summary>Choose productivity factors</summary>
        <fieldset disabled={disabled}><legend>Factors for {document.inputMode === 'shared' ? 'both methods' : methodLabel(mode)}</legend>
          {PRODUCTIVITY_FACTORS.map(factor => <label key={factor.id}><input type="checkbox" checked={analysis.selectedFactorIds.includes(factor.id)} onChange={event => toggleFactor(factor.id, event.target.checked)} /><span>{factor.label}</span></label>)}
        </fieldset>
      </details>

      <div className="pa-tableWrapper" role="region" aria-label={`${methodLabel(mode)} weekly inputs; scroll horizontally for more weeks`} tabIndex={0}>
        <table className="pa-table pa-table-v2" aria-label={`${methodLabel(mode)} weekly productivity analysis`}>
          <thead><tr><th scope="col" className="pa-stickyHeader">Hours and factors</th>{weeks.map(index => <th key={index} scope="col" className="pa-weekHeader">Week {index + 1}</th>)}</tr></thead>
          <tbody>
            <tr><th scope="row" className="pa-stickyCell">Planned work hours</th>{weeks.map(index => <td key={index} className="pa-dataCell">{numericInput('planned', index)}</td>)}</tr>
            <tr><th scope="row" className="pa-stickyCell">Change order hours</th>{weeks.map(index => <td key={index} className="pa-dataCell">{numericInput('change', index)}</td>)}</tr>
            <tr className="pa-revisedRow"><th scope="row" className="pa-stickyCellRevised">Revised hours</th>{weeks.map(index => <td key={index} className="pa-revisedCell">{displayHours(currentResult?.weeks[index]?.revisedHours)}</td>)}</tr>
            <tr className="pa-factorSubHeaderRow"><th scope="row" className="pa-stickyCell">Factor impact (%)</th>{weeks.map(index => <td key={index} className="pa-impactHeader">Severity / custom %</td>)}</tr>
            {selectedFactors.map(factor => <tr key={factor.id}><th scope="row" className="pa-stickyCell"><span>{factor.label}</span>{factor.note && <small>{factor.note}</small>}</th>
              {weeks.map(index => {
                const key = draftKey(mode, 'factor', index, factor.id);
                const preset = customCells[key] || drafts[key]?.error ? 'custom' : getDefaultPresetName(factor.id, analysis.factors[factor.id][index]);
                const zeroPresets = ['minor', 'moderate', 'severe'].filter(severity => factor[severity] === 0);
                return <td key={index} className="pa-dataCell">
                  <select className="pa-severity" disabled={disabled} value={preset} aria-label={`${factor.label} severity, week ${index + 1}, ${methodLabel(mode)}`} onChange={event => onPreset(factor, index, event.target.value)}>
                    <option value="none">{zeroPresets.length ? `None / ${zeroPresets.map(name => name[0].toUpperCase() + name.slice(1)).join(' / ')} · 0%` : 'None · 0%'}</option>
                    {['minor', 'moderate', 'severe'].filter(severity => factor[severity] !== 0).map(severity => <option key={severity} value={severity}>{severity[0].toUpperCase() + severity.slice(1)} · {formatProductivityPercent(factor[severity])}%</option>)}
                    <option value="custom">Custom %</option>
                  </select>
                  {preset === 'custom' && numericInput('factor', index, factor.id)}
                </td>;
              })}</tr>)}
            {selectedFactors.length === 0 && <tr><td className="pa-empty" colSpan={weeks.length + 1}>No factors selected. Add a factor above to include its impact.</td></tr>}
            <tr className="pa-totalFactorsRow"><th scope="row" className="pa-stickyCellTotal">Total factors</th>{weeks.map(index => <td key={index} className="pa-totalFactorsCell">{currentResult ? `${formatProductivityPercent(currentResult.weeks[index].totalFactor)}%` : '—'}</td>)}</tr>
            <tr className="pa-estimatedLossRow"><th scope="row" className="pa-stickyCellLoss">Estimated productivity loss (hrs)</th>{weeks.map(index => <td key={index} className="pa-estimatedLossCell">{displayHours(currentResult?.weeks[index]?.loss)}</td>)}</tr>
          </tbody>
        </table>
      </div>
      <p className="pa-method-note">{mode === 'proactive' ? 'Estimated loss = revised hours × total factor.' : 'Estimated loss = revised hours − revised hours ÷ (1 + total factor).'} Revised hours include change order hours.</p>
      <p className="prod-table-note">Enter percentages as 22 for 22%, or 4.3 for 4.3%. Results use full precision; hours are rounded only for display. Scroll within the table to review all weeks.</p>
    </section>}
  </div>;
}
