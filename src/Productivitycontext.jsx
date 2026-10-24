import React, { useState, useEffect, useSyncExternalStore } from 'react';
import { AuthContext, ProductivityContext } from './contexts';
import { createAuthSessionStore, tokenIsExpired } from './authSession';

// Auth Provider (新增的)
export function AuthProvider({ children }) {
  const [sessionStore] = useState(() => createAuthSessionStore({ storage: window.localStorage }));
  const session = useSyncExternalStore(sessionStore.subscribe, sessionStore.getSnapshot);
  useEffect(() => sessionStore.listen(window), [sessionStore]);
  const value = {
    user: tokenIsExpired(session.token) ? null : session.user,
    token: session.token,
    sessionVersion: session.version,
    setUser: sessionStore.setUser,
    login: sessionStore.login,
    logout: sessionStore.logout,
    loading: false,
    syncSession: sessionStore.sync,
    isCurrentSession: sessionStore.isCurrent,
    acceptVerifiedUser: sessionStore.acceptVerifiedUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// Productivity Provider (原有的)
export function ProductivityProvider({ children }) {
  const weeks = Array.from({ length: 14 }, (_, i) => `Week ${i + 1}`);

  // 共享的工作时数数据
  const [planned, setPlanned] = useState(Array(14).fill(0));
  const [change, setChange] = useState(Array(14).fill(0));

  // 共享的因素影响数据
  const [factors, setFactors] = useState({
    overmanning: Array(14).fill(0),
    stacking: Array(14).fill(0),
    overtime: Array(14).fill(0),
  });

  // 计算 revised hours
  const revised = planned.map((p, i) => p + change[i]);

  // 计算 total factor per week
  const totalFactors = weeks.map((_, i) =>
    Object.values(factors).reduce((sum, arr) => sum + (arr[i] || 0), 0)
  );

  // 计算 estimated productivity loss per week
  const estimatedLoss = revised.map((r, i) => (r * totalFactors[i]).toFixed(2));

  // 汇总 total loss
  const totalLoss = estimatedLoss.reduce((sum, val) => sum + parseFloat(val), 0).toFixed(2);

  // Reset 全清空
  const handleReset = () => {
    setPlanned(Array(14).fill(0));
    setChange(Array(14).fill(0));
    setFactors({
      overmanning: Array(14).fill(0),
      stacking: Array(14).fill(0),
      overtime: Array(14).fill(0),
    });
  };

  const value = {
    weeks,
    planned,
    setPlanned,
    change,
    setChange,
    factors,
    setFactors,
    revised,
    totalFactors,
    estimatedLoss,
    totalLoss,
    handleReset,
  };

  return (
    <ProductivityContext.Provider value={value}>
      {children}
    </ProductivityContext.Provider>
  );
}
