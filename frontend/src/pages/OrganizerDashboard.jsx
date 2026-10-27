import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { categoryLabel, fmtDate } from '../lib/format';

export const OrganizerDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await api('/events/mine/analytics'));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (id, action, successMsg) => {
    setBusyId(id);
    setFeedback(null);
    try {
      await api(`/events/${id}/${action}`, { method: 'POST' });
      setFeedback({ type: 'success', message: successMsg });
      await load();
    } catch (e) {
      setFeedback({ type: 'error', message: e.message });
    } finally {
      setBusyId(null);
    }
  };

  const cancelEvent = (id) => {
    if (window.confirm('Cancel this event? It will be removed from public discovery.')) act(id, 'cancel', 'Event cancelled.');
  };

  if (loading) return <p className="state">Loading dashboard…</p>;

  const s = data?.summary;
  const events = data?.events || [];

  return (
    <>
      <div className="row spread">
        <h1>Organizer dashboard</h1>
        <div className="row">
          <Link to="/organizer/team" className="btn ghost">👥 Team Management</Link>
          <Link to="/organizer/events/new" className="btn">＋ Create event</Link>
        </div>
      </div>

      {error && <div className="alert error">{error} <button className="link" onClick={load}>Retry</button></div>}
      {feedback && <div className={`alert ${feedback.type}`}>{feedback.message}</div>}

      {s && (
        <div className="grid small">
          <div className="stat big"><span className="label">Events</span>{s.totalEvents}<small>{s.publishedEvents} published</small></div>
          <div className="stat big"><span className="label">Confirmed registrations</span>{s.confirmedRegistrations}</div>
          <div className="stat big"><span className="label">Checked in</span>{s.checkedInAttendees}</div>
          <div className="stat big"><span className="label">Check-in rate</span>{s.overallCheckInRate}%</div>
        </div>
      )}

      <h2>Your events</h2>
      {!error && events.length === 0 && (
        <div className="card center">
          <p className="muted">You haven't created any events yet.</p>
          <Link to="/organizer/events/new" className="btn">Create your first event</Link>
        </div>
      )}

      {events.map((ev) => (
        <div key={ev._id} className="card event-row">
          <div className="grow">
            <div className="row">
              <span className={`pill ${ev.status}`}>{ev.status}</span>
              <span className="muted">{categoryLabel(ev.category)} · {fmtDate(ev.startAt)}</span>
            </div>
            <h3><Link to={`/events/${ev._id}`}>{ev.title}</Link></h3>
            <div className="row muted">
              <span>🎟️ {ev.confirmedCount}/{ev.capacity} registered</span>
              <span>✓ {ev.checkedInCount} checked in</span>
              <span>{ev.cancelledCount} cancelled</span>
            </div>
          </div>
          <div className="row">
            <Link className="btn sm" to={`/organizer/events/${ev._id}/attendees`}>Attendees</Link>
            {ev.category === 'hackathon' && (
              <Link className="btn sm ghost" to={`/organizer/events/${ev._id}/submissions`}>🚀 Submissions</Link>
            )}
            {ev.status !== 'cancelled' && <Link className="btn ghost sm" to={`/organizer/events/${ev._id}/edit`}>Edit</Link>}
            {ev.status === 'draft' && (
              <button className="btn success sm" disabled={busyId === ev._id} onClick={() => act(ev._id, 'publish', 'Event published.')}>Publish</button>
            )}
            {ev.status !== 'cancelled' && (
              <button className="btn danger sm" disabled={busyId === ev._id} onClick={() => cancelEvent(ev._id)}>Cancel</button>
            )}
          </div>
        </div>
      ))}
    </>
  );
};
