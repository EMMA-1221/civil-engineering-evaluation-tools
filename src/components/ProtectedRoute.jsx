import { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { useAuth } from "../hooks/useAuth";
import { tokenIsExpired } from "../authSession";

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const location = useLocation();
  const { token, sessionVersion, logout, syncSession, isCurrentSession, acceptVerifiedUser } = useAuth();
  const [check, setCheck] = useState(0);
  const [verification, setVerification] = useState({ token: null, version: null, key: null });
  const [failure, setFailure] = useState({ key: null, message: '' });
  const checkKey = `${sessionVersion}:${location.key}:${check}`;
  const expired = tokenIsExpired(token);
  const hasVerifiedSession = Boolean(token) && !expired && verification.token === token && verification.version === sessionVersion;
  const isVerified = hasVerifiedSession && verification.key === checkKey;

  useEffect(() => {
    const recheck = () => { syncSession(); setCheck(value => value + 1); };
    const visible = () => { if (document.visibilityState === 'visible') recheck(); };
    window.addEventListener('focus', recheck);
    window.addEventListener('pageshow', recheck);
    document.addEventListener('visibilitychange', visible);
    return () => {
      window.removeEventListener('focus', recheck);
      window.removeEventListener('pageshow', recheck);
      document.removeEventListener('visibilitychange', visible);
    };
  }, [syncSession]);

  useEffect(() => {
    if (!token) return;
    const expected = { token, version: sessionVersion };
    if (expired) { logout(expected); return; }
    const controller = new AbortController();
    const isCurrent = () => !controller.signal.aborted && isCurrentSession(expected);
    fetch(`${API_BASE_URL}/verify`, { headers:{Authorization:`Bearer ${token}`}, signal:controller.signal })
      .then(async response => {
        const data = await response.json().catch(() => null);
        if (!isCurrent()) return;
        if (response.status === 401 || response.status === 403 || (response.ok && data?.valid !== true)) {
          logout(expected);
          return;
        }
        if (!response.ok) throw new Error('Session verification is temporarily unavailable. Please try again.');
        if (!acceptVerifiedUser(expected, data.user)) { logout(expected); return; }
        setVerification({ token, version: sessionVersion, key: checkKey, role: data.user.role });
      })
      .catch(() => {
        if (!isCurrent()) return;
        setFailure({ key: checkKey, message: 'We couldn’t verify your session. Check your connection and try again.' });
      });
    return () => controller.abort();
  }, [token, sessionVersion, expired, checkKey, logout, isCurrentSession, acceptVerifiedUser]);

  if (!token || expired) return <Navigate to="/login" replace state={{from:location}} />;
  const roleAllowed = !requireAdmin || verification.role === 'admin';
  if (isVerified && !roleAllowed) return <section className="hcg-access-denied" role="alert"><span className="hcg-eyebrow">Restricted area</span><h1>Administrator access required.</h1><p>Your account can use the engineering tools, but this page is reserved for administrators.</p><Link to="/" className="hcg-button">Return to workspace</Link></section>;
  return <>
    {!isVerified && (failure.key === checkKey
      ? <div className="hcg-route-loader" role="alert"><p>{failure.message}</p><button type="button" className="hcg-button" onClick={() => { syncSession(); setCheck(value => value + 1); }}>Try again</button></div>
      : <div className="hcg-route-loader" role="status"><span className="hcg-route-spinner" /><p>Opening your workspace…</p></div>)}
    {/* Rechecking focus or a mode switch must hide stale access without losing
        an already authenticated editor's unsaved work. Account changes remount it. */}
    <div key={sessionVersion} hidden={!isVerified} inert={!isVerified}>
      {hasVerifiedSession && roleAllowed ? children : null}
    </div>
  </>;
}
