import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const Home = () => {
  const { user } = useAuth();
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }
      const data = await res.json();
      setHealthData(data);
      setLastChecked(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message);
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  const getDbStatusClass = () => {
    if (loading) return 'checking';
    if (!healthData) return 'disconnected';
    return healthData.database === 'connected' ? 'connected' : 'disconnected';
  };

  const getApiStatusClass = () => {
    if (loading) return 'checking';
    if (error) return 'disconnected';
    return healthData?.status === 'ok' ? 'ok' : 'disconnected';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      {/* Hero */}
      <section className="hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <span className="badge-phase">Phase 2 • Event Lifecycle & Discovery Active</span>
          {user && (
            <span className="status-indicator connected" style={{ fontSize: '0.8rem' }}>
              Logged in: {user.name} ({user.role})
            </span>
          )}
        </div>
        <h1 className="hero-title">Multi-Category Event Discovery & Management</h1>
        <p className="hero-desc">
          EventPilot connects participants and organizers across Hackathons, Conferences, Workshops, Webinars,
          Sports Tournaments, and Cultural Festivals. Organizers manage events with strict server-side ownership,
          while participants discover published events with real-time category and keyword filters.
        </p>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
          <Link to="/events" className="btn-primary" id="hero-explore-btn">
            🔍 Explore Published Events →
          </Link>
          {user ? (
            user.role === 'organizer' ? (
              <Link to="/organizer" className="btn-primary" id="hero-organizer-btn" style={{ background: 'rgba(255, 255, 255, 0.08)', boxShadow: 'none' }}>
                Open Organizer Center
              </Link>
            ) : (
              <Link to="/participant" className="btn-primary" id="hero-participant-btn" style={{ background: 'rgba(255, 255, 255, 0.08)', boxShadow: 'none' }}>
                Open Participant Portal
              </Link>
            )
          ) : (
            <>
              <Link to="/login" className="btn-primary" id="hero-signin-btn">
                Sign In to Account →
              </Link>
              <Link
                to="/register"
                className="btn-primary"
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'none',
                }}
                id="hero-register-btn"
              >
                Create Participant Account
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Health Grid */}
      <section className="health-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="section-title">
            <span>⚡ System Health & Connection Status</span>
          </h2>
          <button 
            className="btn-primary" 
            onClick={checkHealth} 
            disabled={loading}
            id="recheck-health-btn"
          >
            {loading ? 'Checking...' : 'Re-check Status'}
          </button>
        </div>

        <div className="status-grid">
          {/* API Status */}
          <div className="status-card">
            <div className="status-card-header">
              <span className="status-label">Backend API</span>
              <span className={`status-indicator ${getApiStatusClass()}`}>
                <span className="pulse-dot"></span>
                {loading ? 'Pinging' : error ? 'Offline' : 'Online'}
              </span>
            </div>
            <div className="status-value">
              {loading ? 'Pinging...' : error ? 'Unavailable' : 'Express API'}
            </div>
            <div className="status-meta">
              Endpoint: {API_BASE}/health
            </div>
          </div>

          {/* MongoDB Status */}
          <div className="status-card">
            <div className="status-card-header">
              <span className="status-label">MongoDB Database</span>
              <span className={`status-indicator ${getDbStatusClass()}`}>
                <span className="pulse-dot"></span>
                {loading ? 'Checking' : healthData?.database || 'Disconnected'}
              </span>
            </div>
            <div className="status-value">
              {loading ? 'Checking...' : healthData?.database === 'connected' ? 'Atlas Cluster' : 'Disconnected'}
            </div>
            <div className="status-meta">
              Driver: Mongoose 8.x
            </div>
          </div>

          {/* User Session Status */}
          <div className="status-card">
            <div className="status-card-header">
              <span className="status-label">Auth Session</span>
              <span className={`status-indicator ${user ? 'connected' : 'pending'}`}>
                {user ? `Active (${user.role})` : 'Guest'}
              </span>
            </div>
            <div className="status-value">
              {user ? user.name : 'Not Signed In'}
            </div>
            <div className="status-meta">
              JWT Cookie / Bearer
            </div>
          </div>
        </div>

        {/* Raw Response Box */}
        <div>
          <span className="status-label" style={{ display: 'block', marginBottom: '0.5rem' }}>
            Health Endpoint Response Payload
          </span>
          <pre className="response-box" id="health-response-box">
            {loading && '// Awaiting response from backend...'}
            {error && `// Connection error: ${error}\n// Ensure the backend server is running on port 5000.`}
            {healthData && JSON.stringify(healthData, null, 2)}
          </pre>
        </div>
      </section>

      {/* PRD Roadmap */}
      <section className="health-section">
        <h2 className="section-title">
          <span>📋 MVP Phase Execution Roadmap</span>
        </h2>
        <div className="roadmap-grid">
          <div className="phase-item">
            <div className="phase-header">
              <span className="phase-tag">Phase 0</span>
              <span className="phase-status ready-tag" style={{ color: '#34d399' }}>✓ Done</span>
            </div>
            <h3 className="phase-title">Repo Setup & Baseline</h3>
            <p className="phase-desc">Vite + React, Express + Mongoose, Atlas connection & health check verified.</p>
          </div>

          <div className="phase-item">
            <div className="phase-header">
              <span className="phase-tag">Phase 1</span>
              <span className="phase-status ready-tag" style={{ color: '#34d399' }}>✓ Done</span>
            </div>
            <h3 className="phase-title">Authentication & Roles</h3>
            <p className="phase-desc">User model, registration, login/logout, password hashing, and role checks.</p>
          </div>

          <div className="phase-item">
            <div className="phase-header">
              <span className="phase-tag">Phase 2</span>
              <span className="phase-status ready-tag" style={{ color: '#34d399' }}>✓ Done</span>
            </div>
            <h3 className="phase-title">Event Lifecycle & Discovery</h3>
            <p className="phase-desc">Shared event model, organizer CRUD/publish/cancel, discovery search & filters.</p>
          </div>

          <div className="phase-item">
            <div className="phase-header">
              <span className="phase-tag">Phase 3</span>
              <span className="phase-status ready-tag" style={{ color: '#34d399' }}>✓ Done</span>
            </div>
            <h3 className="phase-title">Registrations & Tickets</h3>
            <p className="phase-desc">Capacity enforcement, unique compound index, ticket code generation.</p>
          </div>

          <div className="phase-item">
            <div className="phase-header">
              <span className="phase-tag">Phase 4</span>
              <span className="phase-status ready-tag" style={{ color: '#34d399' }}>✓ Done</span>
            </div>
            <h3 className="phase-title">Organizer & Attendance</h3>
            <p className="phase-desc">Attendee list, manual check-in with timestamps, idempotent attendance.</p>
          </div>

          <div className="phase-item active">
            <div className="phase-header">
              <span className="phase-tag">Phase 5 & 6</span>
              <span className="phase-status active-tag" style={{ color: '#38bdf8' }}>✓ Verified</span>
            </div>
            <h3 className="phase-title">E2E Verification & Delivery</h3>
            <p className="phase-desc">Security boundaries, capacity edge cases, README & final delivery.</p>
          </div>
        </div>
      </section>
    </div>
  );
};
