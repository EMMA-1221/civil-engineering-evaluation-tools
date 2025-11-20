import React from "react";
import { HashRouter as Router, Routes, Route, Link, useNavigate } from "react-router-dom";
import Home from "./pages/Home.jsx";
import BidTool from "./pages/BidTool.jsx";
import ProTool from "./pages/ProTool.jsx";
import Factors from "./pages/Factors.jsx";
import Proactive from "./pages/Proactive.jsx";
import Retroactive from "./pages/Retroactive.jsx";
import Login from "./pages/Login.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>HannaLab Project Intelligence Suite</h1>
        <nav style={styles.nav}>
          <Link to="/" style={styles.link}>Home</Link>
          <Link to="/bid" style={styles.link}>BID Tool</Link>
          <Link to="/pro" style={styles.link}>Productivity Tool</Link>
          
          {user ? (
            <div style={styles.userSection}>
              <div style={styles.userInfo}>
                <span style={styles.username}>👤 {user.username}</span>
                <span style={styles.userEmail}>{user.email}</span>
              </div>
              <button onClick={handleLogout} style={styles.logoutBtn}>
                Logout
              </button>
            </div>
          ) : (
            <Link to="/login" style={styles.loginLink}>Login</Link>
          )}
        </nav>
      </header>

      <main style={styles.main}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Home />} />
          
          <Route 
            path="/bid" 
            element={
              <ProtectedRoute>
                <BidTool />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/pro" 
            element={
              <ProtectedRoute>
                <ProTool />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/factors" 
            element={
              <ProtectedRoute>
                <Factors />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/proactive" 
            element={
              <ProtectedRoute>
                <Proactive />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/retroactive" 
            element={
              <ProtectedRoute>
                <Retroactive />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </main>

      <footer style={styles.footer}>
        <p>© 2025 Dr. Hanna's Lab - Civil & Environmental Engineering, UW-Madison.</p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "Segoe UI, Arial, sans-serif",
    backgroundColor: "#f7f9fb",
    color: "#333",
    minHeight: "100vh",
    minWidth: "100vw",
    display: "flex",
    flexDirection: "column",
    margin: 0,
    padding: 0,
  },
  header: {
    backgroundColor: "#002b5c",
    color: "white",
    padding: "1.2rem 2.5rem",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: "0 2px 5px rgba(0,0,0,0.15)",
    flexWrap: "wrap",
    gap: "1rem",
  },
  title: {
    fontSize: "1.5rem",
    fontWeight: 600,
    margin: 0,
  },
  nav: {
    display: "flex",
    gap: "2rem",
    alignItems: "center",
    flexWrap: "wrap",
  },
  link: {
    color: "white",
    textDecoration: "none",
    fontWeight: 500,
    transition: "opacity 0.2s",
  },
  loginLink: {
    color: "white",
    textDecoration: "none",
    fontWeight: 600,
    backgroundColor: "#1565c0",
    padding: "0.5rem 1.2rem",
    borderRadius: "6px",
    transition: "background-color 0.2s",
  },
  userSection: {
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  },
  userInfo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
  },
  username: {
    color: "white",
    fontSize: "0.95rem",
    fontWeight: 600,
  },
  userEmail: {
    color: "#b3d4fc",
    fontSize: "0.8rem",
    fontWeight: 400,
  },
  logoutBtn: {
    backgroundColor: "#d32f2f",
    color: "white",
    border: "none",
    padding: "0.5rem 1rem",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 500,
    fontSize: "0.9rem",
    transition: "background-color 0.2s",
  },
  main: {
    flex: 1,
    padding: "2.5rem",
    maxWidth: "1400px",
    width: "100%",
    margin: "0 auto",
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