import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home.jsx";
import BidTool from "./pages/BidTool.jsx";
import ProTool from "./pages/ProTool.jsx";
import Factors from "./pages/Factors.jsx";
import Proactive from "./pages/Proactive.jsx"
import Retroactive from "./pages/Retroactive.jsx"


function App() {
  return (
    <Router>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>HannaLab Project Intelligence Suite</h1>
          <nav style={styles.nav}>
            <Link to="/" style={styles.link}>Home</Link>
            <Link to="/bid" style={styles.link}>BID Tool</Link>
            <Link to="/pro" style={styles.link}>Productivity Tool</Link>
          </nav>
        </header>

        <main style={styles.main}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/bid" element={<BidTool />} />
            <Route path="/pro" element={<ProTool />} />
            <Route path="/factors" element={<Factors />} />
            <Route path="/proactive" element={<Proactive />} />
            <Route path="/retroactive" element={<Retroactive />} />

          </Routes>
        </main>

        <footer style={styles.footer}>
          <p>© 2025 Dr. Hanna's Lab - Civil & Environmental Engineering, UW-Madison.</p>
        </footer>
      </div>
    </Router>
  );
}


const styles = {
  container: {
    fontFamily: "Segoe UI, Arial, sans-serif",
    backgroundColor: "#f7f9fb",
    color: "#333",
    minHeight: "100vh",
    minWidth: "100vw",  // 添加这行
    display: "flex",
    flexDirection: "column",
    margin: 0,          // 添加这行
    padding: 0,         // 添加这行
  },
  header: {
    backgroundColor: "#002b5c",
    color: "white",
    padding: "1.2rem 2.5rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 2px 5px rgba(0,0,0,0.15)",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 600,
    margin: 0,
  },
  nav: {
    display: "flex",
    gap: "2rem",
  },
  link: {
    color: "white",
    textDecoration: "none",
    fontWeight: 500,
  },
  main: {
    flex: 1,
    padding: "2.5rem",
  },
  footer: {
    backgroundColor: "#002b5c",
    color: "white",
    textAlign: "center",
    padding: "1.2rem",
    fontSize: "0.9rem",
    marginTop: "auto",
  },
};

export default App;
