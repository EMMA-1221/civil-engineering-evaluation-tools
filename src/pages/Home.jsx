import React from "react";
import { Link } from "react-router-dom";

function Home() {
  return (
    <div style={styles.page}>
      {/* 顶部介绍 */}
      <h2 style={styles.heroTitle}>
        Data-Driven Insights for Smarter Construction Decisions
      </h2>
      <p style={styles.heroText}>
        A collection of analytical tools developed by <strong>Dr. Hanna’s Civil Engineering Research Group</strong> 
        to support bid evaluation and productivity performance analysis in complex construction projects.
      </p>

      {/* --- 工具卡区域 --- */}
      <div style={styles.toolContainer}>
        {/* --- BID Tool --- */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>BID Evaluation Tool</h3>
          <p style={styles.cardText}>
            Analyze bid factors including design relationships, risk, and preparedness 
            to guide data-informed project bidding.
          </p>
          <Link to="/bid" style={styles.button}>Open Tool →</Link>
        </div>

        {/* --- Productivity Tool --- */}
        <div style={styles.proSection}>
          <h1 style={styles.proTitle}>
            FACTORS AFFECTING LABOR PRODUCTIVITY <br /> FOR ELECTRICAL CONTRACTORS
          </h1>
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

// ================== 样式 ==================
const styles = {
inputButton: {
  display: "inline-block",
  backgroundColor: "#004080",
  color: "white",
  padding: "0.6rem 1.2rem",
  borderRadius: "6px",
  textDecoration: "none",
  fontWeight: "500",
  boxShadow: "4px 4px 10px rgba(0,0,0,0.2)",
  marginBottom: "1.5rem",
  transition: "all 0.2s ease",
},

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
    margin: "0 auto 3rem auto",
  },

  // 横向卡片容器
  toolContainer: {
    display: "flex",
    justifyContent: "center",
    alignItems: "stretch",
    gap: "2.5rem",
    flexWrap: "wrap", // 屏幕太小会自动换行
  },

  // BID Tool
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
  cardTitle: {
    fontSize: "1.3rem",
    color: "#002b5c",
    marginBottom: "0.6rem",
  },
  cardText: {
    fontSize: "1rem",
    color: "#555",
    marginBottom: "1rem",
  },
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#002b5c",
    color: "white",
    padding: "0.6rem 1.2rem",
    borderRadius: "6px",
    textDecoration: "none",
    fontWeight: "500",
  },

  // Productivity Tool
  proSection: {
    flex: "1 1 600px",
    backgroundColor: "#fff",
    padding: "2rem",
    borderRadius: "12px",
    boxShadow: "0 6px 16px rgba(0,0,0,0.1)",
    maxWidth: "650px",
  },
  proTitle: {
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: "1.3rem",
    fontWeight: "600",
    letterSpacing: "0.5px",
    marginBottom: "0.5rem",
  },
  proSubtitle: {
    fontSize: "1rem",
    color: "#444",
    marginBottom: "2rem",
  },
  proButtons: {
    display: "flex",
    justifyContent: "center",
    gap: "1.5rem",
    flexWrap: "wrap",
  },
  
  buttonRow: {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  flexWrap: "wrap",          // 窄屏时自动换行，不会重叠
  gap: "1.5rem",             // 按钮之间的距离
  marginTop: "2rem",
},

factorButton: {
  backgroundColor: "#0a3d91",
  color: "white",
  padding: "1rem 1.8rem",
  borderRadius: "8px",
  textDecoration: "none",
  fontWeight: "600",
  boxShadow: "4px 4px 10px rgba(0,0,0,0.15)",
},

redButton: {
  backgroundColor: "#c0392b",
  color: "white",
  padding: "1rem 1.8rem",
  borderRadius: "8px",
  textDecoration: "none",
  fontWeight: "600",
  boxShadow: "4px 4px 10px rgba(0,0,0,0.15)",
},

blueButton: {
  backgroundColor: "#0a3d91",
  color: "white",
  padding: "1rem 1.8rem",
  borderRadius: "8px",
  textDecoration: "none",
  fontWeight: "600",
  boxShadow: "4px 4px 10px rgba(0,0,0,0.15)",
},

};

export default Home;
