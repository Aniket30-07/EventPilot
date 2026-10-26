import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const ParticipantDashboard = () => {
  const { user } = useAuth();
  const [roleTestResult, setRoleTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  const testOrganizerAccess = async () => {
    setTesting(true);
    setRoleTestResult(null);
    try {
      const res = await fetch(`${API_BASE}/auth/organizer-only`, {
        credentials: 'include',
      });
      const data = await res.json();
      setRoleTestResult({
        status: res.status,
        ok: res.ok,
        data,
      });
    } catch (err) {
      setRoleTestResult({ status: 500, ok: false, error: err.message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="phase-tag" style={{ color: '#38bdf8' }}>Participant Portal</span>
            <h1 className="hero-title" style={{ marginTop: '0.4rem', fontSize: '1.9rem' }}>
              Welcome, {user?.name}!
            </h1>
            <p className="hero-desc">
              Your participant account is authenticated and active.
            </p>
          </div>
          <span
            className="status-indicator connected"
            style={{ fontSize: '0.85rem' }}
          >
            Role: {user?.role}
          </span>
        </div>
      </div>

      {/* User Information & Role Enforcement Test */}
      <div className="status-grid">
        <div className="status-card">
          <span className="status-label">Profile Details</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Name</span>
              <div style={{ fontWeight: 600 }}>{user?.name}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Email</span>
              <div style={{ fontWeight: 600 }}>{user?.email}</div>
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>User ID</span>
              <div className="status-meta">{user?._id || user?.id}</div>
            </div>
          </div>
        </div>

        {/* Server-Side Authorization Boundary Test */}
        <div className="status-card">
          <span className="status-label">Security & Role Check</span>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Verify server-side authorization: Try calling an Organizer-only protected endpoint from your Participant session.
          </p>
          <button
            onClick={testOrganizerAccess}
            disabled={testing}
            className="btn-primary"
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.85rem',
              background: 'rgba(239, 68, 68, 0.2)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              boxShadow: 'none',
              width: 'fit-content',
            }}
            id="test-organizer-auth-btn"
          >
            {testing ? 'Testing...' : 'Test Organizer API Access'}
          </button>

          {roleTestResult && (
            <div
              style={{
                marginTop: '0.5rem',
                padding: '0.75rem',
                borderRadius: '8px',
                background: roleTestResult.status === 403 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                border: `1px solid ${roleTestResult.status === 403 ? 'rgba(245, 158, 11, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                fontSize: '0.8rem',
              }}
              id="role-test-result"
            >
              <div style={{ fontWeight: 700, color: roleTestResult.status === 403 ? '#fbbf24' : '#f87171' }}>
                HTTP Status: {roleTestResult.status} {roleTestResult.status === 403 && '(Expected: 403 Forbidden)'}
              </div>
              <div style={{ marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                {roleTestResult.data?.message || roleTestResult.error}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Phase 3 Active: My Tickets Banner */}
      <div className="hero-card" style={{ padding: '1.75rem', borderLeft: '4px solid #38bdf8' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="phase-tag" style={{ color: '#38bdf8' }}>Active Feature • Phase 3</span>
            <h3 style={{ fontSize: '1.25rem', marginTop: '0.35rem', marginBottom: '0.4rem' }}>
              My Tickets & Registrations
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '600px' }}>
              Manage your confirmed event registrations, view your human-readable ticket reference codes, or release seats via cancellation.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/my-registrations" className="btn-primary" id="dashboard-my-tickets-btn">
              🎟️ View My Tickets
            </Link>
            <Link to="/events" className="btn-primary" style={{ background: 'rgba(255, 255, 255, 0.08)', boxShadow: 'none' }}>
              Browse Events
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
