import React, { createContext, useContext, useState, useEffect } from 'react';

// Productivity Context (原有的)
const ProductivityContext = createContext();

// Auth Context (新增的 - 用于用户认证)
export const AuthContext = createContext();

// Auth Provider (新增的)
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 从 localStorage 加载用户信息
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    
    if (token && userStr) {
      try {
        const userData = JSON.parse(userStr);
        setUser(userData);
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = (userData, token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const value = {
    user,
    setUser,
    login,
    logout,
    loading
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

// 自定义Hook来使用Context
export function useProductivity() {
  const context = useContext(ProductivityContext);
  if (!context) {
    throw new Error('useProductivity must be used within a ProductivityProvider');
  }
  return context;
}

// 新增：自定义Hook来使用AuthContext
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}