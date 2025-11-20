import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || "/";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // 验证输入
    if (isLogin) {
      if (!username.trim() || !password.trim()) {
        setError("Username/Email and password cannot be empty");
        setLoading(false);
        return;
      }
    } else {
      if (!username.trim() || !email.trim() || !password.trim()) {
        setError("All fields are required");
        setLoading(false);
        return;
      }

      // 验证email格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError("Please enter a valid email address");
        setLoading(false);
        return;
      }
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    const endpoint = isLogin ? "/login" : "/signup";
    const payload = isLogin
      ? { identifier: username.trim(), password }
      : { username: username.trim(), email: email.trim(), password };

    try {
      const response = await fetch(`http://3.14.158.200:8080${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.msg || "Something went wrong");
      }

      if (isLogin) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        
        console.log("✅ Login successful, redirecting to:", from);
        navigate(from, { replace: true });
      } else {
        setIsLogin(true);
        setUsername("");
        setEmail("");
        setPassword("");
        setError("");
        alert("✅ Registration successful! Please login with your new account.");
      }
    } catch (err) {
      setError(err.message);
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchMode = () => {
    setIsLogin(!isLogin);
    setError("");
    setUsername("");
    setEmail("");
    setPassword("");
  };

  return (
    <div style={styles.container}>
      <div style={styles.formCard}>
        <div style={styles.logoSection}>
          <h1 style={styles.logoTitle}>HannaLab</h1>
          <p style={styles.logoSubtitle}>Project Intelligence Suite</p>
        </div>

        <h2 style={styles.title}>
          {isLogin ? "Welcome Back" : "Create Account"}
        </h2>

        <p style={styles.subtitle}>
          {isLogin 
            ? "Login with your username or email" 
            : "Fill in your details to get started"}
        </p>

        {error && (
          <div style={styles.error}>
            <span style={styles.errorIcon}>⚠️</span>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>
              {isLogin ? "Username or Email" : "Username"}
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              placeholder={isLogin ? "Enter username or email" : "Choose a username"}
              autoComplete="username"
              disabled={loading}
            />
          </div>

          {!isLogin && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={styles.input}
                placeholder="your.email@example.com"
                autoComplete="email"
                disabled={loading}
              />
            </div>
          )}

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder={isLogin ? "Enter your password" : "At least 6 characters"}
              autoComplete={isLogin ? "current-password" : "new-password"}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            style={{
              ...styles.submitButton,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? "not-allowed" : "pointer"
            }}
            disabled={loading}
          >
            {loading ? (
              <span style={styles.loadingText}>
                <span style={styles.loadingSpinner}>⏳</span>
                Processing...
              </span>
            ) : (
              isLogin ? "Login" : "Sign Up"
            )}
          </button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerText}>or</span>
        </div>

        <p style={styles.switchText}>
          {isLogin ? "Don't have an account?" : "Already have an account?"}
        </p>
        <button
          onClick={handleSwitchMode}
          style={styles.switchButton}
          disabled={loading}
        >
          {isLogin ? "Create New Account" : "Back to Login"}
        </button>
      </div>

      <footer style={styles.footer}>
        <p>© 2025 Dr. Hanna's Lab - UW-Madison</p>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f7f9fb",
    padding: "2rem 1rem",
  },
  formCard: {
    backgroundColor: "white",
    padding: "2.5rem",
    borderRadius: "16px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
    width: "100%",
    maxWidth: "440px",
  },
  logoSection: {
    textAlign: "center",
    marginBottom: "2rem",
    paddingBottom: "1.5rem",
    borderBottom: "2px solid #e0e0e0",
  },
  logoTitle: {
    fontSize: "2rem",
    fontWeight: "700",
    color: "#002b5c",
    margin: "0 0 0.3rem 0",
  },
  logoSubtitle: {
    fontSize: "0.9rem",
    color: "#666",
    margin: 0,
  },
  title: {
    textAlign: "center",
    color: "#333",
    marginBottom: "0.5rem",
    fontSize: "1.6rem",
    fontWeight: "600",
  },
  subtitle: {
    textAlign: "center",
    color: "#777",
    fontSize: "0.9rem",
    marginBottom: "1.5rem",
  },
  error: {
    backgroundColor: "#ffebee",
    color: "#c62828",
    padding: "0.9rem",
    borderRadius: "8px",
    marginBottom: "1.2rem",
    fontSize: "0.9rem",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  errorIcon: {
    fontSize: "1.2rem",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1.3rem",
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
  },
  label: {
    marginBottom: "0.5rem",
    color: "#333",
    fontWeight: "600",
    fontSize: "0.95rem",
  },
  input: {
    padding: "0.85rem 1rem",
    fontSize: "1rem",
    border: "2px solid #e0e0e0",
    borderRadius: "8px",
    outline: "none",
    transition: "border-color 0.2s",
  },
  submitButton: {
    backgroundColor: "#002b5c",
    color: "white",
    padding: "0.95rem",
    fontSize: "1.05rem",
    fontWeight: "600",
    border: "none",
    borderRadius: "8px",
    marginTop: "0.5rem",
    transition: "background-color 0.2s",
  },
  loadingText: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
  },
  loadingSpinner: {
    display: "inline-block",
    animation: "spin 1s linear infinite",
  },
  divider: {
    textAlign: "center",
    margin: "1.5rem 0",
    position: "relative",
  },
  dividerText: {
    backgroundColor: "white",
    padding: "0 1rem",
    color: "#999",
    fontSize: "0.9rem",
    position: "relative",
    zIndex: 1,
  },
  switchText: {
    textAlign: "center",
    color: "#666",
    margin: "0 0 0.8rem 0",
    fontSize: "0.95rem",
  },
  switchButton: {
    backgroundColor: "transparent",
    color: "#002b5c",
    padding: "0.75rem",
    fontSize: "1rem",
    fontWeight: "600",
    border: "2px solid #002b5c",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.2s",
    width: "100%",
  },
  footer: {
    marginTop: "2rem",
    textAlign: "center",
    color: "#999",
    fontSize: "0.85rem",
  },
};

export default Login;