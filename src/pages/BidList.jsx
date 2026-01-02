import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { Button, Card, Table, Alert, Spinner, Badge } from "react-bootstrap";

function BidList() {
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const userStr = localStorage.getItem("user");
  const user = userStr ? JSON.parse(userStr) : null;

  // Load bids when component mounts
  useEffect(() => {
    fetchBids();
  }, []);

  const fetchBids = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/bids`, {
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to fetch bids");
      }

      const data = await response.json();
      setBids(data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleNewBid = () => {
    navigate("/bid/new");
  };

  const handleViewBid = (bidId) => {
    navigate(`/bid/${bidId}`);
  };

  const handleDeleteBid = async (bidId, bidName) => {
    if (!window.confirm(`Are you sure you want to delete "${bidName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/bids/${bidId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error("Failed to delete bid");
      }

      // Refresh list
      fetchBids();
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <Spinner animation="border" variant="primary" />
        <p>Loading bids...</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>My BID Projects</h1>
          <p style={styles.subtitle}>
            {user?.role === 'admin' ? 'Viewing all bids' : 'Manage your bid evaluations'}
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={handleNewBid}>
          + New BID Evaluation
        </Button>
      </div>

      {error && (
        <Alert variant="danger" onClose={() => setError("")} dismissible>
          {error}
        </Alert>
      )}

      {bids.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Card.Body className="text-center py-5">
            <h3>No BID projects yet</h3>
            <p className="text-muted">Create your first bid evaluation to get started</p>
            <Button variant="primary" onClick={handleNewBid}>
              Create First BID
            </Button>
          </Card.Body>
        </Card>
      ) : (
        <Card>
          <Table hover responsive>
            <thead style={styles.tableHeader}>
              <tr>
                <th>Project Name</th>
                <th>Location</th>
                <th>Score</th>
                {user?.role === 'admin' && <th>Created By</th>}
                <th>Created At</th>
                <th>Updated At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((bid) => (
                <tr key={bid.id}>
                  <td>
                    <strong>{bid.bid_name}</strong>
                  </td>
                  <td>{bid.bid_location || '-'}</td>
                  <td>
                    <Badge 
                      bg={bid.total_score > 0 ? 'success' : bid.total_score < 0 ? 'danger' : 'secondary'}
                      style={{ fontSize: '1rem' }}
                    >
                      {bid.total_score}
                    </Badge>
                  </td>
                  {user?.role === 'admin' && (
                    <td>{bid.username || bid.email}</td>
                  )}
                  <td>{formatDate(bid.created_at)}</td>
                  <td>{formatDate(bid.updated_at)}</td>
                  <td>
                    <Button 
                      variant="outline-primary" 
                      size="sm" 
                      onClick={() => handleViewBid(bid.id)}
                      className="me-2"
                    >
                      View/Edit
                    </Button>
                    <Button 
                      variant="outline-danger" 
                      size="sm"
                      onClick={() => handleDeleteBid(bid.id, bid.bid_name)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}

const styles = {
  page: {
    padding: "2rem",
    maxWidth: "1400px",
    margin: "0 auto",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "2rem",
    flexWrap: "wrap",
    gap: "1rem",
  },
  title: {
    color: "#002b5c",
    marginBottom: "0.5rem",
  },
  subtitle: {
    color: "#666",
    margin: 0,
  },
  loading: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "60vh",
    gap: "1rem",
  },
  emptyCard: {
    marginTop: "2rem",
  },
  tableHeader: {
    backgroundColor: "#f8f9fa",
  },
};

export default BidList;