import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useProductivity } from "../hooks/useProductivity";
import "./ProductivityUI.css";

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
  }, [navigate, setPlanned, setChange, setFactors]);

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
        
        alert(`Success! Data saved to database.\n\nProactive Loss: ${proactiveLoss} hrs\nRetroactive Loss: ${retroactiveLoss} hrs`);
      } else {
        throw new Error('Some weeks failed to save');
      }

    } catch (error) {
      console.error('Error saving to database:', error);
      alert('Failed to save data to database. Please try again.');
    }
  };

  // Proactive 和 Retroactive 共享所有数据

  return (
    <div className="hcg-tools hcg-prod hcg-prod-analysis">
      <p className="prod-eyebrow">Productivity · Project analysis</p>
      {/* Tab Navigation */}
      <div className="pa-tabContainer">
        <button
          onClick={() => setActiveTab("proactive")}
          className={`pa-tab ${activeTab === "proactive" ? "is-active" : ""}`}
          aria-pressed={activeTab === "proactive"}
        >
          Proactive
        </button>
        <button
          onClick={() => setActiveTab("retroactive")}
          className={`pa-tab ${activeTab === "retroactive" ? "is-active" : ""}`}
          aria-pressed={activeTab === "retroactive"}
        >
          Retroactive
        </button>
      </div>

      {/* Page Title */}
      <h1 className="pa-title">
        {activeTab === "proactive" 
          ? "Proactive Calculation of Productivity Loss" 
          : "Retroactive Calculation of Productivity Loss"}
      </h1>

      {/* Toolbar */}
      <div className="pa-toolbar">
        <div className="pa-toolbar-actions">
          <button onClick={handleReset} className="pa-resetBtn">Reset</button>
          <button onClick={() => navigate("/productivity-losses")} className="pa-projectBtn">
            My projects
          </button>
        </div>
        <button 
          onClick={handleSaveToDatabase} 
          className="pa-calculateBtn"
        >
          Calculate & save
        </button>
        <div className="pa-totalBox">Total Loss: <strong>{displayTotalLoss}</strong> hrs</div>
      </div>

      {/* Table Wrapper */}
      <div className="pa-tableWrapper">
        <table className="pa-table" aria-label="Weekly productivity analysis">
          <thead>
            <tr>
              <th scope="col" className="pa-stickyHeader">Factors</th>
              {weeks.map((w, i) => (
                <th key={i} scope="col" className="pa-weekHeader">{w}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {/* Planned Work Hours */}
            <tr>
              <td className="pa-stickyCell"><strong>Planned Work Hours</strong></td>
              {planned.map((val, i) => (
                <td key={i} className="pa-dataCell">
                  <input
                    type="number"
                    value={val === 0 ? '' : val}
                    onChange={(e) => {
                      const newArr = [...planned];
                      newArr[i] = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      setPlanned(newArr);
                    }}
                    onBlur={() => {
                      // 失焦时格式化为两位小数
                      const newArr = [...planned];
                      const currentValue = Number(newArr[i]) || 0;
                      newArr[i] = parseFloat(currentValue.toFixed(2));
                      setPlanned(newArr);
                    }}
                    placeholder="0.00"
                    aria-label={`Planned work hours, week ${i + 1}`}
                    className="pa-input"
                  />
                </td>
              ))}
            </tr>

            {/* Change Order Hours */}
            <tr>
              <td className="pa-stickyCell"><strong>Change Order Hours</strong></td>
              {change.map((val, i) => (
                <td key={i} className="pa-dataCell">
                  <input
                    type="number"
                    value={val === 0 ? '' : val}
                    onChange={(e) => {
                      const newArr = [...change];
                      newArr[i] = e.target.value === '' ? 0 : parseFloat(e.target.value);
                      setChange(newArr);
                    }}
                    onBlur={() => {
                      // 失焦时格式化为两位小数
                      const newArr = [...change];
                      const currentValue = Number(newArr[i]) || 0;
                      newArr[i] = parseFloat(currentValue.toFixed(2));
                      setChange(newArr);
                    }}
                    placeholder="0.00"
                    aria-label={`Change order hours, week ${i + 1}`}
                    className="pa-input"
                  />
                </td>
              ))}
            </tr>

            {/* Revised Hours */}
            <tr className="pa-revisedRow">
              <td className="pa-stickyCellRevised"><strong>Revised Hours</strong></td>
              {localRevised.map((r, i) => (
                <td key={i} className="pa-revisedCell">
                  {Number(r).toFixed(2)}
                </td>
              ))}
            </tr>

            {/* Productivity Factors Header */}
            <tr className="pa-factorHeaderRow">
              <td className="pa-stickyCell" colSpan={weeks.length + 1}>
                <strong>Productivity Factors</strong>
              </td>
            </tr>

            {/* Factors sub-header */}
            <tr className="pa-factorSubHeaderRow">
              <td className="pa-stickyCell"><strong>Factors</strong></td>
              {weeks.map((_, i) => (
                <td key={i} className="pa-impactHeader"><strong>Impact</strong></td>
              ))}
            </tr>

            {/* Overmanning */}
            <tr>
              <td className="pa-stickyCell">Overmanning</td>
              {factors.overmanning.map((val, i) => (
                <td key={i} className="pa-dataCell">
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
                    onBlur={() => {
                      // 失焦时格式化为两位小数
                      const newFactors = { ...factors };
                      const currentValue = Number(newFactors.overmanning[i]) || 0;
                      newFactors.overmanning[i] = parseFloat(currentValue.toFixed(2));
                      setFactors(newFactors);
                    }}
                    placeholder="0.00"
                    aria-label={`Overmanning impact, week ${i + 1}`}
                    className="pa-input"
                  />
                </td>
              ))}
            </tr>

            {/* Stacking of Trades */}
            <tr>
              <td className="pa-stickyCell">Stacking of Trades</td>
              {factors.stacking.map((val, i) => (
                <td key={i} className="pa-dataCell">
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
                    onBlur={() => {
                      // 失焦时格式化为两位小数
                      const newFactors = { ...factors };
                      const currentValue = Number(newFactors.stacking[i]) || 0;
                      newFactors.stacking[i] = parseFloat(currentValue.toFixed(2));
                      setFactors(newFactors);
                    }}
                    placeholder="0.00"
                    aria-label={`Stacking of trades impact, week ${i + 1}`}
                    className="pa-input"
                  />
                </td>
              ))}
            </tr>

            {/* Overtime 5-10 */}
            <tr>
              <td className="pa-stickyCell">Overtime 5-10</td>
              {factors.overtime.map((val, i) => (
                <td key={i} className="pa-dataCell">
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
                    onBlur={() => {
                      // 失焦时格式化为两位小数
                      const newFactors = { ...factors };
                      const currentValue = Number(newFactors.overtime[i]) || 0;
                      newFactors.overtime[i] = parseFloat(currentValue.toFixed(2));
                      setFactors(newFactors);
                    }}
                    placeholder="0.00"
                    aria-label={`Overtime impact, week ${i + 1}`}
                    className="pa-input"
                  />
                </td>
              ))}
            </tr>

            {/* Total Factors */}
            <tr className="pa-totalFactorsRow">
              <td className="pa-stickyCellTotal"><strong>Total Factors</strong></td>
              {localTotalFactors.map((val, i) => (
                <td key={i} className="pa-totalFactorsCell">
                  {Number(val).toFixed(2)}
                </td>
              ))}
            </tr>

            {/* Estimated Loss of Productivity */}
            <tr className="pa-estimatedLossRow">
              <td className="pa-stickyCellLoss">
                <strong>Estimated Loss of Productivity</strong>
              </td>
              {weeklyLoss.map((val, i) => (
                <td key={i} className="pa-estimatedLossCell">{val}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="prod-table-note">Both methods share your project inputs. Scroll across the table to review each week.</p>
    </div>
  );
}

export default ProductivityAnalysis;
