import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Container, Row, Col, Card, Button } from "react-bootstrap";

function Home() {
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;

  return (
    <div style={styles.pageWrapper}>
      <Container style={{ paddingTop: "3rem", paddingBottom: "3rem" }}>

        {/* ---------- Title ---------- */}
        <h2 style={styles.heroTitle}>
          Data-Driven Insights for Smarter Construction Decisions
        </h2>

        <p style={styles.heroText}>
          A collection of analytical tools developed by <strong>HCG WAY</strong>  
          to support advanced decision making in complex construction projects.
        </p>

        {/* ---------- Login / Welcome ---------- */}
        {!user ? (
          <div style={styles.alertBoxYellow}>
            🔒 Please <Link to="/login" style={styles.alertLink}>login</Link> to access all tools.
          </div>
        ) : (
          <div style={styles.alertBoxGreen}>
            👋 Welcome back, <strong>{user.username}</strong>! You have full access to all tools.
          </div>
        )}

        {/* ---------- Cards Row ---------- */}
        <Row className="mt-5 g-4">

          {/* ---------------- BID CARD ---------------- */}
          <Col xs={12} md={6}>
            <Card style={styles.metalCard} className="shadow-lg">
              <Card.Body>
                <div style={styles.cardHeader}>
                  <span style={styles.cardIcon}>📊</span>
                  <Card.Title style={styles.cardTitle}>To BID or Not to BID?</Card.Title>
                </div>

                <Card.Text style={styles.cardText}>
                  Analyze bid factors including design relationships, risk, and preparedness  
                  to guide data-informed project bidding.
                </Card.Text>

                <Button
                  as={Link}
                  to="/bid"
                  style={styles.metalButton}
                >
                  {user ? "Open Tool →" : "Login to Access →"}
                </Button>
              </Card.Body>
            </Card>
          </Col>

          {/* ---------------- PRODUCTIVITY CARD ---------------- */}
          <Col xs={12} md={6}>
            <Card style={styles.metalCard} className="shadow-lg">
              <Card.Body>
                <div style={styles.cardHeader}>
                  <span style={styles.cardIcon}>⚡</span>
                  <Card.Title style={styles.cardTitle}>
                    FACTORS AFFECTING LABOR PRODUCTIVITY<br />
                    FOR ELECTRICAL CONTRACTORS
                  </Card.Title>
                </div>

                <Card.Subtitle style={styles.cardSubtitle}>
                  <em>A Quantified Statistical Approach</em>
                </Card.Subtitle>

                <Button as={Link} to="/factors" style={styles.metalButtonBlue} className="mt-3">
                  Input Your Factors →
                </Button>

                <div className="d-grid gap-3 mt-4">
                  <Button as={Link} to="/proactive" style={styles.redButton}>
                    Proactive Calculation for Productivity Loss
                  </Button>
                  <Button as={Link} to="/retroactive" style={styles.blueButton}>
                    Retroactive Calculation for Productivity Loss
                  </Button>
                </div>

              </Card.Body>
            </Card>
          </Col>

        </Row>
      </Container>
    </div>
  );
}

const styles = {
  /* ---------------- Background ---------------- */
  pageWrapper: {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #e8f1fb 0%, #c5d4ea 100%)",
  },

  /* ---------------- Title ---------------- */
  heroTitle: {
    fontFamily: "'Exo 2', sans-serif",
    fontSize: "2rem",
    fontWeight: "700",
    textAlign: "center",
    color: "#002b5c",
  },
  heroText: {
    maxWidth: "720px",
    margin: "0 auto",
    textAlign: "center",
    color: "#444",
  },

  /* ---------------- Alerts ---------------- */
  alertBoxYellow: {
    background: "#fff8d5",
    border: "1px solid #ffda6b",
    borderRadius: "10px",
    padding: "1rem",
    maxWidth: "600px",
    margin: "2rem auto",
    textAlign: "center",
  },
  alertBoxGreen: {
    background: "#d4f5dc",
    border: "1px solid #57c27e",
    borderRadius: "10px",
    padding: "1rem",
    maxWidth: "600px",
    margin: "2rem auto",
    textAlign: "center",
  },
  alertLink: {
    fontWeight: "700",
    color: "#002b5c",
    textDecoration: "underline",
  },

  /* ---------------- Chrome Metal Card ---------------- */
  metalCard: {
    borderRadius: "16px",
    padding: "1rem",
    background: `
      linear-gradient(160deg,
        rgba(255,255,255,0.95) 0%,
        rgba(230,230,230,0.75) 40%,
        rgba(255,255,255,0.95) 60%,
        rgba(180,180,180,0.65) 100%
      )
    `,
    backdropFilter: "blur(6px)",
    border: "1px solid rgba(255,255,255,0.7)",
    boxShadow:
      "inset 0 0 25px rgba(255,255,255,0.35), 0 10px 25px rgba(0,0,0,0.15)",
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
    cursor: "pointer",
  },

  /* ---------------- Inside Card ---------------- */
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.7rem",
    marginBottom: "1rem",
  },
  cardIcon: { fontSize: "2rem" },
  cardTitle: {
    fontFamily: "'Exo 2', sans-serif",
    fontSize: "1.3rem",
    fontWeight: "700",
    color: "#0a2540",
  },
  cardText: {
    color: "#444",
    fontSize: "1rem",
    marginBottom: "1.5rem",
  },
  cardSubtitle: {
    color: "#555",
    textAlign: "center",
    marginTop: "0.5rem",
  },

  /* ---------------- Buttons ---------------- */
  metalButton: {
    background: "linear-gradient(90deg, #0a3d91, #0d4dbd)",
    border: "none",
    padding: "0.6rem 1.2rem",
    fontWeight: "600",
  },
  metalButtonBlue: {
    background: "linear-gradient(90deg, #003f9a, #0057d8)",
    border: "none",
    padding: "0.6rem",
    fontWeight: "600",
  },

  redButton: {
    background: "#c0392b",
    border: "none",
    padding: "0.8rem",
    fontWeight: "600",
  },
  blueButton: {
    background: "#0a3d91",
    border: "none",
    padding: "0.8rem",
    fontWeight: "600",
  },
};

export default Home;
