import React from "react";

function Retroactive() {
  return (
    <div style={styles.page}>
      <h1 style={styles.title}>Retroactive Calculation for Productivity Loss</h1>
      <p style={styles.text}>
        This section will host the retroactive productivity loss calculation tool.
      </p>
    </div>
  );
}

const styles = {
  page: {
    backgroundColor: "#f8fafc",
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    textAlign: "center",
    color: "#333",
  },
  title: {
    fontSize: "1.8rem",
    fontWeight: "600",
    color: "#0d47a1", // 蓝色标题
    marginBottom: "1rem",
  },
  text: {
    fontSize: "1.1rem",
    maxWidth: "600px",
    color: "#555",
  },
};

export default Retroactive;
