import React from "react";
import { useNavigate } from "react-router-dom";

function ProTool() {
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>📊 Productivity Loss Analysis Tool</h1>
        <p style={styles.subtitle}>
          Analyze and calculate productivity losses in your construction projects
        </p>
      </div>

      <div style={styles.content}>
        {/* New Project Button */}
        <div style={styles.actionSection}>
          <button 
            onClick={() => navigate("/productivity-losses")} 
            style={styles.newProjectBtn}
          >
            📁 My Productivity Loss Projects
          </button>
        </div>

        {/* Tool Options */}
        <div style={styles.toolGrid}>
          {/* Unified Productivity Analysis Card */}
          <div style={styles.cardLarge}>
            <div style={styles.cardIcon}>📊</div>
            <h3 style={styles.cardTitle}>Productivity Analysis</h3>
            <p style={styles.cardDescription}>
              Calculate productivity losses with both Proactive and Retroactive methods. Switch between analysis modes seamlessly with shared input data.
            </p>
            <button 
              onClick={() => navigate("/productivity-analysis")} 
              style={styles.cardButton}
            >
              Start Analysis →
            </button>
          </div>

          {/* Factors Card */}
          <div style={styles.card}>
            <div style={styles.cardIcon}>⚙️</div>
            <h3 style={styles.cardTitle}>Impact Factors</h3>
            <p style={styles.cardDescription}>
              Review and understand the various factors that impact construction productivity
            </p>
            <button 
              onClick={() => navigate("/factors")} 
              style={styles.cardButton}
            >
              View Impact Factors →
            </button>
          </div>
        </div>

        {/* Info Section */}
        <div style={styles.infoSection}>
          <h3 style={styles.infoTitle}>How to Use This Tool</h3>
          <ol style={styles.infoList}>
            <li>Create a new project or select an existing one from "My Productivity Loss Projects"</li>
            <li>Open the Productivity Analysis tool</li>
            <li>Switch between Proactive and Retroactive tabs as needed - your data is shared between both modes</li>
            <li>Input your project data including work hours and impact factors</li>
            <li>Review the calculated productivity losses and generate reports</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    backgroundColor: "#f8fafc",
    paddingBottom: "3rem",
  },
  header: {
    background: "linear-gradient(135deg, #001f4b 0%, #115395ff 50%, #1c69a9ff 100%)",
    color: "white",
    padding: "3rem 2rem",
    textAlign: "center",
  },
  title: {
    fontSize: "2.5rem",
    fontWeight: "700",
    marginBottom: "1rem",
    fontFamily: "'Orbitron', sans-serif",
  },
  subtitle: {
    fontSize: "1.1rem",
    opacity: 0.9,
  },
  content: {
    maxWidth: "1400px",
    margin: "0 auto",
    padding: "2rem",
  },
  actionSection: {
    textAlign: "center",
    marginBottom: "3rem",
  },
  newProjectBtn: {
    background: "linear-gradient(135deg, #3498db 0%, #2980b9 100%)",
    color: "white",
    border: "none",
    borderRadius: "12px",
    padding: "1rem 2.5rem",
    fontSize: "1.2rem",
    fontWeight: "600",
    cursor: "pointer",
    boxShadow: "0 4px 15px rgba(52, 152, 219, 0.3)",
    transition: "all 0.3s ease",
  },
  toolGrid: {
    display: "grid",
    gridTemplateColumns: "2fr 1fr",
    gap: "2rem",
    marginBottom: "3rem",
  },
  cardLarge: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "2.5rem",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
  },
  card: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "2rem",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
    transition: "transform 0.3s ease, box-shadow 0.3s ease",
  },
  cardIcon: {
    fontSize: "3rem",
    marginBottom: "1rem",
  },
  cardTitle: {
    fontSize: "1.5rem",
    fontWeight: "600",
    color: "#002b5c",
    marginBottom: "1rem",
  },
  cardDescription: {
    fontSize: "1rem",
    color: "#666",
    lineHeight: "1.6",
    marginBottom: "1.5rem",
  },
  cardButton: {
    background: "#0d47a1",
    color: "white",
    border: "none",
    borderRadius: "8px",
    padding: "0.75rem 1.5rem",
    fontSize: "1rem",
    fontWeight: "600",
    cursor: "pointer",
    width: "100%",
    transition: "background 0.3s ease",
  },
  infoSection: {
    backgroundColor: "white",
    borderRadius: "12px",
    padding: "2rem",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
  },
  infoTitle: {
    fontSize: "1.5rem",
    fontWeight: "600",
    color: "#002b5c",
    marginBottom: "1rem",
  },
  infoList: {
    fontSize: "1rem",
    color: "#666",
    lineHeight: "2",
    paddingLeft: "1.5rem",
  },
};

export default ProTool;