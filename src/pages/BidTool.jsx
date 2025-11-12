import React from "react";

function BidTool() {
  const sections = [
    { id: 1, title: "Section 1: Relationship with the Design Engineer(s)" },
    { id: 2, title: "Section 2: Relationship with the Owner / Construction Manager / General Contractor" },
    { id: 3, title: "Section 3: Bid Preparation Time Frame" },
    { id: 4, title: "Section 4: Competition" },
    { id: 5, title: "Section 5: Assessed Risk Factors" },
    { id: 6, title: "Section 6: Geographical Location" },
    { id: 7, title: "Section 7: Project Management" },
    { id: 8, title: "Section 8: Contractual Obligations" },
    { id: 9, title: "Section 9: Anticipated Productivity Factors" },
  ];

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>BID Evaluation Tool</h1>
      <p style={styles.desc}>
        This tool assists in evaluating bid-related factors, relationships, and project readiness.
      </p>

      {/* --- 控制区 --- */}
      <div style={styles.controls}>
        <button style={styles.resetButton}>Reset</button>
        <div style={styles.scoreBox}>
          <p style={styles.scoreLabel}>Your Score</p>
          <p style={styles.scoreValue}>100</p>
        </div>
        <button style={styles.updateButton}>Update</button>
      </div>

      {/* --- 表格内容 --- */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.headerRow}>
              <th style={styles.headerCell}>Factors</th>
              <th style={styles.headerCell}>Yes/No</th>
              <th style={styles.headerCell}>Value</th>
              <th style={styles.headerCell}>Increase</th>
              <th style={styles.headerCell}>Decrease</th>
              <th style={styles.headerCell}>Default</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((s) => (
              <React.Fragment key={s.id}>
                <tr style={styles.sectionRow}>
                  <td colSpan="6" style={styles.sectionTitle}>{s.title}</td>
                </tr>
                <tr style={styles.dataRow}>
                  <td style={styles.factorCell}>Example question text...</td>
                  <td style={styles.cell}> </td>
                  <td style={styles.cell}> </td>
                  <td style={styles.cell}>🔺</td>
                  <td style={styles.cell}>🔻</td>
                  <td style={styles.cell}>⚪</td>
                </tr>
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ========================= 样式 =========================
const styles = {
  page: {
    backgroundColor: "#f8fafc",
    padding: "2rem",
    fontFamily: "Segoe UI, Arial, sans-serif",
    color: "#333",
  },
  title: {
    textAlign: "center",
    color: "#002b5c",
    marginBottom: "0.3rem",
  },
  desc: {
    textAlign: "center",
    color: "#555",
    marginBottom: "1.5rem",
  },
  controls: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "2rem",
    marginBottom: "2rem",
  },
  resetButton: {
    backgroundColor: "#e74c3c",
    color: "white",
    border: "none",
    padding: "0.6rem 1.2rem",
    borderRadius: "8px",
    fontSize: "1rem",
    cursor: "pointer",
  },
  updateButton: {
    backgroundColor: "#27ae60",
    color: "white",
    border: "none",
    padding: "0.6rem 1.2rem",
    borderRadius: "8px",
    fontSize: "1rem",
    cursor: "pointer",
  },
  scoreBox: {
    backgroundColor: "#004080",
    color: "white",
    borderRadius: "10px",
    padding: "0.5rem 1.5rem",
    textAlign: "center",
    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
  },
  scoreLabel: {
    margin: 0,
    fontSize: "0.9rem",
    letterSpacing: "0.5px",
  },
  scoreValue: {
    margin: 0,
    fontSize: "1.6rem",
    fontWeight: "700",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    borderCollapse: "collapse",
    width: "100%",
    backgroundColor: "white",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  headerRow: {
    backgroundColor: "#004080",
    color: "white",
  },
  headerCell: {
    padding: "10px",
    textAlign: "center",
    fontWeight: "bold",
    border: "1px solid #ccc",
  },
  sectionRow: {
    backgroundColor: "#e6eef6",
  },
  sectionTitle: {
    fontWeight: "600",
    color: "#002b5c",
    padding: "10px",
    border: "1px solid #ccc",
  },
  dataRow: {
    textAlign: "center",
  },
  factorCell: {
    textAlign: "left",
    padding: "10px",
    border: "1px solid #ccc",
  },
  cell: {
    border: "1px solid #ccc",
    padding: "10px",
  },
};

export default BidTool;
