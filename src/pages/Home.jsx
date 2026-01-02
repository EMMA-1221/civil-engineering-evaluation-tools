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
             Please <Link to="/login" style={styles.alertLink}>login</Link> to access all tools.
          </div>
        ) : (
          <div style={styles.alertBoxGreen}>
           Welcome back, <strong>{user.username}</strong>! You have full access to all tools.
          </div>
        )}

        {/* ---------- Cards Row ---------- */}
        <Row className="mt-5 g-4">

          {/* ---------------- BID CARD ---------------- */}
          <Col xs={12} md={6}>
            <Card style={styles.metalCard} className="shadow-lg">
              <Card.Body>
                <div style={styles.cardHeader}>
                  <span style={styles.cardIcon}></span>
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
                  <span style={styles.cardIcon}></span>
                  <Card.Title style={styles.cardTitle}>
                    FACTORS AFFECTING LABOR PRODUCTIVITY<br />
                    FOR ELECTRICAL CONTRACTORS
                  </Card.Title>
                </div>

                <Card.Subtitle style={styles.cardSubtitle}>
                  <em>A Quantified Statistical Approach</em>
                </Card.Subtitle>

                <Button as={Link} to="/factors" style={styles.metalButtonBlue} className="mt-3">
                  See All Factors →
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
    border: "1px solid #ade2c1ff",
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
  borderRadius: "18px",
  padding: "1.25rem",
  background: `
    linear-gradient(145deg,
      rgba(255,255,255,0.86) 0%,
      rgba(245,250,255,0.70) 35%,
      rgba(230,242,255,0.55) 70%,
      rgba(255,255,255,0.78) 100%
    )
  `,
  position: "relative",
  overflow: "hidden",

  // glass feel
  backdropFilter: "blur(10px) saturate(135%)",
  WebkitBackdropFilter: "blur(10px) saturate(135%)",

  // subtle border that matches the blue UI
  border: "1px solid rgba(120,170,230,0.28)",

  // softer, airier shadow (less “metal block”, more “floating card”)
  boxShadow:
    "0 14px 28px rgba(10, 35, 70, 0.14), 0 4px 10px rgba(10, 35, 70, 0.08)",

  transition: "transform 220ms ease, box-shadow 220ms ease, border-color 220ms ease",
  cursor: "pointer",
},

// hover 时候更“呼吸感”
metalCardHover: {
  transform: "translateY(-4px)",
  borderColor: "rgba(120,170,230,0.45)",
  boxShadow:
    "0 18px 34px rgba(10, 35, 70, 0.18), 0 8px 16px rgba(10, 35, 70, 0.10)",
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
    fontFamily: "'', sans-serif",
    fontSize: "1.3rem",
    fontWeight: "700",
    color: "#0a2540",
  },
  cardText: {
    fontStyle: "italic",
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
