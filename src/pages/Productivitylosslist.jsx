import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { createProductivityDocument } from '../productivityDocument';
import './ProductivitylossList.css';
import './ProductivityUI.css';

async function responseData(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.msg || `The request failed (${response.status}).`);
  return data;
}
const loss = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
const date = value => { const parsed = new Date(value); return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); };

export default function ProductivityLossList() {
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  return <ProjectLibrary key={`${user?.id}:${token}`} user={user} token={token} />;
}

function ProjectLibrary({ user, token }) {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [createError, setCreateError] = useState('');
  const [name, setName] = useState('');
  const [weekCount, setWeekCount] = useState('14');
  const createLock = useRef(false);
  const deleteLock = useRef(false);
  const alive = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    alive.current = true;
    const load = async () => {
      try {
        const data = await responseData(await fetch('/api/productivity-losses', { headers: { Authorization: `Bearer ${token}` }, signal: controller.signal }));
        if (!Array.isArray(data.productivityLosses)) throw new Error('The project list could not be verified.');
        if (controller.signal.aborted) return;
        setProjects(data.productivityLosses); setError(''); setLoading(false);
      } catch (failure) { if (!controller.signal.aborted) { setError(failure.message); setLoading(false); } }
    };
    load();
    return () => { alive.current = false; controller.abort(); };
  }, [token, refresh]);

  const reload = () => { setLoading(true); setError(''); setRefresh(value => value + 1); };
  const open = id => navigate(`/productivity-analysis?productivityLoss=${id}&mode=proactive`);
  const create = async event => {
    event.preventDefault();
    if (createLock.current) return;
    const count = Number(weekCount);
    if (!name.trim() || name.trim().length > 255) { setCreateError('Enter a project name of 1–255 characters.'); return; }
    if (!Number.isInteger(count) || count < 1 || count > 52) { setCreateError('Enter a whole number from 1 to 52 weeks.'); return; }
    createLock.current = true; setCreating(true); setCreateError('');
    try {
      const data = await responseData(await fetch('/api/productivity-losses-v2', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ project_name: name.trim(), total_weeks: count, document: createProductivityDocument(count) }),
      }));
      const id = data.project_id;
      if (!Number.isInteger(id) || id < 1) throw new Error('The creation result could not be verified. Refresh the project list before trying again.');
      if (!alive.current) return;
      setShowCreate(false); open(id);
    } catch (failure) { if (alive.current) setCreateError(failure.message); }
    finally { if (alive.current) { createLock.current = false; setCreating(false); } }
  };
  const remove = async project => {
    if (deleteLock.current) return;
    if (!window.confirm(`Permanently delete “${project.project_name}” and all its weekly inputs? This cannot be undone in the website.`)) return;
    const id = project.project_id || project.id;
    deleteLock.current = true; setDeleting(id); setError('');
    try {
      const version2 = Number(project.model_version) === 2;
      await responseData(await fetch(`/api/productivity-losses/${id}${version2 ? '/v2' : ''}`, {
        method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        ...(version2 ? { body: JSON.stringify({ expectedRevision: project.revision }) } : {}),
      }));
      if (!alive.current) return;
      setProjects(current => current.filter(item => (item.project_id || item.id) !== id));
    } catch (failure) { if (alive.current) setError(failure.message); }
    finally { if (alive.current) { deleteLock.current = false; setDeleting(null); } }
  };

  return <div className="hcg-tools hcg-prod productivity-loss-container">
    <div className="productivity-loss-header"><div><p className="prod-eyebrow">Productivity · Project library</p><h1>Your productivity projects.</h1><p className="projects-intro">Keep weekly inputs and results for Proactive and Retroactive analysis.</p></div><div className="header-buttons"><button type="button" className="btn btn-primary" onClick={() => { setCreateError(''); setShowCreate(true); }} disabled={creating}>+ New project</button><button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>Workspace</button></div></div>
    <div className="productivity-loss-content"><div className="user-info"><span><span className="project-owner-label">Workspace</span>{user?.username}</span><span>{projects.length} projects</span></div>
      {error && <div role="alert" className="pa-message pa-error">{error} <button type="button" className="btn btn-small" onClick={reload} disabled={loading}>Reload list</button></div>}
      {loading ? <p className="loading" role="status">Loading productivity projects…</p> : projects.length === 0 && !error ? <div className="no-projects"><h2>A place for your next analysis.</h2><p>Create a project, choose its duration and select the productivity factors that apply.</p><button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>Create project</button></div> : projects.length > 0 && <div className="projects-container" tabIndex={0} role="region" aria-label="Productivity project list"><table className="projects-table"><thead><tr><th scope="col">Project</th>{user?.role === 'admin' && <th scope="col">Owner</th>}<th scope="col">Duration</th><th scope="col">Proactive loss</th><th scope="col">Retroactive loss</th><th scope="col">Updated</th><th scope="col">Actions</th></tr></thead><tbody>{projects.map(project => {
        const id = project.project_id || project.id;
        return <tr key={id}><td className="project-name">{project.project_name}</td>{user?.role === 'admin' && <td>{project.username}</td>}<td>{project.total_weeks} weeks</td><td className="loss-value">{loss(project.total_proactive_loss)} hrs</td><td className="loss-value">{loss(project.total_retroactive_loss)} hrs</td><td>{date(project.updated_at || project.created_at)}</td><td><div className="action-buttons"><button type="button" className="btn btn-primary btn-small" onClick={() => open(id)} disabled={deleting !== null}>Open analysis</button><button type="button" className="btn btn-danger btn-small" onClick={() => remove(project)} disabled={deleting !== null}>{deleting === id ? 'Deleting…' : 'Delete'}</button></div></td></tr>;
      })}</tbody></table></div>}
    </div>
    {showCreate && <CreateDialog creating={creating} onClose={() => !creating && setShowCreate(false)} onSubmit={create} name={name} setName={setName} weekCount={weekCount} setWeekCount={setWeekCount} error={createError} />}
  </div>;
}

function CreateDialog({ creating, onClose, onSubmit, name, setName, weekCount, setWeekCount, error }) {
  const dialog = useRef(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog ref={dialog} className="pl-create-dialog" aria-labelledby="pl-create-title" onCancel={event => { event.preventDefault(); if (!creating) onClose(); }}><h2 id="pl-create-title">New productivity project</h2><form onSubmit={onSubmit}><div className="form-group"><label htmlFor="pl-project-name">Project name</label><input id="pl-project-name" autoFocus required maxLength={255} value={name} onChange={event => setName(event.target.value)} disabled={creating} /></div><div className="form-group"><label htmlFor="pl-project-weeks">Project duration (weeks)</label><input id="pl-project-weeks" type="number" min="1" max="52" step="1" required value={weekCount} onChange={event => setWeekCount(event.target.value)} disabled={creating} /></div>{error && <p role="alert" className="pa-message pa-error">{error}</p>}<div className="modal-buttons"><button type="button" className="btn btn-secondary" onClick={onClose} disabled={creating}>Cancel</button><button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Creating…' : 'Create project'}</button></div></form></dialog>;
}
