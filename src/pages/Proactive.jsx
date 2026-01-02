import React from "react";
import { useNavigate } from "react-router-dom";
import { useProductivity } from "../Productivitycontext";

function Proactive() {
  const navigate = useNavigate();
  const {
    weeks,
    planned,
    setPlanned,
    change,
    setChange,
    factors,
    setFactors,
    revised,
    totalFactors,
    estimatedLoss,
    totalLoss,
    handleReset,
  } = useProductivity();

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Proactive Calculation of Productivity Loss</h2>

      {/* 操作区 */}
      <div style={styles.toolbar}>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button onClick={handleReset} style={styles.resetBtn}>Reset</button>
          <button onClick={() => navigate("/retroactive")} style={styles.switchBtn}>
            Switch to Retroactive →
          </button>
        </div>
        <button style={styles.calculateBtn}>Calculate Productivity Loss</button>
        <div style={styles.totalBox}>Total Loss: <strong>{totalLoss}</strong> hrs</div>
      </div>

      {/* 可滚动表格容器 */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.stickyHeader}>Factors</th>
              {weeks.map((w, i) => (
                <th key={i} style={styles.weekHeader}>{w}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Planned Work Hours */}
            <tr>
              <td style={styles.stickyCell}><strong>Planned Work Hours</strong></td>
              {planned.map((val, i) => (
                <td key={i} style={styles.dataCell}>
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => {
                      const newArr = [...planned];
                      newArr[i] = parseFloat(e.target.value) || 0;
                      setPlanned(newArr);
                    }}
                    style={styles.input}
                  />
                </td>
              ))}
            </tr>

            {/* Change Order Hours */}
            <tr>
              <td style={styles.stickyCell}><strong>Change Order Hours</strong></td>
              {change.map((val, i) => (
                <td key={i} style={styles.dataCell}>
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => {
                      const newArr = [...change];
                      newArr[i] = parseFloat(e.target.value) || 0;
                      setChange(newArr);
                    }}
                    style={styles.input}
                  />
                </td>
              ))}
            </tr>

            {/* Revised Hours */}
            <tr style={styles.revisedRow}>
              <td style={styles.stickyCellRevised}><strong>Revised Hours</strong></td>
              {revised.map((r, i) => (
                <td key={i} style={styles.revisedCell}>{r}</td>
              ))}
            </tr>

            {/* Productivity Factors Header */}
            <tr style={styles.factorHeaderRow}>
              <td style={styles.stickyCell} colSpan={15}>
                <strong>Productivity Factors</strong>
              </td>
            </tr>

            {/* Factors sub-header */}
            <tr style={styles.factorSubHeaderRow}>
              <td style={styles.stickyCell}><strong>Factors</strong></td>
              {weeks.map((_, i) => (
                <td key={i} style={styles.impactHeader}><strong>Impact</strong></td>
              ))}
            </tr>

            {/* Overmanning */}
            <tr>
              <td style={styles.stickyCell}>Overmanning</td>
              {factors.overmanning.map((val, i) => (
                <td key={i} style={styles.dataCell}>
                  <input
                    type="number"
                    step="0.01"
                    value={val}
                    onChange={(e) => {
                      const newFactors = { ...factors };
                      newFactors.overmanning[i] = parseFloat(e.target.value) || 0;
                      setFactors(newFactors);
                    }}
                    style={styles.input}
                  />
                </td>
              ))}
            </tr>

            {/* Stacking of Trades */}
            <tr>
              <td style={styles.stickyCell}>Stacking of Trades</td>
              {factors.stacking.map((val, i) => (
                <td key={i} style={styles.dataCell}>
                  <input
                    type="number"
                    step="0.01"
                    value={val}
                    onChange={(e) => {
                      const newFactors = { ...factors };
                      newFactors.stacking[i] = parseFloat(e.target.value) || 0;
                      setFactors(newFactors);
                    }}
                    style={styles.input}
                  />
                </td>
              ))}
            </tr>

            {/* Overtime 5-10 */}
            <tr>
              <td style={styles.stickyCell}>Overtime 5-10</td>
              {factors.overtime.map((val, i) => (
                <td key={i} style={styles.dataCell}>
                  <input
                    type="number"
                    step="0.01"
                    value={val}
                    onChange={(e) => {
                      const newFactors = { ...factors };
                      newFactors.overtime[i] = parseFloat(e.target.value) || 0;
                      setFactors(newFactors);
                    }}
                    style={styles.input}
                  />
                </td>
              ))}
            </tr>

            {/* Total Factors */}
            <tr style={styles.totalFactorsRow}>
              <td style={styles.stickyCellTotal}><strong>Total Factors</strong></td>
              {totalFactors.map((val, i) => (
                <td key={i} style={styles.totalFactorsCell}>{val.toFixed(2)}</td>
              ))}
            </tr>

            {/* Estimated Loss of Productivity */}
            <tr style={styles.estimatedLossRow}>
              <td style={styles.stickyCellLoss}><strong>Estimated Loss of Productivity</strong></td>
              {estimatedLoss.map((val, i) => (
                <td key={i} style={styles.estimatedLossCell}>{val}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "2rem",
    fontFamily: "Segoe UI, sans-serif",
    backgroundColor: "#f8fafc",
    minHeight: "100vh",
  },
  title: {
    textAlign: "center",
    marginBottom: "1.5rem",
    color: "#002b5c",
    fontSize: "1.8rem",
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
    padding: "0 1rem", // 添加左右内边距
  },
  resetBtn: {
    background: "#c0392b",
    color: "white",
    border: "none",
    borderRadius: "6px",
    padding: "0.6rem 1.2rem",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "500",
  },
  switchBtn: {
    background: "#0d47a1",
    color: "white",
    border: "none",
    borderRadius: "6px",
    padding: "0.6rem 1.2rem",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "500",
  },
  totalBox: {
    background: "#2c3e50",
    color: "white",
    borderRadius: "6px",
    padding: "0.6rem 1.2rem",
    fontSize: "1rem",
  },
  tableWrapper: {
    overflowX: "auto",
    boxShadow: "0 3px 10px rgba(0,0,0,0.1)",
    borderRadius: "8px",
    backgroundColor: "white",
  },
  table: {
    borderCollapse: "collapse",
    width: "100%",
    minWidth: "1200px",
    background: "white",
  },
  stickyHeader: {
    position: "sticky",
    left: 0,
    backgroundColor: "#2d5a3d",
    color: "white",
    padding: "0.8rem",
    textAlign: "center",
    fontWeight: "600",
    border: "1px solid #1e3a28",
    zIndex: 10,
    minWidth: "180px",
  },
  weekHeader: {
    backgroundColor: "#2d5a3d",
    color: "white",
    padding: "0.8rem",
    textAlign: "center",
    fontWeight: "600",
    border: "1px solid #1e3a28",
    minWidth: "100px",
  },
  stickyCell: {
    position: "sticky",
    left: 0,
    backgroundColor: "white",
    padding: "0.6rem 1rem",
    textAlign: "left",
    border: "1px solid #ccc",
    fontWeight: "500",
    zIndex: 5,
    minWidth: "180px",
  },
  stickyCellRevised: {
    position: "sticky",
    left: 0,
    backgroundColor: "#fff3cd",
    padding: "0.6rem 1rem",
    textAlign: "left",
    border: "1px solid #ccc",
    fontWeight: "600",
    zIndex: 5,
    minWidth: "180px",
  },
  stickyCellTotal: {
    position: "sticky",
    left: 0,
    backgroundColor: "#2c3e50",
    color: "#f39c12",
    padding: "0.6rem 1rem",
    textAlign: "left",
    border: "1px solid #1a252f",
    fontWeight: "700",
    zIndex: 5,
    minWidth: "180px",
  },
  stickyCellLoss: {
    position: "sticky",
    left: 0,
    backgroundColor: "#2c3e50",
    color: "#f39c12",
    padding: "0.6rem 1rem",
    textAlign: "left",
    border: "1px solid #1a252f",
    fontWeight: "700",
    zIndex: 5,
    minWidth: "180px",
  },
  dataCell: {
    border: "1px solid #ccc",
    textAlign: "center",
    padding: "0.4rem",
    minWidth: "100px",
  },
  revisedCell: {
    border: "1px solid #ccc",
    textAlign: "center",
    padding: "0.6rem",
    backgroundColor: "#fff3cd",
    fontWeight: "500",
  },
  revisedRow: {
    backgroundColor: "#fff3cd",
  },
  factorHeaderRow: {
    backgroundColor: "#e8e8e8",
  },
  factorSubHeaderRow: {
    backgroundColor: "#d4edda",
  },
  impactHeader: {
    backgroundColor: "#d4edda",
    textAlign: "center",
    padding: "0.6rem",
    border: "1px solid #ccc",
    fontWeight: "600",
  },
  totalFactorsRow: {
    backgroundColor: "#2c3e50",
  },
  totalFactorsCell: {
    border: "1px solid #1a252f",
    textAlign: "center",
    padding: "0.6rem",
    backgroundColor: "#2c3e50",
    color: "#f39c12",
    fontWeight: "700",
  },
  estimatedLossRow: {
    backgroundColor: "#2c3e50",
  },
  estimatedLossCell: {
    border: "1px solid #1a252f",
    textAlign: "center",
    padding: "0.6rem",
    backgroundColor: "#2c3e50",
    color: "#f39c12",
    fontWeight: "700",
  },
  input: {
    width: "90%",
    padding: "0.4rem",
    borderRadius: "4px",
    border: "1px solid #ccc",
    textAlign: "center",
  },
  calculateBtn: {
    background: "#0d47a1",
    color: "white",
    border: "none",
    borderRadius: "6px",
    padding: "0.6rem 1.2rem",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "500",
  },
};

export default Proactive;