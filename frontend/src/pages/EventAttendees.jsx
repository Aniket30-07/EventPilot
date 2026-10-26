import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const EventAttendees = () => {
  const { eventId } = useParams();
  const { user } = useAuth();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // all, checkedIn, pending, cancelled
  const [checkingInId, setCheckingInId] = useState(null);

  const fetchAttendees = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/events/${eventId}/attendees`, {
        credentials: 'include',
      });
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.message || 'Failed to load attendees');
      }
      setData(resData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchAttendees();
  }, [fetchAttendees]);

  const handleCheckIn = async (registrationId, ticketCode) => {
    setCheckingInId(registrationId);
    setFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/events/${eventId}/registrations/${registrationId}/check-in`, {
        method: 'POST',
        credentials: 'include',
      });
      const resData = await res.json();

      if (!res.ok) {
        throw new Error(resData.message || 'Check-in failed');
      }

      setFeedback({
        type: 'success',
        message: `Successfully checked in ticket ${ticketCode}!`,
      });

      // Refresh list to update database-derived check-in metrics
      fetchAttendees();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message,
      });
    } finally {
      setCheckingInId(null);
    }
  };

  const attendees = data?.attendees || [];
  const metrics = data?.metrics || {
    totalCount: 0,
    confirmedCount: 0,
    checkedInCount: 0,
    cancelledCount: 0,
    checkInRate: 0,
    remainingSeats: 0,
  };
  const event = data?.event;

  // Filter and search logic
  const filteredAttendees = attendees.filter((item) => {
    const participantName = item.participantId?.name?.toLowerCase() || '';
    const participantEmail = item.participantId?.email?.toLowerCase() || '';
    const ticket = item.ticketCode?.toLowerCase() || '';
    const query = searchQuery.toLowerCase().trim();

    const matchesQuery =
      !query ||
      participantName.includes(query) ||
      participantEmail.includes(query) ||
      ticket.includes(query);

    if (!matchesQuery) return false;

    if (filterStatus === 'checkedIn') {
      return item.status === 'confirmed' && !!item.checkedInAt;
    }
    if (filterStatus === 'pending') {
      return item.status === 'confirmed' && !item.checkedInAt;
    }
    if (filterStatus === 'cancelled') {
      return item.status === 'cancelled';
    }

    return true;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Navigation & Header */}
      <div>
        <Link
          to="/organizer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
            marginBottom: '0.75rem',
          }}
        >
          ← Back to Organizer Command Center
        </Link>

        <div className="hero-card" style={{ borderTop: '2px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <span className="phase-tag" style={{ color: 'var(--primary)' }}>
                Phase 4 • Attendee Management & Live Check-In
              </span>
              <h1 className="hero-title" style={{ marginTop: '0.4rem', fontSize: '2rem' }}>
                {event ? event.title : 'Event Attendees'}
              </h1>
              <p className="hero-desc">
                Owner-only attendee roster, real-time ticket validation, and manual check-in tracking.
              </p>
            </div>

            <button
              onClick={fetchAttendees}
              disabled={loading}
              className="btn-primary"
              style={{
                padding: '0.6rem 1.2rem',
                background: 'rgba(255, 255, 255, 0.08)',
                boxShadow: 'none',
              }}
            >
              {loading ? 'Refreshing...' : '↻ Refresh Roster'}
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Alert */}
      {feedback && (
        <div
          className={`status-indicator ${feedback.type === 'success' ? 'connected' : 'disconnected'}`}
          style={{ padding: '0.85rem 1.25rem', borderRadius: '10px' }}
        >
          {feedback.type === 'success' ? '✓' : '⚠️'} {feedback.message}
        </div>
      )}

      {error && (
        <div className="status-indicator disconnected" style={{ padding: '1rem', borderRadius: '10px' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Database-Derived Metrics Grid */}
      <div className="status-grid">
        <div className="status-card">
          <span className="status-label">Total Capacity</span>
          <div className="status-value">{event?.capacity || 0}</div>
          <div className="status-meta">Max allowable attendees</div>
        </div>

        <div className="status-card">
          <span className="status-label">Confirmed Registrations</span>
          <div className="status-value" style={{ color: '#38bdf8' }}>
            {metrics.confirmedCount}
          </div>
          <div className="status-meta">{metrics.remainingSeats} seats remaining</div>
        </div>

        <div className="status-card">
          <span className="status-label">Checked-In Attendees</span>
          <div className="status-value" style={{ color: '#34d399' }}>
            {metrics.checkedInCount}
          </div>
          <div className="status-meta">Verified at entrance</div>
        </div>

        <div className="status-card">
          <span className="status-label">Live Check-In Rate</span>
          <div className="status-value" style={{ color: '#a5b4fc' }}>
            {metrics.checkInRate}%
          </div>
          <div className="status-meta">Of confirmed attendees</div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div
        className="hero-card"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem',
          padding: '1rem 1.5rem',
        }}
      >
        <div style={{ flex: '1 1 280px' }}>
          <input
            type="text"
            placeholder="🔍 Search by participant name, email, or ticket code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '0.6rem 1rem',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              background: 'rgba(0, 0, 0, 0.3)',
              color: 'var(--text-main)',
              fontSize: '0.88rem',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {[
            { id: 'all', label: `All (${attendees.length})` },
            { id: 'pending', label: `Pending Check-in (${metrics.confirmedCount - metrics.checkedInCount})` },
            { id: 'checkedIn', label: `Checked In (${metrics.checkedInCount})` },
            { id: 'cancelled', label: `Cancelled (${metrics.cancelledCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              style={{
                padding: '0.45rem 0.9rem',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                border: filterStatus === tab.id ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                background: filterStatus === tab.id ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                color: filterStatus === tab.id ? '#a5b4fc' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Attendees Table / Cards */}
      <div className="hero-card">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>
          Attendee Roster ({filteredAttendees.length})
        </h2>

        {loading && (
          <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
            Loading attendees...
          </div>
        )}

        {!loading && filteredAttendees.length === 0 && (
          <div style={{ textAlign: 'center', padding: '3rem 1.5rem', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
            <p>No attendees match the selected search or filter criteria.</p>
          </div>
        )}

        {!loading && filteredAttendees.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredAttendees.map((att) => {
              const isConfirmed = att.status === 'confirmed';
              const isCheckedIn = isConfirmed && !!att.checkedInAt;
              const isPending = isConfirmed && !att.checkedInAt;
              const isCancelled = att.status === 'cancelled';
              const isProcessing = checkingInId === att._id;

              return (
                <div
                  key={att._id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem 1.25rem',
                    borderRadius: '12px',
                    background: isCheckedIn
                      ? 'rgba(16, 185, 129, 0.06)'
                      : isCancelled
                      ? 'rgba(239, 68, 68, 0.04)'
                      : 'rgba(0, 0, 0, 0.25)',
                    border: isCheckedIn
                      ? '1px solid rgba(16, 185, 129, 0.25)'
                      : '1px solid var(--border-subtle)',
                    flexWrap: 'wrap',
                    gap: '1rem',
                  }}
                >
                  {/* Left Column: Participant info & Ticket */}
                  <div style={{ flex: '1 1 260px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.3rem' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: 'rgba(56, 189, 248, 0.15)',
                          color: '#38bdf8',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {att.ticketCode}
                      </span>

                      {/* Status Tag */}
                      <span
                        style={{
                          fontSize: '0.7rem',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: isConfirmed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: isConfirmed ? '#34d399' : '#f87171',
                        }}
                      >
                        {att.status}
                      </span>
                    </div>

                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)' }}>
                      {att.participantId?.name || 'Unknown User'}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
                      {att.participantId?.email || '—'} • Registered: {formatDate(att.registeredAt)}
                    </div>
                  </div>

                  {/* Middle Column: Check-in status & timestamp */}
                  <div style={{ flex: '1 1 200px' }}>
                    {isCheckedIn && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            fontSize: '0.8rem',
                            fontWeight: 700,
                            color: '#34d399',
                          }}
                        >
                          ✓ Checked In
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                          Time: {formatDate(att.checkedInAt)}
                        </span>
                      </div>
                    )}

                    {isPending && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.35rem',
                          fontSize: '0.8rem',
                          color: 'var(--text-muted)',
                        }}
                      >
                        ⏳ Pending Check-In
                      </span>
                    )}

                    {isCancelled && (
                      <span style={{ fontSize: '0.8rem', color: '#f87171' }}>
                        Seat released on {formatDate(att.cancelledAt)}
                      </span>
                    )}
                  </div>

                  {/* Right Column: Check-in action button */}
                  <div>
                    {isPending && (
                      <button
                        onClick={() => handleCheckIn(att._id, att.ticketCode)}
                        disabled={isProcessing}
                        className="btn-primary"
                        style={{
                          padding: '0.45rem 1.1rem',
                          fontSize: '0.82rem',
                          background: 'linear-gradient(135deg, #10b981, #059669)',
                          fontWeight: 700,
                        }}
                      >
                        {isProcessing ? 'Verifying...' : '✓ Manual Check-In'}
                      </button>
                    )}

                    {isCheckedIn && (
                      <button
                        disabled
                        style={{
                          padding: '0.45rem 1rem',
                          fontSize: '0.8rem',
                          borderRadius: '8px',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          background: 'rgba(16, 185, 129, 0.1)',
                          color: '#34d399',
                          cursor: 'default',
                        }}
                      >
                        Checked In
                      </button>
                    )}

                    {isCancelled && (
                      <button
                        disabled
                        style={{
                          padding: '0.45rem 1rem',
                          fontSize: '0.8rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-subtle)',
                          background: 'rgba(255, 255, 255, 0.03)',
                          color: 'var(--text-dim)',
                          cursor: 'not-allowed',
                        }}
                      >
                        Ineligible
                      </button>
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
