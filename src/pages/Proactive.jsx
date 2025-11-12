import React, { useState } from "react";

function Proactive() {
  // 周次
  const [weeks] = useState(["Week 10", "Week 11", "Week 12", "Week 13", "Week 14"]);

  // 工作小时输入
  const [planned, setPlanned] = useState([1400, 1700, 2200, 1800, 2800]);
  const [change, setChange] = useState([200, 0, 0, 0, 0]);

  // 各因素影响
  const [factors, setFactors] = useState({
    overmanning: [0.22, 0, 0, 0.22, 0],
    stacking: [0.28, 0, 0.24, 0, 0],
    overtime: [0.05, 0.05, 0, 0, 0],
  });

  // 计算 revised hours
  const revised = planned.map((p, i) => p + change[i]);

  // 计算 total factor per week
  const totalFactors = weeks.map((_, i) =>
    Object.values(factors).reduce((sum, arr) => sum + (arr[i] || 0), 0)
  );

  // 计算 estimated productivity loss per week
  const estimatedLoss = revised.map((r, i) => (r * totalFactors[i]).toFixed(2));

  // 汇总 total loss
  const totalLoss = estimatedLoss.reduce((sum, val) => sum + parseFloat(val), 0).toFixed(2);

  // Reset 全清空
  const handleReset = () => {
    setPlanned(Array(5).fill(0));
    setChange(Array(5).fill(0));
    setFactors({
      overmanning: Array(5).fill(0),
      stacking: Array(5).fill(0),
      overtime: Array(5).fill(0),
    });
  };

  // 渲染表格
  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Proactive Calculation of Productivity Loss</h2>

      {/* 操作区 */}
      <div style={styles.toolbar}>
        <button onClick={handleReset} style={styles.resetBtn}>Reset</button>
        <div style={styles.totalBox}>Total Loss: <strong>{totalLoss}</strong> hrs</div>
      </div>

      {/* 表格 */}
      <table style={styles.table}>
        <thead>
          <tr>
            <th>Factors</th>
            {weeks.map((w, i) => <th key={i}>{w}</th>)}
          </tr>
        </thead>

        <tbody>
          <tr>
            <td><strong>Planned Work Hours</strong></td>
            {planned.map((val, i) => (
              <td key={i}>
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

          <tr>
            <td><strong>Change Order Hours</strong></td>
            {change.map((val, i) => (
              <td key={i}>
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

          <tr>
            <td><strong>Revised Hours</strong></td>
            {revised.map((r, i) => <td key={i}>{r}</td>)}
          </tr>

          <tr><td colSpan={6}><strong>Productivity Factors</strong></td></tr>

          {Object.keys(factors).map((name) => (
            <tr key={name}>
              <td>{name.charAt(0).toUpperCase() + name.slice(1)}</td>
              {factors[name].map((val, i) => (
                <td key={i}>
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => {
                      const newFactors = { ...factors };
                      newFactors[name][i] = parseFloat(e.target.value) || 0;
                      setFactors(newFactors);
                    }}
                    style={styles.input}
                  />
                </td>
              ))}
            </tr>
          ))}

          <tr>
            <td><strong>Total Factors</strong></td>
            {totalFactors.map((val, i) => <td key={i}>{val.toFixed(2)}</td>)}
          </tr>

          <tr>
            <td><strong>Estimated Loss of Productivity</strong></td>
            {estimatedLoss.map((val, i) => <td key={i}>{val}</td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const styles = {
  container: { padding: "2rem", fontFamily: "Segoe UI, sans-serif" },
  title: { textAlign: "center", marginBottom: "1.5rem", color: "#002b5c" },
  toolbar: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: "1rem",
  },
  resetBtn: {
    background: "#c0392b", color: "white", border: "none", borderRadius: "6px",
    padding: "0.6rem 1.2rem", cursor: "pointer",
  },
  totalBox: {
    background: "#f1f1f1", borderRadius: "6px", padding: "0.6rem 1.2rem",
  },
  table: {
    borderCollapse: "collapse", width: "100%", background: "white", boxShadow: "0 0 6px rgba(0,0,0,0.1)"
  },
  input: {
    width: "90%", padding: "0.4rem", borderRadius: "4px", border: "1px solid #ccc",
  },
};

export default Proactive;
