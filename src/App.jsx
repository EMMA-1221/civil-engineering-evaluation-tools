import React, { useState } from "react";
import { HashRouter as Router, Routes, Route, Link, useNavigate } from "react-router-dom";
import { Navbar, Nav, Container, Dropdown, Button } from "react-bootstrap";
import BidList from "./pages/BidList.jsx";
import BidDetail from "./pages/BidDetail.jsx";
import Home from "./pages/Home.jsx";
import { ProductivityProvider, AuthProvider } from './Productivitycontext';
import ProTool from "./pages/ProTool.jsx";
import Factors from "./pages/Factors.jsx";
import ProductivityAnalysis from "./pages/ProductivityAnalysis.jsx"; // 新的统一页面
import Login from "./pages/Login.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import ProductivityLossList from './pages/Productivitylosslist';

import "bootstrap/dist/css/bootstrap.min.css";

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
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
    <div style={{ backgroundColor: "#f4f7fb", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      
      {/* --- NAVIGATION BAR --- */}
      <Navbar
        expand="lg"
        variant="dark"
        style={{
          background: "linear-gradient(90deg, #001f4b 0%, #115395ff 50%, #1c69a9ff 100%)",
          padding: "1rem 2rem",
        }}
      >
        <Container fluid>
          {/* LOGO */}
          <Navbar.Brand
            as={Link}
            to="/"
            style={{
              fontFamily: "'Orbitron', sans-serif",
              fontSize: "1.8rem",
              fontWeight: 900,
              letterSpacing: "3px",
              background: "linear-gradient(135deg, #ffffff 0%, #bbdefb 40%, #64b5f6 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            HCG WAY
            <div style={{ fontSize: "0.6rem", letterSpacing: "2px", textTransform: "uppercase", marginTop: "-3px" }}>
              Engineering Intelligence
            </div>
          </Navbar.Brand>

          <Navbar.Toggle aria-controls="nav" />

          <Navbar.Collapse id="nav">
            <Nav className="ms-auto" style={{ alignItems: "center", gap: "1.4rem" }}>
              
              {/* HOME */}
              <Nav.Link
                as={Link}
                to="/"
                style={{
                  color: "white",
                  fontWeight: 600,
                  fontFamily: "'Orbitron', sans-serif",
                }}
              >
                Home
              </Nav.Link>

              {/* TOOLS DROPDOWN */}
              <Dropdown>
                <Dropdown.Toggle
                  variant="outline-light"
                  style={{
                    fontWeight: 600,
                    fontFamily: "'Orbitron', sans-serif",
                    border: "none",
                  }}
                >
                  Tools
                </Dropdown.Toggle>

                <Dropdown.Menu>
                  <Dropdown.Item as={Link} to="/bid"> BID </Dropdown.Item>
                  <Dropdown.Item as={Link} to="/pro"> Productivity loss</Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>

              {/* USER MENU */}
              {user ? (
                <Dropdown align="end">
                  <Dropdown.Toggle
                    variant="light"
                    style={{
                      backgroundColor: "rgba(255,255,255,0.25)",
                      border: "none",
                      color: "white",
                      fontWeight: 600,
                      padding: "0.45rem 1rem",
                      borderRadius: "8px",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    👤 {user.username}
                  </Dropdown.Toggle>

                  <Dropdown.Menu style={{ width: "250px" }}>
                    <Dropdown.Header>
                      <div style={{ fontWeight: "bold", fontSize: "1rem" }}>{user.username}</div>
                      <small style={{ color: "#555" }}>{user.email}</small>
                    </Dropdown.Header>

                    <Dropdown.Divider />

                    {/* My Projects Section */}
                    <Dropdown.ItemText style={{ 
                      fontSize: "0.75rem", 
                      fontWeight: "600", 
                      color: "#999",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px"
                    }}>
                      My Projects
                    </Dropdown.ItemText>
                    
                    <Dropdown.Item onClick={() => navigate("/productivity-losses")}>
                       Productivity Loss Projects
                    </Dropdown.Item>
                    <Dropdown.Item onClick={() => navigate("/bid")}>
                       My Bids
                    </Dropdown.Item>

                    <Dropdown.Divider />

                    <Dropdown.Item onClick={() => navigate("/profile")}> Profile</Dropdown.Item>
                    <Dropdown.Item onClick={() => navigate("/settings")}> Settings</Dropdown.Item>

                    <Dropdown.Divider />

                    <Dropdown.Item onClick={handleLogout} style={{ color: "red", fontWeight: 600 }}>
                       Logout
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              ) : (
                <Button
                  as={Link}
                  to="/login"
                  variant="light"
                  style={{
                    fontWeight: 600,
                    padding: "0.45rem 1.2rem",
                    borderRadius: "6px",
                  }}
                >
                  Login
                </Button>
              )}
            </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      {/* --- MAIN CONTENT --- */}
      <ProductivityProvider>
        <main style={{ flex: 1, margin: "0", padding: 0 }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Home />} />

            <Route path="/bid" element={<ProtectedRoute><BidList /></ProtectedRoute>} />
            <Route path="/bid/new" element={<ProtectedRoute><BidDetail /></ProtectedRoute>} />
            <Route path="/bid/:id" element={<ProtectedRoute><BidDetail /></ProtectedRoute>} />
            
            <Route path="/pro" element={<ProtectedRoute><ProTool /></ProtectedRoute>} />
            <Route path="/factors" element={<ProtectedRoute><Factors /></ProtectedRoute>} />
            
            {/* 新的统一路由 - 替代 proactive 和 retroactive */}
            <Route path="/productivity-analysis" element={<ProtectedRoute><ProductivityAnalysis /></ProtectedRoute>} />
            
            {/* 保留旧路由以防有链接 - 重定向到新页面 */}
            <Route path="/proactive" element={<ProtectedRoute><ProductivityAnalysis /></ProtectedRoute>} />
            <Route path="/retroactive" element={<ProtectedRoute><ProductivityAnalysis /></ProtectedRoute>} />
            
            <Route path="/productivity-losses" element={<ProtectedRoute><ProductivityLossList /></ProtectedRoute>} />
          </Routes>
        </main>
      </ProductivityProvider>

      {/* FOOTER */}
      <footer
        style={{
          backgroundColor: "#002b5c",
          color: "white",
          textAlign: "center",
          padding: "1.2rem",
          fontSize: "0.9rem",
        }}
      >
        © 2025 HCG WAY - Civil & Environmental Engineering, UW-Madison.
      </footer>
    </div>
  );
}

export default App;