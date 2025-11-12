import React from "react";
import { Link } from "react-router-dom";

function ProTool() {
  return (
    <div style={styles.page}>
      {/* 主标题 */}
      <h1 style={styles.title}>
        FACTORS AFFECTING LABOR PRODUCTIVITY <br /> FOR ELECTRICAL CONTRACTORS
      </h1>

      {/* 副标题 */}
      <h2 style={styles.subtitle}>
        <em>A Quantified Statistical Approach</em>
      </h2>

      {/* 按钮区 */}
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
  );
}

// ========================= 样式 =========================
const styles = {
  page: {
    backgroundColor: "#fff",
    color: "#111",
    fontFamily: "Georgia, 'Times New Roman', serif",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
  },
  title: {
    fontSize: "1.8rem",
    fontWeight: "600",
    marginBottom: "0.6rem",
    letterSpacing: "0.5px",
  },
  subtitle: {
    fontSize: "1.2rem",
    fontWeight: "400",
    fontStyle: "italic",
    color: "#333",
    marginBottom: "3rem",
  },
  buttonContainer: {
    display: "flex",
    gap: "2rem",
  },
  redButton: {
    background: "linear-gradient(145deg, #e53935, #c62828)",
    color: "white",
    border: "none",
    padding: "1.2rem 1.8rem",
    fontSize: "1rem",
    fontWeight: "600",
    borderRadius: "4px",
    boxShadow: "6px 6px 10px rgba(0,0,0,0.2)",
    cursor: "pointer",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  },
  blueButton: {
    background: "linear-gradient(145deg, #0d47a1, #002171)",
    color: "white",
    border: "none",
    padding: "1.2rem 1.8rem",
    fontSize: "1rem",
    fontWeight: "600",
    borderRadius: "4px",
    boxShadow: "6px 6px 10px rgba(0,0,0,0.25)",
    cursor: "pointer",
    transition: "transform 0.2s ease, box-shadow 0.2s ease",
  },
  buttonHover: {
    transform: "translateY(-2px)",
    boxShadow: "8px 8px 15px rgba(0,0,0,0.3)",
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


};

export default ProTool;
