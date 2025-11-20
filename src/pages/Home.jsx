import React from "react";
import { Link } from "react-router-dom";

function Home() {
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;

  return (
    <div style={styles.page}>
      {/* 顶部介绍 */}
      <h2 style={styles.heroTitle}>
        Data-Driven Insights for Smarter Construction Decisions
      </h2>
      <p style={styles.heroText}>
        A collection of analytical tools developed by <strong>Dr. Hanna's Civil Engineering Research Group</strong> 
        to support bid evaluation and productivity performance analysis in complex construction projects.
      </p>

      {/* 登录状态提示 */}
      {!user && (
        <div style={styles.loginPrompt}>
          <p style={styles.promptText}>
            🔒 Please <Link to="/login" style={styles.promptLink}>login</Link> to access all tools and save your data.
          </p>
        </div>
      )}

      {user && (
        <div style={styles.welcomeMessage}>
          <p style={styles.welcomeText}>
            👋 Welcome back, <strong>{user.username}</strong>! You have full access to all tools.
          </p>
        </div>
      )}

      {/* 工具卡片区域 */}
      <div style={styles.toolContainer}>
        {/* BID Tool */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <span style={styles.cardIcon}>📊</span>
            <h3 style={styles.cardTitle}>BID Evaluation Tool</h3>
          </div>
          <p style={styles.cardText}>
            Analyze bid factors including design relationships, risk, and preparedness 
            to guide data-informed project bidding.
          </p>
          <Link to="/bid" style={styles.button}>
            {user ? "Open Tool →" : "Login to Access →"}
          </Link>
        </div>

        {/* Productivity Tool */}
        <div style={styles.proSection}>
          <div style={styles.proHeader}>
            <span style={styles.proIcon}>⚡</span>
            <h1 style={styles.proTitle}>
              FACTORS AFFECTING LABOR PRODUCTIVITY <br /> FOR ELECTRICAL CONTRACTORS
            </h1>
          </div>
          <h2 style={styles.proSubtitle}>
            <em>A Quantified Statistical Approach</em>
          </h2>
          
          <Link to="/factors" style={styles.inputButton}>
            Input Your Factors →
          </Link>
          
          <div style={styles.buttonRow}>
            <Link to="/proactive" style={styles.redButton}>
              Proactive Calculation for Productivity Loss
            </Link>
            <Link to="/retroactive" style={styles.blueButton}>
              Retroactive Calculation for Productivity Loss
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    backgroundColor: "#f8fafc",
    minHeight: "100vh",
    fontFamily: "Segoe UI, Arial, sans-serif",
    color: "#333",
    textAlign: "center",
    padding: "3rem 2rem",
  },
  heroTitle: {
    fontSize: "1.8rem",
    color: "#002b5c",
    fontWeight: "600",
    marginBottom: "1rem",
  },
  heroText: {
    fontSize: "1rem",
    color: "#444",
    maxWidth: "700px",
    margin: "0 auto 2rem auto",
    lineHeight: "1.6",
  },
  
  // 登录提示
  loginPrompt: {
    backgroundColor: "#fff3cd",
    border: "2px solid #ffc107",
    borderRadius: "10px",
    padding: "1rem",
    maxWidth: "600px",
    margin: "0 auto 2rem auto",
  },
  promptText: {
    margin: 0,
    color: "#856404",
    fontSize: "1rem",
    fontWeight: "500",
  },
  promptLink: {
    color: "#002b5c",
    fontWeight: "700",
    textDecoration: "underline",
  },
  
  // 欢迎消息
  welcomeMessage: {
    backgroundColor: "#d4edda",
    border: "2px solid #28a745",
    borderRadius: "10px",
    padding: "1rem",
    maxWidth: "600px",
    margin: "0 auto 2rem auto",
  },
  welcomeText: {
    margin: 0,
    color: "#155724",
    fontSize: "1rem",
    fontWeight: "500",
  },

  // 工具卡片容器
  toolContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "stretch",
    gap: "2.5rem",
    flexWrap: "wrap",
    marginTop: "2rem",
  },

  // BID Tool 卡片
  card: {
    flex: "1 1 420px",
    background: "white",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    borderRadius: "12px",
    padding: "2rem",
    textAlign: "left",
    maxWidth: "480px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "0.8rem",
    marginBottom: "1rem",
  },
  cardIcon: {
    fontSize: "2rem",
  },
  cardTitle: {
    fontSize: "1.3rem",
    color: "#002b5c",
    margin: 0,
  },
  cardText: {
    fontSize: "1rem",
    color: "#555",
    marginBottom: "1.5rem",
    lineHeight: "1.6",
  },
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#002b5c",
    color: "white",
    padding: "0.7rem 1.4rem",
    borderRadius: "6px",
    textDecoration: "none",
    fontWeight: "600",
    transition: "background-color 0.2s",
  },

  // Productivity Tool 区域
  proSection: {
    flex: "1 1 600px",
    backgroundColor: "#fff",
    padding: "2rem",
    borderRadius: "12px",
    boxShadow: "0 6px 16px rgba(0,0,0,0.1)",
    maxWidth: "650px",
  },
  proHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "1rem",
    marginBottom: "1rem",
  },
  proIcon: {
    fontSize: "2.5rem",
  },
  proTitle: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: "1.3rem",
    fontWeight: "600",
    letterSpacing: "0.5px",
    margin: 0,
  },
  proSubtitle: {
    fontSize: "1rem",
    color: "#444",
    marginBottom: "2rem",
  },
  
  inputButton: {
    display: "inline-block",
    backgroundColor: "#004080",
    color: "white",
    padding: "0.7rem 1.4rem",
    borderRadius: "6px",
    textDecoration: "none",
    fontWeight: "600",
    boxShadow: "4px 4px 10px rgba(0,0,0,0.2)",
    marginBottom: "1.5rem",
    transition: "all 0.2s ease",
  },
  
  buttonRow: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "1.5rem",
    marginTop: "1rem",
  },

  redButton: {
    backgroundColor: "#c0392b",
    color: "white",
    padding: "1rem 1.6rem",
    borderRadius: "8px",
    textDecoration: "none",
    fontWeight: "600",
    boxShadow: "4px 4px 10px rgba(0,0,0,0.15)",
    transition: "background-color 0.2s",
  },

  blueButton: {
    backgroundColor: "#0a3d91",
    color: "white",
    padding: "1rem 1.6rem",
    borderRadius: "8px",
    textDecoration: "none",
    fontWeight: "600",
    boxShadow: "4px 4px 10px rgba(0,0,0,0.15)",
    transition: "background-color 0.2s",
  },
};

export default Home;