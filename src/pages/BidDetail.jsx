import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { bidQuestions } from "../bidQuestions";
import { Modal, Spinner } from "react-bootstrap";
import "./BidUI.css";

function initAnswers() {
  const newAnswers = {};
  Object.values(bidQuestions).forEach(section => section.questions.forEach(q => {
    newAnswers[q.id] = { answer: null, value: 0 };
  }));
  return newAnswers;
}

function BidDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const [bidName, setBidName] = useState("");
  const [bidLocation, setBidLocation] = useState("");
  const [answers, setAnswers] = useState({});
  const [totalScore, setTotalScore] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const isEditing = id && id !== "new";
  const sections = Object.entries(bidQuestions);
  const activeSections = sections.filter(([, section]) => section.questions.length > 0);
  const emptySections = sections.filter(([, section]) => section.questions.length === 0);
  const questionCount = sections.reduce((count, [, section]) => count + section.questions.length, 0);
  const answeredCount = sections.reduce((count, [, section]) => count + section.questions.filter(question => answers[question.id]?.answer).length, 0);

  const loadBid = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/bids/${id}`, { headers: { "Authorization": `Bearer ${token}` } });
      if (!response.ok) throw new Error("Failed to load bid");
      const data = await response.json();
      setBidName(data.bid_name);
      setBidLocation(data.bid_location || "");
      const parsedAnswers = typeof data.answers === "string" ? JSON.parse(data.answers) : data.answers;
      const mergedAnswers = { ...initAnswers() };
      Object.keys(parsedAnswers).forEach(key => {
        if (parsedAnswers[key]) mergedAnswers[key] = {
          answer: parsedAnswers[key].answer || null,
          value: parsedAnswers[key].value !== undefined ? parsedAnswers[key].value : 0
        };
      });
      setAnswers(mergedAnswers);
      setTotalScore(data.total_score);
    } catch (err) {
      console.error("Load bid error:", err);
      setError(err.message);
      setAnswers(initAnswers());
    } finally { setLoading(false); }
  }, [id, token]);

  useEffect(() => {
    if (id && id !== "new") loadBid();
    else setAnswers(initAnswers());
  }, [id, loadBid]);

  // Preserve the original calculation: only Yes answers contribute their assigned value.
  useEffect(() => {
    let score = 0;
    Object.values(bidQuestions).forEach(section => section.questions.forEach(q => {
      const userAnswer = answers[q.id];
      if (userAnswer?.answer === "Yes") score += userAnswer.value;
    }));
    setTotalScore(score);
  }, [answers]);

  const handleAnswerChange = (questionId, answer) => setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], answer } }));
  const handleIncrease = (questionId) => setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], value: (prev[questionId]?.value || 0) + 1 } }));
  const handleDecrease = (questionId) => setAnswers(prev => ({ ...prev, [questionId]: { ...prev[questionId], value: (prev[questionId]?.value || 0) - 1 } }));
  const handleDefault = (questionId) => setAnswers(prev => ({ ...prev, [questionId]: { answer: null, value: 0 } }));
  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all answers?")) setAnswers(initAnswers());
  };
  const openSaveModal = () => { setSaveError(""); setShowSaveModal(true); };

  const handleSave = async () => {
    if (!bidName.trim()) { setSaveError("Please enter a project name before saving."); return; }
    try {
      setSaving(true);
      setSaveError("");
      const payload = { bid_name: bidName, bid_location: bidLocation, answers: answers, total_score: totalScore };
      let response;
      if (id && id !== "new") {
        response = await fetch(`${API_BASE_URL}/bids/${id}`, {
          method: "PUT", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify(payload)
        });
      } else {
        response = await fetch(`${API_BASE_URL}/bids`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` }, body: JSON.stringify(payload)
        });
      }
      if (!response.ok) throw new Error("Failed to save bid");
      setShowSaveModal(false);
      navigate("/bid");
    } catch (err) { setSaveError(err.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="bid-page bid-loading" role="status"><Spinner animation="border" size="sm" aria-hidden="true" /><span>Loading your evaluation…</span></div>;

  return (
    <div className="bid-page bid-detail-page">
      <button className="bid-back-button" type="button" onClick={() => navigate("/bid")}><span aria-hidden="true">←</span> All evaluations</button>
      <header className="bid-page-header bid-detail-header">
        <div className="bid-heading-group"><span className="bid-eyebrow">Bid / No-bid</span><h1>{isEditing ? "A clearer view of the opportunity." : "Start with the right questions."}</h1><p>{bidName || (isEditing ? "Edit your saved evaluation." : "A new evaluation of project relationships, risk and readiness.")}{bidLocation ? ` · ${bidLocation}` : ""}</p></div>
        <span className="bid-status-label">{isEditing ? "Editing evaluation" : "New evaluation"}</span>
      </header>
      {error && <div className="bid-notice bid-notice-error" role="alert"><div><strong>The saved evaluation couldn’t be loaded.</strong><p>{error}. Return to the list or try again before editing.</p></div><button className="bid-text-button" type="button" onClick={loadBid}>Try again</button></div>}
      <section className="bid-score-overview" aria-label="Evaluation progress and scoring">
        <div className="bid-total"><span className="bid-small-label">Total score</span><output className="bid-total-value" aria-live="polite">{totalScore > 0 ? "+" : ""}{totalScore}</output></div>
        <div className="bid-score-explainer"><span className="bid-small-label">How it is calculated</span><p>Only answers marked “Yes” contribute their assigned value. Values start at 0; use − / + to adjust them.</p><span className="bid-progress-label">{answeredCount} of {questionCount} factors answered</span></div>
        <div className="bid-score-actions"><button className="bid-text-button" type="button" onClick={handleReset} disabled={Boolean(error)}>Reset all</button><button className="bid-button bid-button-primary" type="button" onClick={openSaveModal} disabled={Boolean(error)}>Save evaluation <span aria-hidden="true">↗</span></button></div>
      </section>
      <div className="bid-question-sections">
        {activeSections.map(([key, section]) => (
          <section className="bid-question-section" key={key} aria-labelledby={`bid-section-${key}`}>
            <div className="bid-section-heading bid-factor-section-heading"><h2 id={`bid-section-${key}`}>{section.title}</h2><span className="bid-small-label">{section.questions.length} factors</span></div>
            <div className="bid-question-column-head" aria-hidden="true"><span>Factor</span><span>Answer</span><span>Assigned value</span></div>
            {section.questions.map((q, index) => {
              const userAnswer = answers[q.id] || { answer: null, value: 0 };
              const isIncluded = userAnswer.answer === "Yes";
              return (
                <div className="bid-question-row" key={q.id}>
                  <div className="bid-question-text"><span className="bid-factor-number">{String(index + 1).padStart(2, "0")}</span><label htmlFor={`bid-answer-${q.id}`}>{q.text}</label></div>
                  <div className="bid-answer-field"><label className="bid-mobile-field-label" htmlFor={`bid-answer-${q.id}`}>Answer</label><select id={`bid-answer-${q.id}`} className="bid-select" value={userAnswer.answer || ""} disabled={Boolean(error)} onChange={event => handleAnswerChange(q.id, event.target.value)}><option value="">Select…</option><option value="Yes">Yes</option><option value="No">No</option><option value="N/A">N/A</option></select></div>
                  <div className="bid-value-field"><span className="bid-mobile-field-label">Assigned value</span><div className="bid-value-controls"><button className="bid-step-button" type="button" disabled={Boolean(error)} onClick={() => handleDecrease(q.id)} aria-label={`Decrease value: ${q.text}`}>−</button><output className={`bid-factor-value${isIncluded ? " bid-factor-value-included" : ""}`} aria-label={`Assigned value for ${q.text}`}>{userAnswer.value > 0 ? "+" : ""}{userAnswer.value}</output><button className="bid-step-button" type="button" disabled={Boolean(error)} onClick={() => handleIncrease(q.id)} aria-label={`Increase value: ${q.text}`}>+</button><button className="bid-factor-reset" type="button" disabled={Boolean(error)} onClick={() => handleDefault(q.id)} aria-label={`Reset answer and value: ${q.text}`}>Reset</button></div><span className="bid-counting-note">{isIncluded ? "Yes · counted in total" : `${userAnswer.answer || "Unanswered"} · not counted`}</span></div>
                </div>
              );
            })}
          </section>
        ))}
      </div>
      {emptySections.length > 0 && <details className="bid-empty-sections"><summary>{emptySections.length} sections have no configured questions</summary><ul>{emptySections.map(([key, section]) => <li key={key}>{section.title}</li>)}</ul></details>}
      <footer className="bid-detail-footer"><p>The score is a sum of your inputs. No bid recommendation or decision threshold is defined here.</p><button className="bid-button bid-button-primary" type="button" onClick={openSaveModal} disabled={Boolean(error)}>Save evaluation <span aria-hidden="true">↗</span></button></footer>
      <Modal show={showSaveModal} onHide={() => { if (!saving) setShowSaveModal(false); }} centered className="bid-save-modal" dialogClassName="bid-save-dialog" contentClassName="bid-save-content" aria-labelledby="bid-save-title">
        <Modal.Header closeButton><div><span className="bid-eyebrow">Keep your work</span><Modal.Title id="bid-save-title">Save evaluation</Modal.Title></div></Modal.Header>
        <Modal.Body>
          {saveError && <div className="bid-notice bid-notice-error" id="bid-save-error" role="alert">{saveError}</div>}
          <form id="bid-save-form" onSubmit={event => { event.preventDefault(); handleSave(); }} noValidate>
            <label className="bid-form-label" htmlFor="bid-project-name">Project name <span>Required</span></label><input id="bid-project-name" className="bid-input" value={bidName} placeholder="Enter project name" autoFocus aria-required="true" aria-invalid={Boolean(saveError && !bidName.trim())} aria-describedby={saveError ? "bid-save-error" : undefined} onChange={event => setBidName(event.target.value)} disabled={saving} />
            <label className="bid-form-label" htmlFor="bid-project-location">Location <span>Optional</span></label><input id="bid-project-location" className="bid-input" value={bidLocation} placeholder="Enter project location" onChange={event => setBidLocation(event.target.value)} disabled={saving} />
            <div className="bid-save-summary"><span>Total score</span><strong>{totalScore > 0 ? "+" : ""}{totalScore}</strong><span>{answeredCount} / {questionCount} answered</span></div>
          </form>
        </Modal.Body>
        <Modal.Footer><button className="bid-button bid-button-secondary" type="button" disabled={saving} onClick={() => setShowSaveModal(false)}>Cancel</button><button className="bid-button bid-button-primary" type="submit" form="bid-save-form" disabled={saving}>{saving ? "Saving…" : "Save evaluation"}</button></Modal.Footer>
      </Modal>
    </div>
  );
}

export default BidDetail;
