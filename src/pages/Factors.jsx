import React from "react";

function Factors() {
  const data = [
    { id: 1, factor: "Overtime (5-10 hours/day, 5-6 days/week)", low: "5%", med: "20%", high: "30%" },
    { id: 2, factor: "Stacking of Trades", low: "24%", med: "28%", high: "32%" },
    { id: 3, factor: "Access Constraints", low: "17%", med: "25%", high: "32%" },
    { id: 4, factor: "Loss of Learning", low: "12%", med: "20%", high: "28%" },
  ];

  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Labor Productivity Factors</h1>
      <p style={styles.desc}>
        Input or review quantified factors affecting labor productivity for electrical contractors.
      </p>

      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.header}>#</th>
              <th style={styles.header}>Factor</th>
              <th style={styles.header}>Low Impact</th>
              <th style={styles.header}>Medium Impact</th>
              <th style={styles.header}>High Impact</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id}>
                <td style={styles.cell}>{row.id}</td>
                <td style={styles.factor}>{row.factor}</td>
                <td style={styles.cell}>{row.low}</td>
                <td style={styles.cell}>{row.med}</td>
                <td style={styles.cell}>{row.high}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  page: {
    backgroundColor: "#f8fafc",
    minHeight: "100vh",
    padding: "2rem",
    fontFamily: "Segoe UI, Arial, sans-serif",
    color: "#333",
  },
  title: {
    textAlign: "center",
    color: "#002b5c",
    fontSize: "1.8rem",
    fontWeight: "600",
    marginBottom: "0.5rem",
  },
  desc: {
    textAlign: "center",
    color: "#555",
    marginBottom: "2rem",
  },
  tableWrapper: {
    overflowX: "auto",
    maxWidth: "900px",
    margin: "0 auto",
  },
  table: {
    borderCollapse: "collapse",
    width: "100%",
    backgroundColor: "white",
    boxShadow: "0 3px 10px rgba(0,0,0,0.1)",
  },
  header: {
    backgroundColor: "#003366",
    color: "white",
    padding: "0.8rem",
    textAlign: "center",
    fontWeight: "600",
  },
  cell: {
    border: "1px solid #ccc",
    textAlign: "center",
    padding: "0.6rem",
  },
  factor: {
    border: "1px solid #ccc",
    textAlign: "left",
    padding: "0.6rem 1rem",
  },
};

export default Factors;
