import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { categoryLabel, fmtDate } from '../lib/format';

export const ParticipantDashboard = () => {
  const { user } = useAuth();
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setRegs((await api('/me/registrations')).registrations);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const cancel = async (reg) => {
    if (!window.confirm(`Cancel your registration for "${reg.eventId.title}"? You cannot re-register afterwards.`)) return;
    setBusyId(reg._id);
    setFeedback(null);
    try {
      await api(`/registrations/${reg._id}/cancel`, { method: 'POST' });
      setFeedback({ type: 'success', message: 'Registration cancelled.' });
      await load();
    } catch (e) {
      setFeedback({ type: 'error', message: e.message });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <p className="state">Loading your tickets…</p>;

  const now = new Date();
  const active = regs.filter((r) => r.status === 'confirmed');
  const upcoming = active.filter((r) => new Date(r.eventId.endAt) >= now).length;
  const attended = active.filter((r) => r.checkedInAt).length;

  return (
    <>
      <h1>Welcome, {user.name}</h1>

      <div className="grid small">
        <div className="stat big"><span className="label">Upcoming events</span>{upcoming}</div>
        <div className="stat big"><span className="label">Attended</span>{attended}</div>
        <div className="stat big"><span className="label">Cancelled</span>{regs.length - active.length}</div>
      </div>

      {error && <div className="alert error">{error} <button className="link" onClick={load}>Retry</button></div>}
      {feedback && <div className={`alert ${feedback.type}`}>{feedback.message}</div>}

      <div className="row spread">
        <h2>My tickets</h2>
        <Link to="/events" className="btn ghost sm">Browse events</Link>
      </div>

      {!error && regs.length === 0 && (
        <div className="card center">
          <p className="muted">You haven't registered for any events yet.</p>
          <Link to="/events" className="btn">Find an event</Link>
        </div>
      )}

      {regs.map((r) => {
        const ev = r.eventId;
        const confirmed = r.status === 'confirmed';
        const started = new Date() >= new Date(ev.startAt);
        const canCancel = confirmed && !r.checkedInAt && !started && ev.status !== 'cancelled';
        return (
          <div key={r._id} className={`card event-row ${confirmed ? '' : 'faded'}`}>
            <div className="grow">
              <div className="row">
                {!confirmed ? <span className="pill cancelled">Registration cancelled</span>
                  : r.checkedInAt ? <span className="pill ok">Checked in</span>
                  : <span className="pill">Registered</span>}
                {ev.status === 'cancelled' && <span className="pill cancelled">Event cancelled</span>}
              </div>
              <h3><Link to={`/events/${ev._id}`}>{ev.title}</Link></h3>
              <p className="muted">
                {categoryLabel(ev.category)} · {fmtDate(ev.startAt)} · {ev.mode === 'online' ? 'Online' : ev.venue}
              </p>
              {confirmed && ev.mode === 'online' && ev.onlineLink && (
                <a href={ev.onlineLink} target="_blank" rel="noopener noreferrer">Join link</a>
              )}
            </div>
            <div className="ticket-side">
              <span className="label">Ticket</span>
              <div className="ticket-code">{r.ticketCode}</div>
              {canCancel && (
                <button className="btn danger sm" disabled={busyId === r._id} onClick={() => cancel(r)}>
                  {busyId === r._id ? 'Cancelling…' : 'Cancel'}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
};
