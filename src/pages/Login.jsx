import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { useAuth } from "../hooks/useAuth";
import Icon from "../components/Icon.jsx";

export default function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const fromLocation = location.state?.from;
  const from = fromLocation && fromLocation.pathname?.startsWith("/") && !fromLocation.pathname.startsWith("//") && fromLocation.pathname !== "/login" ? `${fromLocation.pathname}${fromLocation.search || ""}${fromLocation.hash || ""}` : "/";

  const handleSubmit = async event => {
    event.preventDefault(); setError(""); setNotice("");
    if (!username.trim() || !password.trim() || (!isLogin && !email.trim())) { setError("Please complete all required fields."); return; }
    if (!isLogin && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Please enter a valid email address."); return; }
    if (password.length < 6) { setError("Your password must be at least 6 characters."); return; }
    setLoading(true);
    try {
      const payload = isLogin ? { identifier:username.trim(), password } : { username:username.trim(), email:email.trim(), password };
      const response = await fetch(`${API_BASE_URL}${isLogin ? "/login" : "/signup"}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.msg || "We couldn’t complete that request. Please try again.");
      if (isLogin) { login(data.user, data.token); navigate(from, {replace:true}); }
      else { setIsLogin(true); setPassword(""); setEmail(""); setShowPassword(false); setNotice("Your account is ready. Sign in to get started."); }
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };
  const switchMode = () => { setIsLogin(!isLogin); setError(""); setNotice(""); setUsername(""); setEmail(""); setPassword(""); setShowPassword(false); };

  return <div className="hcg-login-layout">
    <section className="hcg-login-panel" aria-labelledby="login-heading">
      <h1 id="login-heading">{isLogin ? <>Welcome back<br />to HCG WAY</> : "Create an account"}</h1>
      {notice && <div className="hcg-form-notice" role="status"><Icon name="check" size={17} />{notice}</div>}
      {error && <div className="hcg-form-error" role="alert" id="login-error">{error}</div>}
      <form onSubmit={handleSubmit} className="hcg-login-form" aria-busy={loading}>
        <div className="hcg-field"><label htmlFor="hcg-identifier">{isLogin ? "Username or email" : "Username"}</label><div className="hcg-input-wrap"><Icon name="user" /><input id="hcg-identifier" name="username" type="text" value={username} onChange={event => setUsername(event.target.value)} placeholder={isLogin ? "Your username or email" : "Choose a username"} autoComplete="username" required disabled={loading} aria-describedby={error ? "login-error" : undefined} /></div></div>
        {!isLogin && <div className="hcg-field"><label htmlFor="hcg-email">Email address</label><div className="hcg-input-wrap"><Icon name="mail" /><input id="hcg-email" name="email" type="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" required disabled={loading} /></div></div>}
        <div className="hcg-field"><label htmlFor="hcg-password">Password</label><div className="hcg-input-wrap"><Icon name="lock" /><input id="hcg-password" name="password" type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} placeholder={isLogin ? "Enter your password" : "At least 6 characters"} autoComplete={isLogin ? "current-password" : "new-password"} minLength={6} required disabled={loading} /><button className="hcg-password-toggle" type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} disabled={loading}><Icon name={showPassword ? "eye-off" : "eye"} size={17} /></button></div></div>
        <button className="hcg-button hcg-login-submit" type="submit" disabled={loading}>{loading ? <><span className="hcg-small-spinner" />{isLogin ? "Signing in…" : "Creating account…"}</> : <>{isLogin ? "Sign in" : "Create account"}<Icon name="arrow-right" size={17} /></>}</button>
      </form>
      <p className="hcg-switch-copy">{isLogin ? "New to HCG WAY?" : "Already have an account?"} <button type="button" onClick={switchMode} disabled={loading}>{isLogin ? "Create an account" : "Sign in"}</button></p>
    </section>
  </div>;
}
