import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../Productivitycontext';
import '../App.css';

const ProductivityLossList = () => {
  const [productivityLosses, setProductivityLosses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [totalWeeks, setTotalWeeks] = useState(14);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProductivityLosses();
  }, []);

  const fetchProductivityLosses = async () => {
    try {
      const response = await fetch('/api/productivity-losses', {
        credentials: 'include'
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          navigate('/login');
          return;
        }
        throw new Error('Failed to fetch productivity losses');
      }

      const data = await response.json();
      setProductivityLosses(data.productivityLosses || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching productivity losses:', error);
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    
    if (!newProjectName.trim()) {
      alert('Please enter a project name');
      return;
    }

    try {
      const response = await fetch('/api/productivity-losses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          project_name: newProjectName,
          total_weeks: totalWeeks
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create productivity loss project');
      }

      const data = await response.json();
      alert('Productivity Loss project created successfully!');
      setShowNewModal(false);
      setNewProjectName('');
      setTotalWeeks(14);
      fetchProductivityLosses();
    } catch (error) {
      console.error('Error creating productivity loss:', error);
      alert('Failed to create productivity loss project');
    }
  };

  const handleDelete = async (id, projectName) => {
    if (!window.confirm(`Are you sure you want to delete "${projectName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/productivity-losses/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete productivity loss');
      }

      alert('Productivity Loss project deleted successfully!');
      fetchProductivityLosses();
    } catch (error) {
      console.error('Error deleting productivity loss:', error);
      alert('Failed to delete productivity loss project');
    }
  };

  const handleView = (id) => {
    navigate(`/proactive?productivityLoss=${id}`);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const formatNumber = (value) => {
    if (!value || value === 0) return '0.00';
    return parseFloat(value).toFixed(2);
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">Loading productivity losses...</div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>📊 My Productivity Loss Projects</h1>
        <div className="header-buttons">
          <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
            + New Project
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            Home
          </button>
        </div>
      </div>

      <div className="content">
        <div className="user-info">
          <div>
            <strong>Welcome!</strong> {user?.username || ''}
          </div>
          <div>
            <span className={`role-badge ${user?.role === 'admin' ? 'admin' : ''}`}>
              {user?.role?.toUpperCase() || 'USER'}
            </span>
          </div>
        </div>

        {productivityLosses.length === 0 ? (
          <div className="no-projects">
            <h2>No Productivity Loss Projects Yet</h2>
            <p>Create your first productivity loss calculation project to get started!</p>
            <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
              + Create Project
            </button>
          </div>
        ) : (
          <div className="projects-container">
            <table className="projects-table">
              <thead>
                <tr>
                  <th>Project Name</th>
                  {user?.role === 'admin' && <th>Owner</th>}
                  <th>Total Weeks</th>
                  <th>Proactive Loss</th>
                  <th>Retroactive Loss</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {productivityLosses.map((item) => (
                  <tr key={item.id}>
                    <td className="project-name">{item.project_name}</td>
                    {user?.role === 'admin' && <td>{item.username}</td>}
                    <td>{item.total_weeks} weeks</td>
                    <td className="loss-value proactive">
                      {formatNumber(item.total_proactive_loss)} hrs
                    </td>
                    <td className="loss-value retroactive">
                      {formatNumber(item.total_retroactive_loss)} hrs
                    </td>
                    <td>{formatDate(item.created_at)}</td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn btn-primary btn-small"
                          onClick={() => handleView(item.id)}
                        >
                          View
                        </button>
                        <button 
                          className="btn btn-danger btn-small"
                          onClick={() => handleDelete(item.id, item.project_name)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Productivity Loss Modal */}
      {showNewModal && (
        <div className="modal active" onClick={() => setShowNewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Productivity Loss Project</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label htmlFor="projectName">Project Name *</label>
                <input
                  type="text"
                  id="projectName"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Enter project name"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="totalWeeks">Total Weeks</label>
                <input
                  type="number"
                  id="totalWeeks"
                  value={totalWeeks}
                  onChange={(e) => setTotalWeeks(parseInt(e.target.value))}
                  min="1"
                  max="52"
                />
              </div>
              <div className="modal-buttons">
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowNewModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style jsx>{`
        .container {
          max-width: 1400px;
          margin: 0 auto;
          padding: 20px;
        }

        .header {
          background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
          color: white;
          padding: 30px;
          border-radius: 15px 15px 0 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0;
        }

        .header h1 {
          font-size: 28px;
          font-weight: 600;
          margin: 0;
        }

        .header-buttons {
          display: flex;
          gap: 15px;
        }

        .content {
          background: white;
          padding: 30px;
          border-radius: 0 0 15px 15px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
        }

        .user-info {
          background: #f8f9fa;
          padding: 15px 20px;
          border-radius: 8px;
          margin-bottom: 25px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .role-badge {
          background: #3498db;
          color: white;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }

        .role-badge.admin {
          background: #e74c3c;
        }

        .projects-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }

        .projects-table thead {
          background: #34495e;
          color: white;
        }

        .projects-table th {
          padding: 15px;
          text-align: left;
          font-weight: 600;
          font-size: 14px;
        }

        .projects-table td {
          padding: 15px;
          border-bottom: 1px solid #ecf0f1;
        }

        .projects-table tbody tr {
          transition: background 0.2s ease;
        }

        .projects-table tbody tr:hover {
          background: #f8f9fa;
        }

        .project-name {
          font-weight: 600;
          color: #2c3e50;
        }

        .loss-value {
          font-weight: 600;
        }

        .loss-value.proactive {
          color: #e67e22;
        }

        .loss-value.retroactive {
          color: #3498db;
        }

        .action-buttons {
          display: flex;
          gap: 10px;
        }

        .btn {
          padding: 12px 24px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .btn-primary {
          background: #3498db;
          color: white;
        }

        .btn-primary:hover {
          background: #2980b9;
          transform: translateY(-2px);
        }

        .btn-secondary {
          background: #95a5a6;
          color: white;
        }

        .btn-secondary:hover {
          background: #7f8c8d;
        }

        .btn-danger {
          background: #e74c3c;
          color: white;
        }

        .btn-danger:hover {
          background: #c0392b;
        }

        .btn-small {
          padding: 8px 16px;
          font-size: 13px;
        }

        .no-projects {
          text-align: center;
          padding: 60px 20px;
          color: #7f8c8d;
        }

        .no-projects h2 {
          font-size: 24px;
          margin-bottom: 10px;
          color: #2c3e50;
        }

        .no-projects p {
          font-size: 16px;
          margin-bottom: 20px;
        }

        .modal {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.5);
          z-index: 1000;
          align-items: center;
          justify-content: center;
        }

        .modal.active {
          display: flex;
        }

        .modal-content {
          background: white;
          padding: 30px;
          border-radius: 12px;
          max-width: 500px;
          width: 90%;
        }

        .modal-content h2 {
          margin-bottom: 20px;
          color: #2c3e50;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          font-weight: 600;
          color: #2c3e50;
        }

        .form-group input {
          width: 100%;
          padding: 12px;
          border: 2px solid #ecf0f1;
          border-radius: 8px;
          font-size: 14px;
          box-sizing: border-box;
        }

        .form-group input:focus {
          outline: none;
          border-color: #3498db;
        }

        .modal-buttons {
          display: flex;
          gap: 10px;
          justify-content: flex-end;
          margin-top: 25px;
        }

        .loading {
          text-align: center;
          padding: 40px;
          color: #7f8c8d;
          font-size: 18px;
        }
      `}</style>
    </div>
  );
};

export default ProductivityLossList;