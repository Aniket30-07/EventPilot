import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const OrganizerDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/events/mine/analytics`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to load organizer analytics');
      }
      setAnalyticsData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handlePublish = async (eventId) => {
    try {
      const res = await fetch(`${API_BASE}/events/${eventId}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to publish');
      setActionFeedback({ type: 'success', message: 'Event published and is now discoverable!' });
      fetchDashboardData();
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message });
    }
  };

  const handleCancel = async (eventId) => {
    if (!window.confirm('Cancel this event? It will be removed from public discovery.')) return;
    try {
      const res = await fetch(`${API_BASE}/events/${eventId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to cancel');
      setActionFeedback({ type: 'success', message: 'Event cancelled.' });
      fetchDashboardData();
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message });
    }
  };

  const myEvents = analyticsData?.events || [];
  const summary = analyticsData?.summary || {
    totalEvents: 0,
    publishedEvents: 0,
    totalCapacity: 0,
    totalRegistrations: 0,
    confirmedRegistrations: 0,
    cancelledRegistrations: 0,
    checkedInAttendees: 0,
    overallCheckInRate: 0,
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Top Banner */}
      <div className="hero-card" style={{ borderTop: '2px solid var(--primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="phase-tag" style={{ color: 'var(--primary)' }}>Phase 4 • Organizer Dashboard & Analytics</span>
            <h1 className="hero-title" style={{ marginTop: '0.4rem', fontSize: '2.1rem' }}>
              Organizer Command Center
            </h1>
            <p className="hero-desc">
              Portfolio overview with database-derived attendance metrics, check-in rate tracking, and attendee roster access.
            </p>
          </div>

          <Link
            to="/organizer/events/new"
            className="btn-primary"
            id="create-new-event-btn"
            style={{ padding: '0.75rem 1.4rem' }}
          >
            ＋ Create New Event
          </Link>
        </div>
      </div>

      {/* Database-Derived Portfolio Metrics Row */}
      <div className="status-grid">
        <div className="status-card">
          <span className="status-label">Total Events</span>
          <div className="status-value">{summary.totalEvents}</div>
          <div className="status-meta">{summary.publishedEvents} published live</div>
        </div>

        <div className="status-card">
          <span className="status-label">Confirmed Registrations</span>
          <div className="status-value" style={{ color: '#38bdf8' }}>
            {summary.confirmedRegistrations}
          </div>
          <div className="status-meta">Across {summary.totalCapacity} total capacity</div>
        </div>

        <div className="status-card">
          <span className="status-label">Checked-In Attendees</span>
          <div className="status-value" style={{ color: '#34d399' }}>
            {summary.checkedInAttendees}
          </div>
          <div className="status-meta">Verified at entrance</div>
        </div>

        <div className="status-card">
          <span className="status-label">Overall Attendance Rate</span>
          <div className="status-value" style={{ color: '#a5b4fc' }}>
            {summary.overallCheckInRate}%
          </div>
          <div className="status-meta">Database-derived check-in rate</div>
        </div>
      </div>

      {/* Feedback banner */}
      {actionFeedback && (
        <div
          className={`status-indicator ${actionFeedback.type === 'success' ? 'connected' : 'disconnected'}`}
          style={{ padding: '0.75rem 1.25rem', borderRadius: '10px' }}
        >
          {actionFeedback.type === 'success' ? '✓' : '⚠️'} {actionFeedback.message}
        </div>
      )}

      {/* Events List */}
      <div className="hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>
            Your Managed Events & Roster
          </h2>
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="btn-primary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.05)', boxShadow: 'none' }}
          >
            {loading ? 'Refreshing...' : '↻ Refresh Dashboard'}
          </button>
        </div>

        {error && (
          <div className="status-indicator error" style={{ padding: '0.75rem 1rem', borderRadius: '10px' }}>
            ⚠️ {error}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            Loading organizer dashboard...
          </div>
        )}

        {!loading && myEvents.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📋</div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.4rem' }}>No events created yet</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Create your first event to publish it and manage registrations & check-ins.
            </p>
            <Link to="/organizer/events/new" className="btn-primary">
              ＋ Create Event Now
            </Link>
          </div>
        )}

        {!loading && myEvents.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {myEvents.map((ev) => (
              <div
                key={ev._id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1.25rem 1.4rem',
                  borderRadius: '12px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  border: '1px solid var(--border-subtle)',
                  flexWrap: 'wrap',
                  gap: '1.25rem',
                }}
              >
                {/* Event Details */}
                <div style={{ flex: '1 1 320px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        textTransform: 'uppercase',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '4px',
                        fontWeight: 700,
                        background:
                          ev.status === 'published'
                            ? 'rgba(16, 185, 129, 0.2)'
                            : ev.status === 'draft'
                            ? 'rgba(245, 158, 11, 0.2)'
                            : 'rgba(239, 68, 68, 0.2)',
                        color:
                          ev.status === 'published'
                            ? '#34d399'
                            : ev.status === 'draft'
                            ? '#fbbf24'
                            : '#f87171',
                      }}
                    >
                      {ev.status}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                      {ev.category} • Capacity: {ev.capacity}
                    </span>
                  </div>

                  <h4 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.4rem 0' }}>
                    <Link to={`/events/${ev._id}`} style={{ color: 'var(--text-main)' }}>
                      {ev.title}
                    </Link>
                  </h4>

                  {/* Database-Derived Metric Pills */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        background: 'rgba(56, 189, 248, 0.1)',
                        border: '1px solid rgba(56, 189, 248, 0.2)',
                        color: '#38bdf8',
                        fontWeight: 600,
                      }}
                    >
                      🎟️ {ev.confirmedCount} / {ev.capacity} Registered
                    </span>

                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        background: 'rgba(16, 185, 129, 0.1)',
                        border: '1px solid rgba(16, 185, 129, 0.2)',
                        color: '#34d399',
                        fontWeight: 600,
                      }}
                    >
                      ✓ {ev.checkedInCount} Checked In ({ev.checkInRate}%)
                    </span>

                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.2rem 0.6rem',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-dim)',
                      }}
                    >
                      💺 {ev.remainingSeats} Seats Left
                    </span>
                  </div>
                </div>

                {/* Event Actions & Attendee Management */}
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Primary Phase 4 Action: Manage Attendees */}
                  <Link
                    to={`/organizer/events/${ev._id}/attendees`}
                    className="btn-primary"
                    style={{
                      padding: '0.45rem 0.9rem',
                      fontSize: '0.82rem',
                      background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                      fontWeight: 600,
                    }}
                  >
                    👥 Attendees ({ev.confirmedCount})
                  </Link>

                  <Link
                    to={`/events/${ev._id}`}
                    className="btn-primary"
                    style={{ padding: '0.45rem 0.8rem', fontSize: '0.82rem', background: 'rgba(255, 255, 255, 0.08)', boxShadow: 'none' }}
                  >
                    View
                  </Link>

                  {ev.status !== 'cancelled' && (
                    <button
                      onClick={() => navigate(`/organizer/events/${ev._id}/edit`)}
                      className="btn-primary"
                      style={{ padding: '0.45rem 0.8rem', fontSize: '0.82rem', background: 'rgba(255, 255, 255, 0.08)', boxShadow: 'none' }}
                    >
                      Edit
                    </button>
                  )}

                  {ev.status === 'draft' && (
                    <button
                      onClick={() => handlePublish(ev._id)}
                      className="btn-primary"
                      style={{ padding: '0.45rem 0.8rem', fontSize: '0.82rem', background: 'linear-gradient(135deg, #10b981, #059669)' }}
                    >
                      Publish
                    </button>
                  )}

                  {ev.status === 'published' && (
                    <button
                      onClick={() => handleCancel(ev._id)}
                      className="btn-primary"
                      style={{
                        padding: '0.45rem 0.8rem',
                        fontSize: '0.82rem',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#f87171',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        boxShadow: 'none',
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
