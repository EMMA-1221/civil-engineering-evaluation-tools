import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Modal, Spinner } from "react-bootstrap";
import { API_BASE_URL } from "../config";
import { bidQuestions } from "../bidQuestions";
import {
  LEGACY_VERSION,
  adjustAnswer,
  calculateScore,
  createBidModel,
  getQuestionIds,
  hydrateBid,
  isQuestionEditable,
  resetAnswers,
  restoreDefault,
  selectAnswer,
  serializeAnswers,
} from "../bidModel";
import "./BidUI.css";

const sections = Object.entries(bidQuestions);
const initialSections = () => ({ section1: true });
const isSelected = answer => answer === "Yes" || answer === "No";
const formatScore = score => `${score > 0 ? "+" : ""}${score}`;

async function responseError(response, fallback) {
  const body = await response.json().catch(() => null);
  return body?.msg || body?.error || fallback;
}

export default function BidDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const isEditing = Boolean(id && id !== "new");
  const evaluationKey = `${id || "new"}:${token || ""}`;
  const activeKey = useRef(evaluationKey);
  activeKey.current = evaluationKey;
  const saveLock = useRef(false);
  const [model, setModel] = useState(createBidModel);
  const [bidName, setBidName] = useState("");
  const [bidLocation, setBidLocation] = useState("");
  const [loadState, setLoadState] = useState({ key: null, status: "loading", error: "" });
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [openSections, setOpenSections] = useState(initialSections);

  useEffect(() => {
    const controller = new AbortController();
    setLoadState({ key: evaluationKey, status: "loading", error: "" });
    setShowSaveModal(false);
    setSaveError("");
    setOpenSections(initialSections());
    setBidName("");
    setBidLocation("");

    if (!isEditing) {
      setModel(createBidModel());
      setLoadState({ key: evaluationKey, status: "ready", error: "" });
      return () => controller.abort();
    }

    async function loadBid() {
      try {
        const response = await fetch(`${API_BASE_URL}/bids/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(await responseError(response, "Failed to load evaluation."));
        const data = await response.json();
        const loadedModel = hydrateBid(data.answers, data.total_score);
        if (controller.signal.aborted) return;
        setModel(loadedModel);
        setBidName(data.bid_name || "");
        setBidLocation(data.bid_location || "");
        setLoadState({ key: evaluationKey, status: "ready", error: "" });
      } catch (error) {
        if (controller.signal.aborted) return;
        setLoadState({ key: evaluationKey, status: "error", error: error.message });
      }
    }

    loadBid();
    return () => controller.abort();
  }, [evaluationKey, id, isEditing, retry, token]);

  const ready = loadState.key === evaluationKey && loadState.status === "ready";
  const legacy = model.version === LEGACY_VERSION;
  const questionIds = getQuestionIds(model.version);
  const selectedCount = questionIds.filter(questionId => isSelected(model.answers[questionId]?.answer)).length;
  const totalScore = calculateScore(model);
  const disabled = !ready || saving;
  const setAnswer = (questionId, answer) => setModel(previous => selectAnswer(previous, questionId, answer));
  const adjustValue = (questionId, delta) => setModel(previous => adjustAnswer(previous, questionId, delta));
  const restoreValue = questionId => setModel(previous => restoreDefault(previous, questionId));

  function handleReset() {
    if (window.confirm("Reset all answers and adjustments in this evaluation?")) {
      setModel(previous => resetAnswers(previous));
    }
  }

  function openSaveModal() {
    if (disabled) return;
    setSaveError("");
    setShowSaveModal(true);
  }

  async function handleSave() {
    if (!ready || saveLock.current) return;
    if (!bidName.trim()) {
      setSaveError("Please enter a project name before saving.");
      return;
    }
    const saveKey = evaluationKey;
    saveLock.current = true;
    setSaving(true);
    setSaveError("");
    try {
      const payload = {
        bid_name: bidName.trim(),
        bid_location: bidLocation.trim(),
        answers: serializeAnswers(model),
        total_score: totalScore,
      };
      const response = await fetch(`${API_BASE_URL}/bids${isEditing ? `/${id}` : ""}`, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error(await responseError(response, "Failed to save evaluation."));
      if (activeKey.current === saveKey) {
        setShowSaveModal(false);
        navigate("/bid");
      }
    } catch (error) {
      if (activeKey.current === saveKey) setSaveError(error.message);
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  }

  if (loadState.key !== evaluationKey || loadState.status === "loading") {
    return <div className="bid-page bid-loading" role="status"><Spinner animation="border" size="sm" aria-hidden="true" /><span>Loading your evaluation…</span></div>;
  }

  if (loadState.status === "error") {
    return <div className="bid-page">
      <button className="bid-back-button" type="button" onClick={() => navigate("/bid")}>← All evaluations</button>
      <div className="bid-notice bid-notice-error" role="alert"><div><strong>The saved evaluation couldn’t be loaded.</strong><p>{loadState.error}</p></div><button className="bid-text-button" type="button" onClick={() => setRetry(value => value + 1)}>Try again</button></div>
    </div>;
  }

  return <div className="bid-page bid-detail-page">
    <button className="bid-back-button" type="button" onClick={() => navigate("/bid")}><span aria-hidden="true">←</span> All evaluations</button>
    <header className="bid-page-header bid-detail-header">
      <div className="bid-heading-group"><span className="bid-eyebrow">Bid / No-bid</span><h1>{isEditing ? "A clearer view of the opportunity." : "Start with the right questions."}</h1><p>{bidName || (isEditing ? "Edit your saved evaluation." : "A new evaluation of project relationships, risk and readiness.")}{bidLocation ? ` · ${bidLocation}` : ""}</p></div>
      <span className="bid-status-label">{isEditing ? "Editing evaluation" : "New evaluation"}</span>
    </header>
    {legacy && <aside className="bid-legacy-note" aria-label="Earlier evaluation">
      <div><strong>Earlier evaluation · Saved scoring retained</strong><p>This record uses the earlier 16-factor method. Start a new evaluation to use all 62 factors.</p></div>
      <button className="bid-text-button" type="button" onClick={() => navigate("/bid/new")}>New evaluation ↗</button>
    </aside>}
    <section className="bid-score-overview" aria-label="Evaluation progress and scoring">
      <div className="bid-total"><span className="bid-small-label">Total score</span><output className="bid-total-value" aria-live="polite">{formatScore(totalScore)}</output></div>
      <div className="bid-score-explainer"><span className="bid-small-label">How it is calculated</span><p>{legacy ? "The earlier method counts only Yes values. Existing scores and adjustments are retained." : "Yes uses the positive default; No uses the negative default. Unselected factors count as 0."}</p><span className="bid-progress-label">{selectedCount} of {questionIds.length} factors selected</span></div>
      <div className="bid-score-actions"><button className="bid-text-button" type="button" onClick={handleReset} disabled={disabled}>Reset all</button><button className="bid-button bid-button-primary" type="button" onClick={openSaveModal} disabled={disabled}>Save evaluation <span aria-hidden="true">↗</span></button></div>
    </section>
    <div className="bid-section-tools" aria-label="Section display"><button className="bid-text-button" type="button" onClick={() => setOpenSections(Object.fromEntries(sections.map(([key]) => [key, true])))}>Expand all</button><button className="bid-text-button" type="button" onClick={() => setOpenSections({})}>Collapse all</button></div>
    <div className="bid-question-sections">
      {sections.map(([key, section]) => {
        const questions = section.questions.filter(question => isQuestionEditable(model, question.id));
        const count = questions.filter(question => isSelected(model.answers[question.id]?.answer)).length;
        const expanded = Boolean(openSections[key]);
        return <section className="bid-question-section" key={key} aria-labelledby={`bid-section-${key}`}>
          <h2 className="bid-accordion-heading" id={`bid-section-${key}`}><button className="bid-section-toggle" type="button" aria-expanded={expanded} aria-controls={`bid-content-${key}`} onClick={() => setOpenSections(previous => ({ ...previous, [key]: !previous[key] }))}>
            <span className="bid-section-title">{section.title}</span><span className="bid-section-progress">{questions.length ? `${count} / ${questions.length} selected` : "Not included"}</span><svg className="bid-section-chevron" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button></h2>
          <div className="bid-section-body" id={`bid-content-${key}`} hidden={!expanded}>
            {questions.length ? <>
              <div className="bid-question-column-head" aria-hidden="true"><span>Factor</span><span>Answer</span><span>Assigned value</span></div>
              {questions.map((question, index) => {
                const answer = model.answers[question.id] || { answer: null, value: 0 };
                const selected = isSelected(answer.answer);
                const valueDisabled = disabled || !selected;
                return <div className="bid-question-row" key={question.id}>
                  <div className="bid-question-text"><span className="bid-factor-number">{String(index + 1).padStart(2, "0")}</span><span id={`bid-factor-${question.id}`}>{question.text}</span></div>
                  <div className="bid-answer-field"><span className="bid-mobile-field-label" aria-hidden="true">Answer</span><div className="bid-answer-options" role="group" aria-labelledby={`bid-factor-${question.id}`}>
                    {["Yes", "No"].map(choice => <button className="bid-answer-option" key={choice} type="button" aria-pressed={answer.answer === choice} disabled={disabled} onClick={() => setAnswer(question.id, choice)}><span className="bid-choice-circle" aria-hidden="true" />{choice}</button>)}
                  </div></div>
                  <div className="bid-value-field"><span className="bid-mobile-field-label" aria-hidden="true">Assigned value</span><div className="bid-value-controls"><button className="bid-step-button" type="button" disabled={valueDisabled} onClick={() => adjustValue(question.id, -1)} aria-label={`Decrease value: ${question.text}`}>−</button><output className={`bid-factor-value${selected ? " bid-factor-value-included" : ""}`} aria-label={`Assigned value for ${question.text}`}>{formatScore(answer.value)}</output><button className="bid-step-button" type="button" disabled={valueDisabled} onClick={() => adjustValue(question.id, 1)} aria-label={`Increase value: ${question.text}`}>+</button><button className="bid-factor-reset" type="button" disabled={legacy ? disabled : valueDisabled} onClick={() => restoreValue(question.id)} aria-label={`${legacy ? "Reset answer and value" : "Restore default value"}: ${question.text}`}>{legacy ? "Reset" : "Default"}</button></div></div>
                </div>;
              })}
            </> : <p className="bid-section-unavailable">This section is available in new evaluations.</p>}
          </div>
        </section>;
      })}
    </div>
    <footer className="bid-detail-footer"><p>The score is a sum of your inputs. No bid recommendation or decision threshold is defined here.</p><button className="bid-button bid-button-primary" type="button" onClick={openSaveModal} disabled={disabled}>Save evaluation <span aria-hidden="true">↗</span></button></footer>
    <Modal show={showSaveModal} onHide={() => { if (!saving) setShowSaveModal(false); }} centered className="bid-save-modal" dialogClassName="bid-save-dialog" contentClassName="bid-save-content" aria-labelledby="bid-save-title">
      <Modal.Header closeButton><div><span className="bid-eyebrow">Keep your work</span><Modal.Title id="bid-save-title">Save evaluation</Modal.Title></div></Modal.Header>
      <Modal.Body>
        {saveError && <div className="bid-notice bid-notice-error" id="bid-save-error" role="alert">{saveError}</div>}
        <form id="bid-save-form" onSubmit={event => { event.preventDefault(); handleSave(); }} noValidate>
          <label className="bid-form-label" htmlFor="bid-project-name">Project name <span>Required</span></label><input id="bid-project-name" className="bid-input" value={bidName} placeholder="Enter project name" autoFocus aria-required="true" aria-invalid={Boolean(saveError && !bidName.trim())} aria-describedby={saveError ? "bid-save-error" : undefined} onChange={event => setBidName(event.target.value)} disabled={saving} />
          <label className="bid-form-label" htmlFor="bid-project-location">Location <span>Optional</span></label><input id="bid-project-location" className="bid-input" value={bidLocation} placeholder="Enter project location" onChange={event => setBidLocation(event.target.value)} disabled={saving} />
          <div className="bid-save-summary"><span>Total score</span><strong>{formatScore(totalScore)}</strong><span>{selectedCount} / {questionIds.length} selected</span></div>
        </form>
      </Modal.Body>
      <Modal.Footer><button className="bid-button bid-button-secondary" type="button" disabled={saving} onClick={() => setShowSaveModal(false)}>Cancel</button><button className="bid-button bid-button-primary" type="submit" form="bid-save-form" disabled={saving}>{saving ? "Saving…" : "Save evaluation"}</button></Modal.Footer>
    </Modal>
  </div>;
}
