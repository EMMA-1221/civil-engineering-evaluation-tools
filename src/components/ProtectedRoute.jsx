import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { useAuth } from "../hooks/useAuth";

export default function ProtectedRoute({ children }) {
  const location = useLocation();
  const { logout } = useAuth();
  const token = localStorage.getItem("token");
  const [verification, setVerification] = useState({ token:null, valid:null });
  const isVerified = !token ? false : verification.token === token ? verification.valid : null;

  useEffect(() => {
    if (!token) { logout(); return; }
    const controller = new AbortController();
    const isCurrent = () => !controller.signal.aborted && localStorage.getItem("token") === token;
    fetch(`${API_BASE_URL}/verify`, { headers:{Authorization:`Bearer ${token}`}, signal:controller.signal })
      .then(response => {
        if (!isCurrent()) return;
        if (!response.ok) logout();
        setVerification({token, valid:response.ok});
      })
      .catch(() => {
        if (!isCurrent()) return;
        logout();
        setVerification({token, valid:false});
      });
    return () => controller.abort();
  }, [token, logout]);

  if (isVerified === null) return <div className="hcg-route-loader" role="status"><span className="hcg-route-spinner" /><p>Opening your workspace…</p></div>;
  if (!isVerified) return <Navigate to="/login" replace state={{from:location}} />;
  return children;
}
