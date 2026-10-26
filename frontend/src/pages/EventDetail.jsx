import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export const EventDetail = () => {
  const { eventId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Registration & capacity status
  const [regStatus, setRegStatus] = useState(null);
  const [regLoading, setRegLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState(null);

  const fetchEvent = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/events/${eventId}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Event not found or not published.');
      }
      setEvent(data.event);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const fetchRegistrationStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/events/${eventId}/my-registration`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setRegStatus(data);
      }
    } catch (err) {
      console.warn('[EventDetail] Failed to check registration status:', err.message);
    }
  }, [eventId]);

  useEffect(() => {
    fetchEvent();
    fetchRegistrationStatus();
  }, [fetchEvent, fetchRegistrationStatus]);

  const isOwner = Boolean(
    user &&
    event &&
    ((typeof event.organizerId === 'object' &&
      (event.organizerId?._id === user._id ||
        event.organizerId?._id?.toString() === user._id?.toString())) ||
      event.organizerId === user._id ||
      event.organizerId?.toString() === user._id?.toString())
  );

  const handleRegister = async () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/events/${eventId}` } } });
      return;
    }

    setRegLoading(true);
    setActionFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/events/${eventId}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      setActionFeedback({
        type: 'success',
        message: `Registered successfully! Your ticket code is: ${data.registration.ticketCode}`,
      });
      fetchRegistrationStatus();
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message });
    } finally {
      setRegLoading(false);
    }
  };

  const handleCancelRegistration = async (registrationId) => {
    if (!window.confirm('Cancel your registration for this event? Your seat will be released and you cannot re-register.')) {
      return;
    }

    setRegLoading(true);
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
        message: 'Your registration has been cancelled. Seat released.',
      });
      fetchRegistrationStatus();
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message });
    } finally {
      setRegLoading(false);
    }
  };

  const handlePublish = async () => {
    setActionLoading(true);
    setActionFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/events/${eventId}/publish`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to publish');
      setEvent(data.event);
      setActionFeedback({ type: 'success', message: 'Event successfully published!' });
      fetchRegistrationStatus();
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelEvent = async () => {
    if (!window.confirm('Are you sure you want to cancel this event? This action will remove it from discovery.')) {
      return;
    }
    setActionLoading(true);
    setActionFeedback(null);
    try {
      const res = await fetch(`${API_BASE}/events/${eventId}/cancel`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to cancel');
      setEvent(data.event);
      setActionFeedback({ type: 'success', message: 'Event marked as cancelled.' });
    } catch (err) {
      setActionFeedback({ type: 'error', message: err.message });
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 1rem' }}>
        <div className="status-indicator checking" style={{ margin: '0 auto', display: 'inline-flex' }}>
          <span className="pulse-dot"></span>
          Loading event details...
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="hero-card" style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>⚠️</div>
        <h2 style={{ fontSize: '1.6rem', marginBottom: '0.5rem' }}>Event Unavailable</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          {error || 'The requested event could not be found or is not published.'}
        </p>
        <Link to="/events" className="btn-primary" style={{ margin: '0 auto' }}>
          ← Back to Event Discovery
        </Link>
      </div>
    );
  }

  const now = new Date();
  const deadlinePassed = now > new Date(event.registrationDeadline);
  const eventEnded = now > new Date(event.endAt);
  const remainingSeats = regStatus ? regStatus.remainingSeats : Math.max(0, event.capacity - (regStatus?.confirmedCount || 0));
  const isFull = regStatus ? regStatus.remainingSeats === 0 : false;
  const userReg = regStatus?.userRegistration;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link to="/events" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          ← Back to All Events
        </Link>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <span
            className={`status-indicator ${
              event.status === 'published' ? 'connected' : event.status === 'draft' ? 'checking' : 'disconnected'
            }`}
          >
            Status: {event.status.toUpperCase()}
          </span>
          <span className="badge-phase">{event.category}</span>
        </div>
      </div>

      {/* Main Event Card */}
      <div className="hero-card">
        <h1 className="hero-title" style={{ fontSize: '2.2rem', marginBottom: '1rem' }}>
          {event.title}
        </h1>

        <p style={{ color: 'var(--text-main)', fontSize: '1.05rem', lineHeight: '1.7', whiteSpace: 'pre-wrap', marginBottom: '2rem' }}>
          {event.description}
        </p>

        {/* Action feedback */}
        {actionFeedback && (
          <div
            className={`status-indicator ${actionFeedback.type === 'success' ? 'connected' : 'disconnected'}`}
            style={{ padding: '0.85rem 1rem', borderRadius: '10px', marginBottom: '1.5rem', width: '100%' }}
          >
            {actionFeedback.type === 'success' ? '✓' : '⚠️'} {actionFeedback.message}
          </div>
        )}

        {/* Event Key Specs Grid */}
        <div className="status-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
          <div className="status-card">
            <span className="status-label">Date & Time</span>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '0.25rem' }}>
              {formatDate(event.startAt)}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>
              Until: {formatDate(event.endAt)}
            </div>
          </div>

          <div className="status-card">
            <span className="status-label">Attendance Mode</span>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '0.25rem' }}>
              {event.mode === 'online' ? '🌐 Online Event' : '📍 In-Person Event'}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {event.mode === 'online' ? (event.onlineLink || 'Virtual meeting link') : (event.venue || 'Venue details')}
            </div>
          </div>

          <div className="status-card">
            <span className="status-label">Capacity & Seats</span>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '0.25rem' }}>
              {regStatus ? `${regStatus.confirmedCount} / ${event.capacity} Registered` : `${event.capacity} Total Seats`}
            </div>
            <div style={{ fontSize: '0.8rem', color: isFull ? '#f87171' : '#34d399', fontWeight: 600 }}>
              {isFull ? '🔴 Capacity Full' : `🟢 ${remainingSeats} Seats Available`}
            </div>
          </div>

          <div className="status-card">
            <span className="status-label">Registration Deadline</span>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '0.25rem' }}>
              {formatDate(event.registrationDeadline)}
            </div>
            <div style={{ fontSize: '0.8rem', color: deadlinePassed ? '#f87171' : 'var(--text-dim)' }}>
              {deadlinePassed ? '⚠️ Deadline Passed' : 'Open for registration'}
            </div>
          </div>
        </div>
      </div>

      {/* Participant Registration Module */}
      {event.status === 'published' && !isOwner && (
        <div className="hero-card" style={{ borderLeft: '4px solid var(--accent)' }}>
          <span className="phase-tag" style={{ color: '#38bdf8' }}>Participant Registration</span>
          <h3 style={{ fontSize: '1.25rem', marginTop: '0.4rem', marginBottom: '0.5rem' }}>
            Event Ticket & Registration
          </h3>

          {!user ? (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                Sign in to your EventPilot account to reserve your ticket and secure your seat.
              </p>
              <button
                onClick={() => navigate('/login', { state: { from: { pathname: `/events/${eventId}` } } })}
                className="btn-primary"
                id="signin-to-register-btn"
              >
                Sign In to Register →
              </button>
            </div>
          ) : userReg && userReg.status === 'confirmed' ? (
            /* User is already registered and confirmed */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px dashed rgba(16, 185, 129, 0.4)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  flexWrap: 'wrap',
                  gap: '1rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span className="status-indicator connected" style={{ fontSize: '0.75rem' }}>
                      ✓ CONFIRMED REGISTRATION
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.5rem', textTransform: 'uppercase' }}>
                    Your Ticket Reference Code
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '1.4rem',
                      fontWeight: 700,
                      color: '#34d399',
                      letterSpacing: '0.06em',
                      marginTop: '0.2rem',
                    }}
                    id="user-ticket-code"
                  >
                    {userReg.ticketCode}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                  <Link
                    to="/my-registrations"
                    className="btn-primary"
                    style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                  >
                    View in My Tickets →
                  </Link>
                  <button
                    onClick={() => handleCancelRegistration(userReg._id)}
                    disabled={regLoading}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#f87171',
                      fontSize: '0.8rem',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                    id="cancel-reg-btn"
                  >
                    {regLoading ? 'Cancelling...' : 'Cancel This Registration'}
                  </button>
                </div>
              </div>
            </div>
          ) : userReg && userReg.status === 'cancelled' ? (
            /* User cancelled previously */
            <div
              style={{
                padding: '1rem',
                borderRadius: '10px',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '0.9rem',
              }}
            >
              ⚠️ <strong>Registration Cancelled:</strong> You previously cancelled your registration for this event.
              Per EventPilot rules, re-registration after cancellation is not permitted.
            </div>
          ) : deadlinePassed ? (
            /* Deadline passed */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                disabled
                className="btn-primary"
                style={{ opacity: 0.6, cursor: 'not-allowed', width: 'fit-content' }}
              >
                ⛔ Registration Closed (Deadline Passed)
              </button>
              <span style={{ fontSize: '0.8rem', color: '#f87171' }}>
                The registration deadline of {formatDate(event.registrationDeadline)} has expired.
              </span>
            </div>
          ) : eventEnded ? (
            /* Event ended */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                disabled
                className="btn-primary"
                style={{ opacity: 0.6, cursor: 'not-allowed', width: 'fit-content' }}
              >
                🏁 Event Concluded
              </button>
            </div>
          ) : isFull ? (
            /* Event full */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                disabled
                className="btn-primary"
                style={{ opacity: 0.6, cursor: 'not-allowed', width: 'fit-content' }}
                id="event-full-btn"
              >
                🔴 Event Full (Capacity Reached)
              </button>
              <span style={{ fontSize: '0.8rem', color: '#f87171' }}>
                All {event.capacity} seats for this event are currently reserved.
              </span>
            </div>
          ) : (
            /* Open for registration */
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
                Reserve your verified seat. You will instantly receive a unique human-readable ticket reference code.
              </p>
              <button
                onClick={handleRegister}
                disabled={regLoading}
                className="btn-primary"
                id="register-for-event-btn"
                style={{ padding: '0.75rem 1.6rem', fontSize: '0.95rem' }}
              >
                {regLoading ? 'Reserving Ticket...' : '🎟️ Register for this Event'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Organizer Controls (Only if Owner) */}
      {isOwner && (
        <div className="hero-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <span className="phase-tag" style={{ color: 'var(--primary)' }}>Owner Event Controls</span>
          <h3 style={{ fontSize: '1.25rem', marginTop: '0.4rem', marginBottom: '0.5rem' }}>
            Manage Your Event
          </h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
            You are verified as the owner of this event. Confirmed attendees: <strong>{regStatus?.confirmedCount || 0} / {event.capacity}</strong>.
          </p>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link
              to={`/organizer/events/${event._id}/attendees`}
              className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)', fontWeight: 600 }}
              id="view-attendees-btn"
            >
              👥 Attendees & Check-In ({regStatus?.confirmedCount || 0})
            </Link>

            {event.status !== 'cancelled' && (
              <button
                onClick={() => navigate(`/organizer/events/${event._id}/edit`)}
                className="btn-primary"
                style={{ background: 'rgba(255, 255, 255, 0.1)', boxShadow: 'none' }}
                id="edit-event-btn"
              >
                ✏️ Edit Event Details
              </button>
            )}

            {event.status === 'draft' && (
              <button
                onClick={handlePublish}
                disabled={actionLoading}
                className="btn-primary"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                id="publish-event-btn"
              >
                {actionLoading ? 'Publishing...' : '🚀 Publish Event (Make Discoverable)'}
              </button>
            )}

            {event.status === 'published' && (
              <button
                onClick={handleCancelEvent}
                disabled={actionLoading}
                className="btn-primary"
                style={{
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#f87171',
                  boxShadow: 'none',
                }}
                id="cancel-event-btn"
              >
                {actionLoading ? 'Cancelling...' : '🛑 Cancel Event'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
