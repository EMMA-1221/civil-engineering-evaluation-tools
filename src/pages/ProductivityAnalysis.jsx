import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProductivity } from "../Productivitycontext";

function ProductivityAnalysis() {
  const [activeTab, setActiveTab] = useState("proactive"); // "proactive" or "retroactive"
  const [projectWeeks, setProjectWeeks] = useState(null); // 项目实际周数
  const navigate = useNavigate();
  
  const {
    weeks: contextWeeks,
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
  } = useProductivity();

  // 使用项目的实际周数,如果没有加载则使用 Context 的
  const weeks = projectWeeks || contextWeeks;

  // 本地实时计算 Total Factors（不依赖 Context）
  const localTotalFactors = weeks.map((_, i) => {
    const overmanning = Number(factors.overmanning[i]) || 0;
    const stacking = Number(factors.stacking[i]) || 0;
    const overtime = Number(factors.overtime[i]) || 0;
    return overmanning + stacking + overtime;
  });

  // 本地实时计算 Revised Hours
  const localRevised = weeks.map((_, i) => {
    const p = Number(planned[i]) || 0;
    const c = Number(change[i]) || 0;
    return p + c;
  });

  // 从数据库加载数据
  useEffect(() => {
    const loadProjectData = async () => {
      // 支持两种路由模式
      let projectId;
      
      // 尝试从 query string 获取
      const urlParams = new URLSearchParams(window.location.search);
      projectId = urlParams.get('productivityLoss');
      
      // 如果没有，尝试从 hash 中获取（React Router hash mode）
      if (!projectId && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
        projectId = hashParams.get('productivityLoss');
      }

      if (!projectId) {
        console.log('No project ID in URL');
        alert('Error: No project ID found. Please return to project list and try again.');
        return;
      }

      console.log('Loading project ID:', projectId);

      try {
        const token = localStorage.getItem('token');
        
        if (!token) {
          navigate('/login');
          return;
        }

        const response = await fetch(`/api/productivity-losses/${projectId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to load project data');
        }

        const data = await response.json();
        
        console.log('Loaded project data:', data);
        
        if (data.project && data.weeks) {
          const projectTotalWeeks = data.project.total_weeks || 14;
          
          // 设置项目实际周数，生成 weeks 数组
          const weeksArray = Array.from({ length: projectTotalWeeks }, (_, i) => `Week ${i + 1}`);
          setProjectWeeks(weeksArray);
          
          // 初始化数组，长度为项目的实际周数
          const newPlanned = Array(projectTotalWeeks).fill(0);
          const newChange = Array(projectTotalWeeks).fill(0);
          const newOvermanning = Array(projectTotalWeeks).fill(0);
          const newStacking = Array(projectTotalWeeks).fill(0);
          const newOvertime = Array(projectTotalWeeks).fill(0);

          // 加载数据库中的数据
          data.weeks.forEach((week) => {
            const idx = week.week_number - 1;
            if (idx < projectTotalWeeks) {
              newPlanned[idx] = week.planned_work_hours || 0;
              newChange[idx] = week.change_order_hours || 0;
              newOvermanning[idx] = week.overmanning || 0;
              newStacking[idx] = week.stacking_of_trades || 0;
              newOvertime[idx] = week.overtime_5_10 || 0;
            }
          });

          setPlanned(newPlanned);
          setChange(newChange);
          setFactors({
            overmanning: newOvermanning,
            stacking: newStacking,
            overtime: newOvertime
          });

          console.log(`✅ Project data loaded: ${projectTotalWeeks} weeks`);
        }

      } catch (error) {
        console.error('Error loading project data:', error);
        alert('Failed to load project data. Please try again.');
      }
    };

    loadProjectData();
  }, []); // 只在组件挂载时运行一次

  // 根据当前 Tab 计算对应的总损失
  const calculateTotalLoss = () => {
    const safeRevised = localRevised.map(v => Number(v) || 0);
    const safeTotalFactors = localTotalFactors.map(f => Number(f) || 0);
    
    if (activeTab === "proactive") {
      // Proactive: H_r × F
      return safeRevised.reduce((sum, hr, i) => {
        return sum + (hr * safeTotalFactors[i]);
      }, 0).toFixed(2);
    } else {
      // Retroactive: H_r × (F / (1 + F))
      return safeRevised.reduce((sum, hr, i) => {
        const f = safeTotalFactors[i];
        return sum + (hr * (f / (1 + f)));
      }, 0).toFixed(2);
    }
  };

  const displayTotalLoss = calculateTotalLoss();

  // 根据当前 Tab 计算对应的每周损失
  const calculateWeeklyLoss = () => {
    const safeRevised = localRevised.map(v => Number(v) || 0);
    const safeTotalFactors = localTotalFactors.map(f => Number(f) || 0);
    
    if (activeTab === "proactive") {
      // Proactive: H_r × F
      return safeRevised.map((hr, i) => (hr * safeTotalFactors[i]).toFixed(2));
    } else {
      // Retroactive: H_r × (F / (1 + F))
      return safeRevised.map((hr, i) => {
        const f = safeTotalFactors[i];
        return (hr * (f / (1 + f))).toFixed(2);
      });
    }
  };

  const weeklyLoss = calculateWeeklyLoss();

  // 保存到数据库
  const handleSaveToDatabase = async () => {
    // 获取 project ID（支持 hash 路由）
    let projectId;
    
    const urlParams = new URLSearchParams(window.location.search);
    projectId = urlParams.get('productivityLoss');
    
    if (!projectId && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.split('?')[1]);
      projectId = hashParams.get('productivityLoss');
    }

    if (!projectId) {
      alert('Error: No project ID found. Please return to project list and try again.');
      return;
    }

    console.log('Saving project ID:', projectId);

    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        alert('Please login first');
        navigate('/login');
        return;
      }

      // 准备要保存的所有周数据
      const savePromises = weeks.map((_, weekIndex) => {
        const weekNumber = weekIndex + 1;
        const weekData = {
          planned_work_hours: planned[weekIndex] || 0,
          change_order_hours: change[weekIndex] || 0,
          overmanning: factors.overmanning[weekIndex] || 0,
          stacking_of_trades: factors.stacking[weekIndex] || 0,
          overtime_5_10: factors.overtime[weekIndex] || 0
        };

        return fetch(`/api/productivity-losses/${projectId}/weeks/${weekNumber}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(weekData)
        });
      });

      // 等待所有保存请求完成
      const responses = await Promise.all(savePromises);
      
      // 检查是否有失败的请求
      const allSuccess = responses.every(res => res.ok);

      if (allSuccess) {
        // 计算 Proactive Loss
        const safeRevised = localRevised.map(v => Number(v) || 0);
        const safeTotalFactors = localTotalFactors.map(f => Number(f) || 0);
        
        const proactiveLoss = safeRevised.reduce((sum, hr, i) => {
          return sum + (hr * safeTotalFactors[i]);
        }, 0).toFixed(2);
        
        // 计算 Retroactive Loss
        const retroactiveLoss = safeRevised.reduce((sum, hr, i) => {
          const f = safeTotalFactors[i];
          return sum + (hr * (f / (1 + f)));
        }, 0).toFixed(2);
        
        alert(`✅ Success! Data saved to database.\n\nProactive Loss: ${proactiveLoss} hrs\nRetroactive Loss: ${retroactiveLoss} hrs`);
      } else {
        throw new Error('Some weeks failed to save');
      }

    } catch (error) {
      console.error('Error saving to database:', error);
      alert('❌ Failed to save data to database. Please try again.');
    }
  };

  // Proactive 和 Retroactive 共享所有数据

  return (
    <div style={styles.container}>
      {/* Tab Navigation */}
      <div style={styles.tabContainer}>
        <button
          onClick={() => setActiveTab("proactive")}
          style={{
            ...styles.tab,
            ...(activeTab === "proactive" ? styles.activeTab : styles.inactiveTab),
          }}
        >
          Proactive
        </button>
        <button
          onClick={() => setActiveTab("retroactive")}
          style={{
            ...styles.tab,
            ...(activeTab === "retroactive" ? styles.activeTab : styles.inactiveTab),
          }}
        >
          Retroactive
        </button>
      </div>

      {/* Page Title */}
      <h2 style={styles.title}>
        {activeTab === "proactive" 
          ? "Proactive Calculation of Productivity Loss" 
          : "Retroactive Calculation of Productivity Loss"}
      </h2>

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button onClick={handleReset} style={styles.resetBtn}>Reset</button>
          <button onClick={() => navigate("/productivity-losses")} style={styles.projectBtn}>
            📁 My Projects
          </button>
        </div>
        <button 
          onClick={handleSaveToDatabase} 
          style={styles.calculateBtn}
        >
          Calculate and Save to Database
        </button>
        <div style={styles.totalBox}>Total Loss: <strong>{displayTotalLoss}</strong> hrs</div>
      </div>

      {/* Table Wrapper */}
      <div style={styles.tableWrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.stickyHeader}>Factors</th>
              {weeks.map((w, i) => (
                <th key={i} style={styles.weekHeader}>{w}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Planned Work Hours */}
            <tr>
              <td style={styles.stickyCell}><strong>Planned Work Hours</strong></td>
              {planned.map((val, i) => (
                <td key={i} style={styles.dataCell}>
                  <input
                    type="number"
                    value={val === 0 ? '' : val}
                    onChange={(e) => {
                      const newArr = [...planned];
                      newArr[i] = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      setPlanned(newArr);
                    }}
                    onBlur={(e) => {
                      // 失焦时格式化为两位小数
                      const newArr = [...planned];
                      const currentValue = Number(newArr[i]) || 0;
                      newArr[i] = parseFloat(currentValue.toFixed(2));
                      setPlanned(newArr);
                    }}
                    placeholder="0.00"
                    style={styles.input}
                  />
                </td>
              ))}
            </tr>

            {/* Change Order Hours */}
            <tr>
              <td style={styles.stickyCell}><strong>Change Order Hours</strong></td>
              {change.map((val, i) => (
                <td key={i} style={styles.dataCell}>
                  <input
                    type="number"
                    value={val === 0 ? '' : val}
                    onChange={(e) => {
                      const newArr = [...change];
                      newArr[i] = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      setChange(newArr);
                    }}
                    onBlur={(e) => {
                      // 失焦时格式化为两位小数
                      const newArr = [...change];
                      const currentValue = Number(newArr[i]) || 0;
                      newArr[i] = parseFloat(currentValue.toFixed(2));
                      setChange(newArr);
                    }}
                    placeholder="0.00"
                    style={styles.input}
                  />
                </td>
              ))}
            </tr>

            {/* Revised Hours */}
            <tr style={styles.revisedRow}>
              <td style={styles.stickyCellRevised}><strong>Revised Hours</strong></td>
              {localRevised.map((r, i) => (
                <td key={i} style={styles.revisedCell}>
                  {Number(r).toFixed(2)}
                </td>
              ))}
            </tr>

            {/* Productivity Factors Header */}
            <tr style={styles.factorHeaderRow}>
              <td style={styles.stickyCell} colSpan={15}>
                <strong>Productivity Factors</strong>
              </td>
            </tr>

            {/* Factors sub-header */}
            <tr style={styles.factorSubHeaderRow}>
              <td style={styles.stickyCell}><strong>Factors</strong></td>
              {weeks.map((_, i) => (
                <td key={i} style={styles.impactHeader}><strong>Impact</strong></td>
              ))}
            </tr>

            {/* Overmanning */}
            <tr>
              <td style={styles.stickyCell}>Overmanning</td>
              {factors.overmanning.map((val, i) => (
                <td key={i} style={styles.dataCell}>
                  <input
                    type="number"
                    step="0.01"
                    value={val === 0 ? '' : val}
                    onChange={(e) => {
                      const newFactors = { ...factors };
                      const inputValue = e.target.value;
                      newFactors.overmanning[i] = inputValue === '' ? 0 : parseFloat(inputValue);
                      setFactors(newFactors);
                    }}
                    onBlur={(e) => {
                      // 失焦时格式化为两位小数
                      const newFactors = { ...factors };
                      const currentValue = Number(newFactors.overmanning[i]) || 0;
                      newFactors.overmanning[i] = parseFloat(currentValue.toFixed(2));
                      setFactors(newFactors);
                    }}
                    placeholder="0.00"
                    style={styles.input}
                  />
                </td>
              ))}
            </tr>

            {/* Stacking of Trades */}
            <tr>
              <td style={styles.stickyCell}>Stacking of Trades</td>
              {factors.stacking.map((val, i) => (
                <td key={i} style={styles.dataCell}>
                  <input
                    type="number"
                    step="0.01"
                    value={val === 0 ? '' : val}
                    onChange={(e) => {
                      const newFactors = { ...factors };
                      const inputValue = e.target.value;
                      newFactors.stacking[i] = inputValue === '' ? 0 : parseFloat(inputValue);
                      setFactors(newFactors);
                    }}
                    onBlur={(e) => {
                      // 失焦时格式化为两位小数
                      const newFactors = { ...factors };
                      const currentValue = Number(newFactors.stacking[i]) || 0;
                      newFactors.stacking[i] = parseFloat(currentValue.toFixed(2));
                      setFactors(newFactors);
                    }}
                    placeholder="0.00"
                    style={styles.input}
                  />
                </td>
              ))}
            </tr>

            {/* Overtime 5-10 */}
            <tr>
              <td style={styles.stickyCell}>Overtime 5-10</td>
              {factors.overtime.map((val, i) => (
                <td key={i} style={styles.dataCell}>
                  <input
                    type="number"
                    step="0.01"
                    value={val === 0 ? '' : val}
                    onChange={(e) => {
                      const newFactors = { ...factors };
                      const inputValue = e.target.value;
                      newFactors.overtime[i] = inputValue === '' ? 0 : parseFloat(inputValue);
                      setFactors(newFactors);
                    }}
                    onBlur={(e) => {
                      // 失焦时格式化为两位小数
                      const newFactors = { ...factors };
                      const currentValue = Number(newFactors.overtime[i]) || 0;
                      newFactors.overtime[i] = parseFloat(currentValue.toFixed(2));
                      setFactors(newFactors);
                    }}
                    placeholder="0.00"
                    style={styles.input}
                  />
                </td>
              ))}
            </tr>

            {/* Total Factors */}
            <tr style={styles.totalFactorsRow}>
              <td style={styles.stickyCellTotal}><strong>Total Factors</strong></td>
              {localTotalFactors.map((val, i) => (
                <td key={i} style={styles.totalFactorsCell}>
                  {Number(val).toFixed(2)}
                </td>
              ))}
            </tr>

            {/* Estimated Loss of Productivity */}
            <tr style={styles.estimatedLossRow}>
              <td style={styles.stickyCellLoss}>
                <strong>Estimated Loss of Productivity</strong>
              </td>
              {weeklyLoss.map((val, i) => (
                <td key={i} style={styles.estimatedLossCell}>{val}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "2rem",
    fontFamily: "Segoe UI, sans-serif",
    backgroundColor: "#f8fafc",
    minHeight: "100vh",
  },
  tabContainer: {
    display: "flex",
    justifyContent: "center",
    marginBottom: "2rem",
    gap: "0",
  },
  tab: {
    padding: "0.75rem 3rem",
    fontSize: "1.1rem",
    fontWeight: "600",
    border: "none",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  activeTab: {
    backgroundColor: "#27ae60",
    color: "white",
    borderBottom: "3px solid #1e8449",
  },
  inactiveTab: {
    backgroundColor: "#7f8c8d",
    color: "white",
  },
  title: {
    textAlign: "center",
    marginBottom: "1.5rem",
    color: "#002b5c",
    fontSize: "1.8rem",
  },
  toolbar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "1rem",
    padding: "0 1rem",
  },
  resetBtn: {
    background: "#c0392b",
    color: "white",
    border: "none",
    borderRadius: "6px",
    padding: "0.6rem 1.2rem",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "500",
  },
  projectBtn: {
    background: "#3498db",
    color: "white",
    border: "none",
    borderRadius: "6px",
    padding: "0.6rem 1.2rem",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "500",
  },
  totalBox: {
    background: "#2c3e50",
    color: "white",
    borderRadius: "6px",
    padding: "0.6rem 1.2rem",
    fontSize: "1rem",
  },
  tableWrapper: {
    overflowX: "auto",
    boxShadow: "0 3px 10px rgba(0,0,0,0.1)",
    borderRadius: "8px",
    backgroundColor: "white",
  },
  table: {
    borderCollapse: "collapse",
    width: "100%",
    minWidth: "1200px",
    background: "white",
  },
  stickyHeader: {
    position: "sticky",
    left: 0,
    backgroundColor: "#2d5a3d",
    color: "white",
    padding: "0.8rem",
    textAlign: "center",
    fontWeight: "600",
    border: "1px solid #1e3a28",
    zIndex: 10,
    minWidth: "180px",
  },
  weekHeader: {
    backgroundColor: "#2d5a3d",
    color: "white",
    padding: "0.8rem",
    textAlign: "center",
    fontWeight: "600",
    border: "1px solid #1e3a28",
    minWidth: "100px",
  },
  stickyCell: {
    position: "sticky",
    left: 0,
    backgroundColor: "white",
    padding: "0.6rem 1rem",
    textAlign: "left",
    border: "1px solid #ccc",
    fontWeight: "500",
    zIndex: 5,
    minWidth: "180px",
  },
  stickyCellRevised: {
    position: "sticky",
    left: 0,
    backgroundColor: "#fff3cd",
    padding: "0.6rem 1rem",
    textAlign: "left",
    border: "1px solid #ccc",
    fontWeight: "600",
    zIndex: 5,
    minWidth: "180px",
  },
  stickyCellTotal: {
    position: "sticky",
    left: 0,
    backgroundColor: "#2c3e50",
    color: "#f39c12",
    padding: "0.6rem 1rem",
    textAlign: "left",
    border: "1px solid #1a252f",
    fontWeight: "700",
    zIndex: 5,
    minWidth: "180px",
  },
  stickyCellLoss: {
    position: "sticky",
    left: 0,
    backgroundColor: "#2c3e50",
    color: "#f39c12",
    padding: "0.6rem 1rem",
    textAlign: "left",
    border: "1px solid #1a252f",
    fontWeight: "700",
    zIndex: 5,
    minWidth: "180px",
  },
  dataCell: {
    border: "1px solid #ccc",
    textAlign: "center",
    padding: "0.4rem",
    minWidth: "100px",
  },
  revisedCell: {
    border: "1px solid #ccc",
    textAlign: "center",
    padding: "0.6rem",
    backgroundColor: "#fff3cd",
    fontWeight: "500",
  },
  revisedRow: {
    backgroundColor: "#fff3cd",
  },
  factorHeaderRow: {
    backgroundColor: "#e8e8e8",
  },
  factorSubHeaderRow: {
    backgroundColor: "#d4edda",
  },
  impactHeader: {
    backgroundColor: "#d4edda",
    textAlign: "center",
    padding: "0.6rem",
    border: "1px solid #ccc",
    fontWeight: "600",
  },
  totalFactorsRow: {
    backgroundColor: "#2c3e50",
  },
  totalFactorsCell: {
    border: "1px solid #1a252f",
    textAlign: "center",
    padding: "0.6rem",
    backgroundColor: "#2c3e50",
    color: "#f39c12",
    fontWeight: "700",
  },
  estimatedLossRow: {
    backgroundColor: "#2c3e50",
  },
  estimatedLossCell: {
    border: "1px solid #1a252f",
    textAlign: "center",
    padding: "0.6rem",
    backgroundColor: "#2c3e50",
    color: "#f39c12",
    fontWeight: "700",
  },
  input: {
    width: "90%",
    padding: "0.4rem",
    borderRadius: "4px",
    border: "1px solid #ccc",
    textAlign: "center",
  },
  calculateBtn: {
    background: "#0d47a1",
    color: "white",
    border: "none",
    borderRadius: "6px",
    padding: "0.6rem 1.2rem",
    cursor: "pointer",
    fontSize: "1rem",
    fontWeight: "500",
  },
};

export default ProductivityAnalysis;