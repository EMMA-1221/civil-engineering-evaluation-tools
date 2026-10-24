import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { Spinner } from "react-bootstrap";
import { useAuth } from "../hooks/useAuth";
import "./BidUI.css";

function BidList() {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const navigate = useNavigate();
  const { token, user } = useAuth();
  const isAdmin = user?.role === "admin";

  const fetchBids = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(`${API_BASE_URL}/bids`, { headers: { "Authorization": `Bearer ${token}` } });
      if (!response.ok) throw new Error("Failed to fetch bids");
      const data = await response.json();
      setBids(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchBids(); }, [fetchBids]);

  const handleDeleteBid = async (bidId, bidName) => {
    if (!window.confirm(`Are you sure you want to delete "${bidName}"?`)) return;
    try {
      setDeletingId(bidId);
      setError("");
      const response = await fetch(`${API_BASE_URL}/bids/${bidId}`, {
        method: "DELETE", headers: { "Authorization": `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("Failed to delete bid");
      await fetchBids();
    } catch (err) { setError(err.message); }
    finally { setDeletingId(null); }
  };

  const formatDate = (value) => {
    const date = new Date(value);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  return (
    <div className="bid-page bid-list-page">
      <header className="bid-page-header">
        <div className="bid-heading-group">
          <span className="bid-eyebrow">Project decisions</span>
          <h1>Make the next<br className="bid-editorial-break" /> decision clearer.</h1>
          <p>{isAdmin ? "Review and manage all bid evaluations." : "Your projects, factors and saved bid evaluations in one place."}</p>
        </div>
        <button className="bid-button bid-button-primary" type="button" onClick={() => navigate("/bid/new")}>
          New evaluation <span aria-hidden="true">↗</span>
        </button>
      </header>
      {error && <div className="bid-notice bid-notice-error" role="alert"><div><strong>We couldn’t complete that request.</strong><p>{error}</p></div><button type="button" className="bid-text-button" onClick={bids.length ? () => setError("") : fetchBids}>{bids.length ? "Dismiss" : "Try again"}</button></div>}
      <section className="bid-projects" aria-label="Saved bid evaluations" aria-busy={loading}>
        <div className="bid-section-heading"><h2>Saved evaluations</h2><span className="bid-small-label">{loading ? "Loading" : `${bids.length} ${bids.length === 1 ? "project" : "projects"}`}{isAdmin ? " · All users" : ""}</span></div>
        {loading ? (
          <div className="bid-loading" role="status"><Spinner animation="border" size="sm" aria-hidden="true" /><span>Loading your evaluations…</span></div>
        ) : bids.length === 0 ? (
          <div className="bid-empty-state">
            <span className="bid-small-label">{error ? "Connection interrupted" : "A clean slate"}</span>
            <h3>{error ? "Your evaluations couldn’t be loaded." : "Every good decision starts with a question."}</h3>
            <p>{error ? "Try loading the list again before creating or editing a project." : "Start an evaluation to review the relationships, risks and readiness behind your next opportunity."}</p>
            <button className="bid-button bid-button-secondary" type="button" onClick={error ? fetchBids : () => navigate("/bid/new")}>{error ? "Try again" : "Start your first evaluation"}<span aria-hidden="true">→</span></button>
          </div>
        ) : (
          <table className={`bid-project-table${isAdmin ? " bid-project-table-admin" : ""}`}>
            <thead><tr><th scope="col">Project</th><th scope="col">Location</th><th scope="col">Score</th>{isAdmin && <th scope="col">Created by</th>}<th scope="col">Timeline</th><th scope="col" className="bid-action-heading">Actions</th></tr></thead>
            <tbody>{bids.map(bid => (
              <tr key={bid.id}>
                <td className="bid-project-name" data-label="Project"><button className="bid-project-link" type="button" onClick={() => navigate(`/bid/${bid.id}`)}>{bid.bid_name}</button></td>
                <td data-label="Location">{bid.bid_location || "Not specified"}</td>
                <td data-label="Total score"><span className="bid-score-tag">{bid.total_score > 0 ? "+" : ""}{bid.total_score}</span></td>
                {isAdmin && <td data-label="Created by">{bid.username || bid.email}</td>}
                <td data-label="Timeline"><div className="bid-date-line"><span>Created</span><time>{formatDate(bid.created_at)}</time></div><div className="bid-date-line"><span>Updated</span><time>{formatDate(bid.updated_at)}</time></div></td>
                <td className="bid-project-actions" data-label="Actions"><div className="bid-action-group"><button className="bid-button bid-button-small bid-button-secondary" type="button" onClick={() => navigate(`/bid/${bid.id}`)}>View / edit</button><button className="bid-text-button bid-delete-button" type="button" disabled={deletingId !== null} onClick={() => handleDeleteBid(bid.id, bid.bid_name)} aria-label={`Delete ${bid.bid_name}`}>{deletingId === bid.id ? "Deleting…" : "Delete"}</button></div></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </section>
      <p className="bid-page-footnote">Scores reflect the saved answers and assigned values. They are not a standalone bid recommendation.</p>
    </div>
  );
}

export default BidList;
