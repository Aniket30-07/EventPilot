import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { categoryLabel, fmtDate } from '../lib/format';

export const ParticipantDashboard = () => {
  const { user } = useAuth();
  const [regs, setRegs] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const [regsRes, invRes] = await Promise.all([
        api('/me/registrations'),
        api('/me/invites').catch(() => ({ invites: [] })),
      ]);
      setRegs(regsRes.registrations || []);
      setInvites(invRes.invites || []);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const respondInvite = async (inviteId, action) => {
    setBusyId(inviteId);
    setFeedback(null);
    try {
      const res = await api(`/invites/${inviteId}/${action}`, { method: 'POST' });
      setFeedback({ type: 'success', message: res.message || `Invitation ${action}ed!` });
      await load();
    } catch (e) {
      setFeedback({ type: 'error', message: e.message });
      await load();
    } finally {
      setBusyId(null);
    }
  };

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

      {/* Team Squad Invitations Section */}
      {invites.length > 0 && (
        <div style={{ marginBottom: '1.75rem' }}>
          <div className="row spread" style={{ marginBottom: '.65rem' }}>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '.5rem', color: '#f59e0b' }}>
              🔔 Team Squad Invitations
              <span className="pill" style={{ background: 'rgba(245,158,11,.15)', color: '#f59e0b' }}>
                {invites.length} pending
              </span>
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
            {invites.map((inv) => (
              <div
                key={inv._id}
                className="card"
                style={{
                  border: '1px solid rgba(245,158,11,.4)',
                  background: 'linear-gradient(135deg, rgba(245,158,11,.08), rgba(0,0,0,.2))',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '1rem',
                  padding: '1.15rem',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.25rem' }}>
                    <span className="pill" style={{ background: '#f59e0b', color: '#000', fontWeight: 800 }}>INVITATION</span>
                    <strong style={{ fontSize: '1.05rem', color: '#fff' }}>{inv.teamName}</strong>
                    <span className="pill" style={{ background: 'rgba(255,255,255,.08)' }}>{inv.role.toUpperCase()}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: '.9rem', color: 'var(--text)' }}>
                    Captain <strong>{inv.captainId?.name || inv.captainName}</strong> has invited you to join the squad for <strong>{inv.eventId?.title}</strong>.
                  </p>
                  <span style={{ fontSize: '.8rem', color: 'var(--muted)', marginTop: '.25rem', display: 'block' }}>
                    {fmtDate(inv.eventId?.startAt)} · {inv.eventId?.venue || 'Venue TBA'}
                  </span>
                </div>
                <div className="row" style={{ gap: '.5rem' }}>
                  <button
                    className="btn success sm"
                    disabled={busyId === inv._id}
                    onClick={() => respondInvite(inv._id, 'accept')}
                  >
                    {busyId === inv._id ? 'Joining…' : '✓ Accept & Join Squad'}
                  </button>
                  <button
                    className="btn ghost sm"
                    disabled={busyId === inv._id}
                    onClick={() => respondInvite(inv._id, 'decline')}
                  >
                    ✕ Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                {r.teamName && (
                  <span className="pill" style={{ background: 'rgba(99,102,241,.15)', color: '#818cf8', fontWeight: 600 }}>
                    {r.teamName} {r.roleInTeam === 'captain' || r.isCaptain ? '(Captain 👑)' : '(Squad Player 🏏)'}
                  </span>
                )}
                {ev.status === 'cancelled' && <span className="pill cancelled">Event cancelled</span>}
              </div>
              <h3><Link to={`/events/${ev._id}`}>{ev.title}</Link></h3>
              <p className="muted">
                {categoryLabel(ev.category)} · {fmtDate(ev.startAt)} · {ev.mode === 'online' ? 'Online' : ev.venue}
              </p>
              <div className="row" style={{ marginTop: '.35rem' }}>
                {confirmed && ev.category === 'hackathon' && (
                  <Link to={`/events/${ev._id}`} className="link-pill github">🚀 Submit / View Project</Link>
                )}
                {confirmed && ['conference', 'webinar', 'workshop'].includes(ev.category) && (
                  <Link to={`/events/${ev._id}`} className="link-pill">🎓 Recap & Slides</Link>
                )}
                {confirmed && ev.category === 'sports' && (
                  <Link to={`/events/${ev._id}`} className="link-pill">⚽ Scores & Standings</Link>
                )}
              </div>
            </div>
            <div className="ticket-side">
              <span className="label">Ticket</span>
              <div className="ticket-code">{r.ticketCode}</div>
              <div className="row" style={{ marginTop: '.25rem' }}>
                {confirmed && (
                  <button className="btn ghost sm" type="button" onClick={() => window.print()} title="Print ticket or save as PDF">
                    🖨️ Print
                  </button>
                )}
                {canCancel && (
                  <button className="btn danger sm" disabled={busyId === r._id} onClick={() => cancel(r)}>
                    {busyId === r._id ? 'Cancelling…' : 'Cancel'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
};
