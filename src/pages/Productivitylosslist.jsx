import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../Productivitycontext';
import './ProductivityLossList.css';  // ← 改用外部 CSS

const ProductivityLossList = () => {
  const [productivityLosses, setProductivityLosses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [totalWeeks, setTotalWeeks] = useState(14);
  const [editWeeks, setEditWeeks] = useState(14);
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    fetchProductivityLosses();
  }, []);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  const fetchProductivityLosses = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/login');
        return;
      }

      const response = await fetch('/api/productivity-losses', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
        headers: getAuthHeaders(),
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
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/productivity-losses/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
    navigate(`/productivity-analysis?productivityLoss=${id}`);
  };

  const handleEdit = (project) => {
    setEditingProject(project);
    setEditWeeks(project.total_weeks);
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!editingProject) return;

    if (editWeeks < 1 || editWeeks > 52) {
      alert('Total weeks must be between 1 and 52');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/productivity-losses/${editingProject.project_id || editingProject.id}/weeks-count`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ total_weeks: editWeeks })
      });

      if (!response.ok) {
        throw new Error('Failed to update project weeks');
      }

      const data = await response.json();
      alert(`✅ Project updated successfully!\n\nOld weeks: ${data.old_weeks}\nNew weeks: ${data.new_weeks}`);
      setShowEditModal(false);
      setEditingProject(null);
      fetchProductivityLosses();
    } catch (error) {
      console.error('Error updating project weeks:', error);
      alert('Failed to update project weeks');
    }
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
      <div className="productivity-loss-container">
        <div className="loading">Loading productivity losses...</div>
      </div>
    );
  }

  return (
    <div className="productivity-loss-container">
      <div className="productivity-loss-header">
        <h1> My Productivity Loss Projects</h1>
        <div className="header-buttons">
          <button className="btn btn-primary" onClick={() => setShowNewModal(true)}>
            + New Project
          </button>
          <button className="btn btn-secondary" onClick={() => navigate('/')}>
            Home
          </button>
        </div>
      </div>

      <div className="productivity-loss-content">
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
                  <tr key={item.project_id || item.id}>
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
                          onClick={() => handleView(item.project_id || item.id)}
                        >
                          View
                        </button>
                        <button 
                          className="btn btn-secondary btn-small"
                          onClick={() => handleEdit(item)}
                        >
                          Edit
                        </button>
                        <button 
                          className="btn btn-danger btn-small"
                          onClick={() => handleDelete(item.project_id || item.id, item.project_name)}
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
        <div className="modal-overlay active" onClick={() => setShowNewModal(false)}>
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

      {/* Edit Project Weeks Modal */}
      {showEditModal && editingProject && (
        <div className="modal-overlay active" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Project: {editingProject.project_name}</h2>
            <div className="form-group">
              <label htmlFor="editWeeks">Total Weeks</label>
              <input
                type="number"
                id="editWeeks"
                value={editWeeks}
                onChange={(e) => setEditWeeks(parseInt(e.target.value))}
                min="1"
                max="52"
              />
              <p style={{ fontSize: '14px', color: '#666', marginTop: '8px' }}>
                Current: {editingProject.total_weeks} weeks
              </p>
            </div>
            <div className="modal-buttons">
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={() => setShowEditModal(false)}
              >
                Cancel
              </button>
              <button 
                type="button"
                className="btn btn-primary"
                onClick={handleEditSave}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductivityLossList;