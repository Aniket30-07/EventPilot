import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const MyRegistrations = () => {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionFeedback, setActionFeedback] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/me/registrations`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to load registrations');
      }
      setRegistrations(data.registrations || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const handleCancelRegistration = async (registrationId, eventTitle) => {
    if (!window.confirm(`Are you sure you want to cancel your registration for "${eventTitle}"? Your seat will be released and you cannot re-register.`)) {
      return;
    }

    setCancellingId(registrationId);
    setActionFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/registrations/${registrationId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Cancellation failed');

      setActionFeedback({
        type: 'success',
        message: 'Your registration has been cancelled and your seat released.',
      });
      fetchRegistrations();
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message });
    } finally {
      setCancellingId(null);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const confirmedCount = registrations.filter((r) => r.status === 'confirmed').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Header */}
      <div className="hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span className="phase-tag" style={{ color: '#38bdf8' }}>Participant Tickets & Passes</span>
            <h1 className="hero-title" style={{ marginTop: '0.4rem', fontSize: '2.1rem' }}>
              My Event Registrations
            </h1>
            <p className="hero-desc">
              View your registered events, unique human-readable ticket reference codes, and manage your attendance status.
            </p>
          </div>
          <Link to="/events" className="btn-primary" style={{ padding: '0.65rem 1.25rem' }}>
            🔍 Browse More Events
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="status-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        <div className="status-card">
          <span className="status-label">Active Tickets</span>
          <div className="status-value" style={{ color: '#34d399' }}>{confirmedCount}</div>
          <div className="status-meta">Confirmed reservations</div>
        </div>

        <div className="status-card">
          <span className="status-label">Total History</span>
          <div className="status-value">{registrations.length}</div>
          <div className="status-meta">Including cancelled</div>
        </div>
      </div>

      {/* Action feedback */}
      {actionFeedback && (
        <div
          className={`status-indicator ${actionFeedback.type === 'success' ? 'connected' : 'disconnected'}`}
          style={{ padding: '0.85rem 1.25rem', borderRadius: '12px' }}
        >
          {actionFeedback.type === 'success' ? '✓' : '⚠️'} {actionFeedback.message}
        </div>
      )}

      {/* Registrations List */}
      <div className="hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700 }}>
            Your Event Tickets
          </h2>
          <button
            onClick={fetchRegistrations}
            disabled={loading}
            className="btn-primary"
            style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.05)', boxShadow: 'none' }}
          >
            {loading ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>

        {error && (
          <div className="status-indicator error" style={{ padding: '0.85rem 1rem', borderRadius: '10px' }}>
            ⚠️ {error}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)' }}>
            Loading your event tickets...
          </div>
        )}

        {!loading && registrations.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🎟️</div>
            <h3 style={{ fontSize: '1.3rem', marginBottom: '0.4rem' }}>No registrations yet</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
              You haven't registered for any events. Browse the public discovery portal to find upcoming events.
            </p>
            <Link to="/events" className="btn-primary">
              Discover Events Now →
            </Link>
          </div>
        )}

        {!loading && registrations.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {registrations.map((reg) => {
              const event = reg.eventId;
              const isConfirmed = reg.status === 'confirmed';

              return (
                <div
                  key={reg._id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '1.5rem',
                    borderRadius: '16px',
                    background: 'rgba(10, 14, 26, 0.7)',
                    border: isConfirmed ? '1px solid rgba(99, 102, 241, 0.25)' : '1px solid var(--border-subtle)',
                    gap: '1rem',
                  }}
                >
                  {/* Top Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      <span
                        className={`status-indicator ${isConfirmed ? 'connected' : 'disconnected'}`}
                        style={{ fontSize: '0.75rem', textTransform: 'uppercase', padding: '0.2rem 0.6rem' }}
                      >
                        <span className="pulse-dot"></span>
                        {reg.status}
                      </span>
                      {reg.checkedInAt && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.6rem',
                            borderRadius: '6px',
                            background: 'rgba(16, 185, 129, 0.15)',
                            color: '#34d399',
                            border: '1px solid rgba(16, 185, 129, 0.3)',
                          }}
                        >
                          ✓ Checked In
                        </span>
                      )}
                      {event && (
                        <span className="badge-phase" style={{ fontSize: '0.72rem' }}>
                          {event.category}
                        </span>
                      )}
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                      Registered: {formatDate(reg.registeredAt)}
                    </span>
                  </div>

                  {/* Ticket Stub Design */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(99, 102, 241, 0.08)',
                      border: '1px dashed rgba(99, 102, 241, 0.4)',
                      borderRadius: '12px',
                      padding: '1rem 1.25rem',
                      flexWrap: 'wrap',
                      gap: '1rem',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)' }}>
                        Official Ticket Code
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: '#38bdf8',
                          letterSpacing: '0.05em',
                          marginTop: '0.2rem',
                        }}
                      >
                        {reg.ticketCode}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                        Attendee Name
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                        {user?.name}
                      </div>
                    </div>
                  </div>

                  {/* Event Details */}
                  {event ? (
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.4rem' }}>
                        <Link to={`/events/${event._id}`} style={{ color: 'var(--text-main)' }}>
                          {event.title}
                        </Link>
                      </h3>
                      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        <span>📅 {formatDate(event.startAt)}</span>
                        <span>
                          {event.mode === 'online' ? '🌐 Virtual Event' : `📍 ${event.venue || 'Venue'}`}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                      [Event details archived]
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '0.75rem' }}>
                    {event && (
                      <Link
                        to={`/events/${event._id}`}
                        style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}
                      >
                        View Full Event Page →
                      </Link>
                    )}

                    {isConfirmed ? (
                      <button
                        onClick={() => handleCancelRegistration(reg._id, event?.title || 'this event')}
                        disabled={cancellingId === reg._id}
                        className="btn-primary"
                        style={{
                          padding: '0.45rem 1rem',
                          fontSize: '0.8rem',
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          color: '#f87171',
                          boxShadow: 'none',
                        }}
                        id={`cancel-reg-${reg._id}`}
                      >
                        {cancellingId === reg._id ? 'Cancelling...' : 'Cancel Registration'}
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                        Cancelled on {formatDate(reg.cancelledAt)} • Re-registration unavailable
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
