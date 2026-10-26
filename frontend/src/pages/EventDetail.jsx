import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { categoryLabel, fmtDate } from '../lib/format';

export const EventDetail = () => {
  const { eventId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await api(`/events/${eventId}`));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  // Reload when the signed-in user changes so ownership/registration state is correct
  useEffect(() => { setLoading(true); load(); }, [load, user?._id]);

  const run = async (fn, successMsg) => {
    setBusy(true);
    setFeedback(null);
    try {
      await fn();
      setFeedback({ type: 'success', message: successMsg });
      await load();
    } catch (e) {
      setFeedback({ type: 'error', message: e.message });
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="state">Loading event…</p>;
  if (error || !data) {
    return (
      <div className="card center">
        <h2>Event unavailable</h2>
        <p className="muted">{error || 'This event could not be found.'}</p>
        <Link to="/events" className="btn">Back to events</Link>
      </div>
    );
  }

  const { event, isOwner, myRegistration } = data;
  const now = new Date();
  const deadlinePassed = now > new Date(event.registrationDeadline);
  const ended = now > new Date(event.endAt);
  const full = event.remainingSeats === 0;
  const isParticipant = user?.role === 'participant';

  const register = () => run(() => api(`/events/${eventId}/register`, { method: 'POST' }), 'You are registered! Your ticket is below.');
  const cancelReg = () => {
    if (!window.confirm('Cancel your registration? You will not be able to register again for this event.')) return;
    run(() => api(`/registrations/${myRegistration._id}/cancel`, { method: 'POST' }), 'Registration cancelled.');
  };
  const publish = () => run(() => api(`/events/${eventId}/publish`, { method: 'POST' }), 'Event published.');
  const cancelEvent = () => {
    if (!window.confirm('Cancel this event? It will be removed from public discovery.')) return;
    run(() => api(`/events/${eventId}/cancel`, { method: 'POST' }), 'Event cancelled.');
  };

  let registerBox;
  if (event.status !== 'published') {
    registerBox = <p className="muted">This event is {event.status} and not open for registration.</p>;
  } else if (!user) {
    registerBox = (
      <button className="btn" onClick={() => navigate('/login', { state: { from: `/events/${eventId}` } })}>
        Sign in to register
      </button>
    );
  } else if (!isParticipant) {
    registerBox = null; // organizers don't register
  } else if (myRegistration?.status === 'confirmed') {
    registerBox = (
      <div className="ticket">
        <div>
          <span className="pill ok">Registered</span>
          <div className="ticket-code">{myRegistration.ticketCode}</div>
          {myRegistration.checkedInAt && <span className="muted">Checked in {fmtDate(myRegistration.checkedInAt)}</span>}
        </div>
        {!myRegistration.checkedInAt && !ended && (
          <button className="btn danger sm" onClick={cancelReg} disabled={busy}>
            {busy ? 'Cancelling…' : 'Cancel registration'}
          </button>
        )}
      </div>
    );
  } else if (myRegistration?.status === 'cancelled') {
    registerBox = <p className="muted">You cancelled your registration. Re-registering is not allowed.</p>;
  } else if (ended) {
    registerBox = <p className="muted">This event has ended.</p>;
  } else if (deadlinePassed) {
    registerBox = <p className="muted">Registration closed on {fmtDate(event.registrationDeadline)}.</p>;
  } else if (full) {
    registerBox = <p className="danger-text">This event is full.</p>;
  } else {
    registerBox = <button className="btn" onClick={register} disabled={busy}>{busy ? 'Registering…' : 'Register for this event'}</button>;
  }

  return (
    <div className="narrow-wide">
      <Link to="/events" className="muted">← All events</Link>
      <div className="card">
        <div className="row spread">
          <span className="pill">{categoryLabel(event.category)}</span>
          {event.status !== 'published' && <span className={`pill ${event.status}`}>{event.status}</span>}
        </div>
        <h1>{event.title}</h1>
        <p className="preline">{event.description}</p>

        <div className="grid small">
          <div className="stat"><span className="label">Starts</span>{fmtDate(event.startAt)}</div>
          <div className="stat"><span className="label">Ends</span>{fmtDate(event.endAt)}</div>
          <div className="stat">
            <span className="label">{event.mode === 'online' ? 'Online' : 'Venue'}</span>
            {event.mode === 'online'
              ? (event.onlineLink ? <a href={event.onlineLink} target="_blank" rel="noopener noreferrer">Join link</a> : <span className="muted">Link shown after you register</span>)
              : event.venue}
          </div>
          <div className="stat"><span className="label">Seats</span>{event.confirmedCount} / {event.capacity} taken</div>
          <div className="stat"><span className="label">Register by</span>{fmtDate(event.registrationDeadline)}</div>
          <div className="stat"><span className="label">Organizer</span>{event.organizerId?.name}</div>
        </div>
      </div>

      {feedback && <div className={`alert ${feedback.type}`}>{feedback.message}</div>}

      {!isOwner && registerBox && <div className="card">{registerBox}</div>}

      {isOwner && (
        <div className="card">
          <h3>Manage this event</h3>
          <div className="row">
            <Link className="btn" to={`/organizer/events/${event._id}/attendees`}>Attendees & check-in</Link>
            {event.status !== 'cancelled' && <Link className="btn ghost" to={`/organizer/events/${event._id}/edit`}>Edit</Link>}
            {event.status === 'draft' && <button className="btn success" onClick={publish} disabled={busy}>Publish</button>}
            {event.status !== 'cancelled' && <button className="btn danger" onClick={cancelEvent} disabled={busy}>Cancel event</button>}
          </div>
        </div>
      )}
    </div>
  );
};
