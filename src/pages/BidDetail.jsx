import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { bidQuestions } from "../bidQuestions";
import { Button, Modal, Form, Spinner, Alert } from "react-bootstrap";

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
  const [showSaveModal, setShowSaveModal] = useState(false);

  // Initialize answer state
  const initAnswers = () => {
    const newAnswers = {};
    Object.values(bidQuestions).forEach(section => {
      section.questions.forEach(q => {
        newAnswers[q.id] = { 
          answer: null,    // 'Yes', 'No', 'N/A', null
          value: 0         // Numeric value
        };
      });
    });
    return newAnswers;
  };

  // Load bid data if editing existing bid
  useEffect(() => {
    if (id && id !== 'new') {
      loadBid();
    } else {
      setAnswers(initAnswers());
    }
  }, [id]);

  const loadBid = async () => {
  try {
    setLoading(true);
    const response = await fetch(`${API_BASE_URL}/bids/${id}`, {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("Failed to load bid");
    }

    const data = await response.json();
    setBidName(data.bid_name);
    setBidLocation(data.bid_location || "");
    
    // Check if answers is already an object or a string
    let parsedAnswers;
    if (typeof data.answers === 'string') {
      parsedAnswers = JSON.parse(data.answers);
    } else {
      parsedAnswers = data.answers;  // Already an object
    }
    
    // Initialize all questions first
    const initializedAnswers = initAnswers();
    const mergedAnswers = { ...initializedAnswers };
    
    // Override with saved answers
    Object.keys(parsedAnswers).forEach(key => {
      if (parsedAnswers[key]) {
        mergedAnswers[key] = {
          answer: parsedAnswers[key].answer || null,
          value: parsedAnswers[key].value !== undefined ? parsedAnswers[key].value : 0
        };
      }
    });
    
    setAnswers(mergedAnswers);
    setTotalScore(data.total_score);
    setLoading(false);
    
  } catch (err) {
    console.error("Load bid error:", err);
    setError(err.message);
    setAnswers(initAnswers());
    setLoading(false);
  }
};

  // Calculate total score
  // Only count if answer is "Yes"
  useEffect(() => {
    let score = 0;
    Object.values(bidQuestions).forEach(section => {
      section.questions.forEach(q => {
        const userAnswer = answers[q.id];
        if (!userAnswer) return;
        
        // Only count if user selected "Yes"
        if (userAnswer.answer === 'Yes') {
          score += userAnswer.value;
        }
      });
    });
    setTotalScore(score);
  }, [answers]);

  // Handle Yes/No/N/A selection
  const handleAnswerChange = (questionId, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { ...prev[questionId], answer }
    }));
  };

  // Handle Increase button (+1)
  const handleIncrease = (questionId) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { 
        ...prev[questionId], 
        value: (prev[questionId]?.value || 0) + 1 
      }
    }));
  };

  // Handle Decrease button (-1)
  const handleDecrease = (questionId) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { 
        ...prev[questionId], 
        value: (prev[questionId]?.value || 0) - 1 
      }
    }));
  };

  // Handle Default button (reset to 0)
  const handleDefault = (questionId) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: { answer: null, value: 0 }
    }));
  };

  // Reset all answers
  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset all answers?")) {
      setAnswers(initAnswers());
    }
  };

  // Save bid
  const handleSave = async () => {
    if (!bidName.trim()) {
      alert("Please enter a project name");
      return;
    }

    try {
      setSaving(true);
      
      const payload = {
        bid_name: bidName,
        bid_location: bidLocation,
        answers: answers,
        total_score: totalScore
      };

      let response;
      if (id && id !== 'new') {
        response = await fetch(`${API_BASE_URL}/bids/${id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      } else {
        response = await fetch(`${API_BASE_URL}/bids`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok) {
        throw new Error("Failed to save bid");
      }

      setSaving(false);
      setShowSaveModal(false);
      navigate("/bid");
      
    } catch (err) {
      alert(`Error: ${err.message}`);
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <Spinner animation="border" variant="primary" />
        <p>Loading bid data...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <Button variant="outline-secondary" onClick={() => navigate("/bid")}>
          ← Back to List
        </Button>
        <h1 style={styles.title}>
          {id && id !== 'new' ? 'Edit BID Evaluation' : 'New BID Evaluation'}
        </h1>
      </div>

      {error && (
        <Alert variant="danger" onClose={() => setError("")} dismissible>
          {error}
        </Alert>
      )}

      <p style={styles.desc}>
        This tool assists in evaluating bid-related factors, relationships, and project readiness.
        <br />
        <small style={{ color: '#999' }}>Note: Only questions marked as "Yes" will be counted in the total score.</small>
      </p>

      {/* Controls */}
      <div style={styles.controls}>
        <button style={styles.resetButton} onClick={handleReset}>
          Reset
        </button>
        <div style={styles.scoreBox}>
          <p style={styles.scoreLabel}>Your Score</p>
          <p style={styles.scoreValue}>{totalScore}</p>
        </div>
        <button style={styles.updateButton} onClick={() => setShowSaveModal(true)}>
          Save
        </button>
      </div>

      {/* Table */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.headerRow}>
              <th style={styles.headerCell}>Factors</th>
              <th style={styles.headerCellSmall}>Yes/No</th>
              <th style={styles.headerCellSmall}>Value</th>
              <th style={styles.headerCellSmall}>Increase</th>
              <th style={styles.headerCellSmall}>Decrease</th>
              <th style={styles.headerCellSmall}>Default</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(bidQuestions).map(([key, section]) => (
              <React.Fragment key={key}>
                <tr style={styles.sectionRow}>
                  <td colSpan="6" style={styles.sectionTitle}>
                    {section.title}
                  </td>
                </tr>

                {section.questions.length > 0 ? (
                  section.questions.map(q => {
                    const userAnswer = answers[q.id] || { answer: null, value: 0 };
                    const isCountedInScore = userAnswer.answer === 'Yes' && userAnswer.value !== 0;
                    
                    return (
                      <tr key={q.id} style={styles.dataRow}>
                        <td style={styles.factorCell}>{q.text}</td>

                        <td style={styles.cell}>
                          <select
                            value={userAnswer.answer || ''}
                            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                            style={styles.select}
                          >
                            <option value="">-</option>
                            <option value="Yes">Yes</option>
                            <option value="No">No</option>
                            <option value="N/A">N/A</option>
                          </select>
                        </td>

                        {/* Display current value */}
                        <td style={styles.cell}>
                          <span style={{
                            color: isCountedInScore 
                              ? (userAnswer.value > 0 ? '#27ae60' : '#c0392b')
                              : '#999',
                            fontWeight: isCountedInScore ? 'bold' : 'normal',
                            textDecoration: !isCountedInScore && userAnswer.value !== 0 ? 'line-through' : 'none'
                          }}>
                            {userAnswer.value > 0 ? '+' : ''}{userAnswer.value}
                          </span>
                        </td>

                        {/* Increase button (+1) */}
                        <td style={styles.cell}>
                          <button
                            onClick={() => handleIncrease(q.id)}
                            style={styles.arrowButton}
                          >
                            <span style={{ color: '#27ae60', fontSize: '1.5rem' }}>▲</span>
                          </button>
                        </td>

                        {/* Decrease button (-1) */}
                        <td style={styles.cell}>
                          <button
                            onClick={() => handleDecrease(q.id)}
                            style={styles.arrowButton}
                          >
                            <span style={{ color: '#c0392b', fontSize: '1.5rem' }}>▼</span>
                          </button>
                        </td>

                        {/* Default button */}
                        <td style={styles.cell}>
                          <button
                            onClick={() => handleDefault(q.id)}
                            style={{
                              ...styles.defaultButton,
                              backgroundColor: userAnswer.value === 0 ? '#95a5a6' : '#ecf0f1'
                            }}
                          >
                            ⚪
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="6" style={{ ...styles.cell, textAlign: 'center', color: '#999', fontStyle: 'italic' }}>
                      No questions in this section
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Save Modal */}
      <Modal show={showSaveModal} onHide={() => setShowSaveModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Save BID Evaluation</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Project Name *</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter project name"
                value={bidName}
                onChange={(e) => setBidName(e.target.value)}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Location</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter project location (optional)"
                value={bidLocation}
                onChange={(e) => setBidLocation(e.target.value)}
              />
            </Form.Group>

            <div style={{ background: '#f8f9fa', padding: '1rem', borderRadius: '8px' }}>
              <p style={{ margin: 0, fontWeight: 'bold' }}>Total Score: {totalScore}</p>
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowSaveModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save BID'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

const styles = {
  page: {
    backgroundColor: "#f8fafc",
    padding: "1rem",
    fontFamily: "Segoe UI, Arial, sans-serif",
    color: "#333",
    minHeight: "100vh",
  },
  topBar: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
    marginBottom: "1rem",
  },
  title: {
    color: "#002b5c",
    marginBottom: "0.5rem",
    fontSize: "clamp(1.5rem, 4vw, 2rem)",
  },
  desc: {
    textAlign: "center",
    color: "#555",
    marginBottom: "1.5rem",
    fontSize: "clamp(0.9rem, 2vw, 1rem)",
  },
  controls: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "1rem",
    marginBottom: "2rem",
    flexWrap: "wrap",
  },
  resetButton: {
    backgroundColor: "#000",
    color: "white",
    border: "none",
    padding: "0.8rem 2rem",
    borderRadius: "30px",
    fontSize: "1rem",
    cursor: "pointer",
    fontWeight: "600",
  },
  updateButton: {
    backgroundColor: "#00d4d4",
    color: "black",
    border: "none",
    padding: "0.8rem 2rem",
    borderRadius: "8px",
    fontSize: "1rem",
    cursor: "pointer",
    fontWeight: "700",
  },
  scoreBox: {
    backgroundColor: "#1a1a1a",
    color: "#f4c430",
    borderRadius: "10px",
    padding: "0.8rem 2rem",
    textAlign: "center",
    minWidth: "200px",
  },
  scoreLabel: {
    margin: 0,
    fontSize: "0.9rem",
    letterSpacing: "0.5px",
    fontWeight: "600",
  },
  scoreValue: {
    margin: 0,
    fontSize: "2rem",
    fontWeight: "700",
  },
  loading: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "60vh",
    gap: "1rem",
  },
  tableWrapper: {
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
  },
  table: {
    borderCollapse: "collapse",
    width: "100%",
    minWidth: "800px",
    backgroundColor: "white",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  headerRow: {
    backgroundColor: "#004080",
    color: "white",
  },
  headerCell: {
    padding: "12px 10px",
    textAlign: "left",
    fontWeight: "bold",
    border: "1px solid #ccc",
    fontSize: "clamp(0.8rem, 1.5vw, 1rem)",
  },
  headerCellSmall: {
    padding: "12px 8px",
    textAlign: "center",
    fontWeight: "bold",
    border: "1px solid #ccc",
    fontSize: "clamp(0.75rem, 1.5vw, 0.9rem)",
    minWidth: "80px",
  },
  sectionRow: {
    backgroundColor: "#e6eef6",
  },
  sectionTitle: {
    fontWeight: "600",
    color: "#002b5c",
    padding: "12px 10px",
    border: "1px solid #ccc",
    fontSize: "clamp(0.85rem, 1.8vw, 1rem)",
  },
  dataRow: {
    textAlign: "center",
  },
  factorCell: {
    textAlign: "left",
    padding: "10px",
    border: "1px solid #ccc",
    fontSize: "clamp(0.8rem, 1.6vw, 0.95rem)",
  },
  cell: {
    border: "1px solid #ccc",
    padding: "10px",
    fontSize: "clamp(0.8rem, 1.6vw, 0.95rem)",
  },
  select: {
    padding: "0.4rem 0.6rem",
    border: "1px solid #ccc",
    borderRadius: "4px",
    fontSize: "0.9rem",
    cursor: "pointer",
    width: "90%",
    maxWidth: "100px",
  },
  arrowButton: {
    border: "none",
    borderRadius: "4px",
    width: "100%",
    height: "40px",
    cursor: "pointer",
    transition: "all 0.2s",
    backgroundColor: "transparent",
  },
  defaultButton: {
    border: "2px solid #7f8c8d",
    borderRadius: "50%",
    width: "35px",
    height: "35px",
    cursor: "pointer",
    fontSize: "1.2rem",
    transition: "all 0.2s",
  },
};

export default BidDetail;