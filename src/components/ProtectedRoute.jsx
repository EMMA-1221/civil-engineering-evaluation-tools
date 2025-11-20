import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

function ProtectedRoute({ children }) {
  const [isVerified, setIsVerified] = useState(null);
  const token = localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      setIsVerified(false);
      return;
    }

    // 验证token是否有效
    fetch("http://localhost:8080/verify", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    })
      .then(res => {
        if (res.ok) {
          setIsVerified(true);
        } else {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setIsVerified(false);
        }
      })
      .catch(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setIsVerified(false);
      });
  }, [token]);

  // 加载中状态
  if (isVerified === null) {
    return (
      <div style={styles.loading}>
        <div style={styles.spinner}></div>
        <p>Verifying...</p>
      </div>
    );
  }

  // 未登录，重定向到登录页
  if (isVerified === false) {
    return <Navigate to="/login" replace />;
  }

  // 已登录，显示内容
  return children;
}

const styles = {
  loading: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "60vh",
    color: "#002b5c",
  },
  spinner: {
    border: "4px solid #f3f3f3",
    borderTop: "4px solid #002b5c",
    borderRadius: "50%",
    width: "40px",
    height: "40px",
    animation: "spin 1s linear infinite",
  },
};

export default ProtectedRoute;