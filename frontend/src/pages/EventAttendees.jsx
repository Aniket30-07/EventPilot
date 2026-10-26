import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { fmtDate } from '../lib/format';

export const EventAttendees = () => {
  const { eventId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      setData(await api(`/events/${eventId}/attendees`));
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { load(); }, [load]);

  const checkIn = async (reg) => {
    setBusyId(reg._id);
    setFeedback(null);
    try {
      const res = await api(`/events/${eventId}/registrations/${reg._id}/check-in`, { method: 'POST' });
      setFeedback({
        type: res.alreadyCheckedIn ? 'info' : 'success',
        message: res.alreadyCheckedIn ? `${reg.participantId?.name} was already checked in.` : `${reg.participantId?.name} checked in.`,
      });
      await load();
    } catch (e) {
      setFeedback({ type: 'error', message: e.message });
    } finally {
      setBusyId(null);
    }
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.attendees || []).filter((a) => {
      if (filter === 'pending' && !(a.status === 'confirmed' && !a.checkedInAt)) return false;
      if (filter === 'checkedIn' && !(a.status === 'confirmed' && a.checkedInAt)) return false;
      if (filter === 'cancelled' && a.status !== 'cancelled') return false;
      if (!q) return true;
      return [a.participantId?.name, a.participantId?.email, a.ticketCode].some((v) => v?.toLowerCase().includes(q));
    });
  }, [data, query, filter]);

  if (loading) return <p className="state">Loading attendees…</p>;
  if (error) {
    return (
      <div className="card center">
        <div className="alert error">{error}</div>
        <Link to="/organizer" className="btn">Back to dashboard</Link>
      </div>
    );
  }

  const { event, metrics } = data;
  const canCheckIn = event.status === 'published';

  return (
    <>
      <Link to="/organizer" className="muted">← Dashboard</Link>
      <h1>{event.title}</h1>
      <p className="muted">Attendees & check-in · {event.status}</p>

      <div className="grid small">
        <div className="stat big"><span className="label">Confirmed</span>{metrics.confirmedCount} / {metrics.capacity}</div>
        <div className="stat big"><span className="label">Checked in</span>{metrics.checkedInCount}</div>
        <div className="stat big"><span className="label">Check-in rate</span>{metrics.checkInRate}%</div>
        <div className="stat big"><span className="label">Cancelled</span>{metrics.cancelledCount}</div>
      </div>

      {feedback && <div className={`alert ${feedback.type}`}>{feedback.message}</div>}
      {!canCheckIn && <div className="alert info">Check-in is only available while the event is published.</div>}

      <div className="filters">
        <input placeholder="Search name, email or ticket…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All</option>
          <option value="pending">Not checked in</option>
          <option value="checkedIn">Checked in</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {rows.length === 0 ? (
        <p className="state">{data.attendees.length === 0 ? 'No registrations yet.' : 'No attendees match your filters.'}</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Ticket</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a._id}>
                  <td>{a.participantId?.name}</td>
                  <td>{a.participantId?.email}</td>
                  <td><code>{a.ticketCode}</code></td>
                  <td>
                    {a.status === 'cancelled' ? <span className="pill cancelled">Cancelled</span>
                      : a.checkedInAt ? <span className="pill ok" title={fmtDate(a.checkedInAt)}>Checked in</span>
                      : <span className="pill">Registered</span>}
                  </td>
                  <td>
                    {a.status === 'confirmed' && !a.checkedInAt && (
                      <button className="btn sm" disabled={busyId === a._id || !canCheckIn} onClick={() => checkIn(a)}>
                        {busyId === a._id ? '…' : 'Check in'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};
