import React from "react";
import { useNavigate } from "react-router-dom";
import "./ProductivityUI.css";

function ProTool() {
  const navigate = useNavigate();

  return (
    <div className="hcg-tools hcg-prod hcg-prod-overview">
      <div className="pt-header">
        <p className="prod-eyebrow">Productivity · Analysis tools</p>
        <h1 className="pt-title">Understand the hours behind the work.</h1>
        <p className="pt-subtitle">
          Assess productivity loss with a shared set of inputs for proactive and retroactive analysis.
        </p>
      </div>

      <div className="pt-content">
        {/* New Project Button */}
        <div className="pt-actionSection">
          <button 
            onClick={() => navigate("/productivity-losses")} 
            className="pt-newProjectBtn"
          >
             Open my projects ↗
          </button>
        </div>

        {/* Tool Options */}
        <div className="pt-toolGrid">
          {/* Unified Productivity Analysis Card */}
          <div className="pt-cardLarge">
            <span className="prod-eyebrow">01 / Project analysis</span>
            <h2 className="pt-cardTitle">Productivity loss</h2>
            <p className="pt-cardDescription">
              Calculate productivity losses with both Proactive and Retroactive methods. Switch between analysis modes seamlessly with shared input data.
            </p>
            <button 
              onClick={() => navigate("/productivity-losses")} 
              className="pt-cardButton"
            >
              Start Analysis →
            </button>
          </div>

          {/* Factors Card */}
          <div className="pt-card">
            <span className="prod-eyebrow">02 / Reference library</span>
            <h2 className="pt-cardTitle">Impact factors</h2>
            <p className="pt-cardDescription">
              Review and understand the various factors that impact construction productivity
            </p>
            <button 
              onClick={() => navigate("/factors")} 
              className="pt-cardButton"
            >
              View Impact Factors →
            </button>
          </div>
        </div>

        {/* Info Section */}
        <div className="pt-infoSection">
          <h2 className="pt-infoTitle">From project inputs to a clearer picture.</h2>
          <ol className="pt-infoList">
            <li>Create a new project or select an existing one from "My Productivity Loss Projects"</li>
            <li>Open the Productivity Analysis tool</li>
            <li>Switch between Proactive and Retroactive tabs as needed - your data is shared between both modes</li>
            <li>Input your project data including work hours and impact factors</li>
            <li>Review the calculated productivity losses and generate reports</li>
          </ol>
        </div>
      </div>
    </div>
  );
}


export default ProTool;
