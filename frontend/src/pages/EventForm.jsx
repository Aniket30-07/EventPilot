import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { CATEGORIES } from '../lib/format';

const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const EMPTY = {
  title: '', description: '', category: 'hackathon',
  sportType: 'football', tournamentFormat: 'knockout_4',
  hackathonTeamMode: 'team', hackathonTeamSize: 4, hackathonRequiredMembers: 4,
  mode: 'in-person', venue: '', onlineLink: '',
  startAt: '', endAt: '', registrationDeadline: '', capacity: 50,
};

export const EventForm = () => {
  const { eventId } = useParams();
  const editing = Boolean(eventId);
  const navigate = useNavigate();

  const [form, setForm] = useState(EMPTY);
  const [status, setStatus] = useState('draft');
  const [createdEventId, setCreatedEventId] = useState('');
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!editing) return;
    api(`/events/${eventId}`)
      .then(({ event, isOwner }) => {
        if (!isOwner) throw new Error('You do not own this event.');
        setStatus(event.status);
        setForm({
          ...EMPTY, ...event,
          sportType: event.sportsData?.sportType || 'football',
          tournamentFormat: event.sportsData?.tournamentFormat || 'knockout_4',
          hackathonTeamMode: event.hackathonConfig?.teamMode || 'team',
          hackathonTeamSize: event.hackathonConfig?.teamSize || 4,
          hackathonRequiredMembers: event.hackathonConfig?.requiredMembers || 4,
          startAt: toLocalInput(event.startAt),
          endAt: toLocalInput(event.endAt),
          registrationDeadline: toLocalInput(event.registrationDeadline),
        });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [editing, eventId]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const clientCheck = () => {
    const start = new Date(form.startAt), end = new Date(form.endAt), dl = new Date(form.registrationDeadline);
    if (end <= start) return 'End time must be after the start time.';
    if (dl > start) return 'Registration deadline cannot be after the event start.';
    if (!Number.isInteger(Number(form.capacity)) || Number(form.capacity) < 1) return 'Capacity must be a whole number of at least 1.';
    return '';
  };

  const submit = async (publishAfter) => {
    setError('');
    const msg = clientCheck();
    if (msg) return setError(msg);

    setBusy(true);
    try {
      const isSports = form.category === 'sports';
      const isHackathon = form.category === 'hackathon';
      const body = {
        title: form.title, description: form.description, category: form.category, mode: form.mode,
        venue: form.venue, onlineLink: form.onlineLink, capacity: Number(form.capacity),
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        registrationDeadline: new Date(form.registrationDeadline).toISOString(),
        ...(isSports ? {
          sportsData: {
            sportType: form.sportType || 'football',
            tournamentFormat: form.tournamentFormat || 'knockout_4',
            maxTeams: Number(form.capacity),
          },
        } : {}),
        ...(isHackathon ? {
          hackathonConfig: {
            teamMode: form.hackathonTeamMode || 'team',
            maxTeams: Number(form.capacity),
            teamSize: Number(form.hackathonTeamSize) || 4,
            requiredMembers: Number(form.hackathonRequiredMembers) || 4,
          },
        } : {}),
      };
      const targetEventId = eventId || createdEventId;
      const res = targetEventId
        ? await api(`/events/${targetEventId}`, { method: 'PATCH', body })
        : await api('/events', { method: 'POST', body });
      const savedEventId = res.event._id;
      if (!targetEventId) setCreatedEventId(savedEventId);
      if (publishAfter) await api(`/events/${savedEventId}/publish`, { method: 'POST' });
      navigate('/organizer');
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  if (loading) return <p className="state">Loading event…</p>;
  if (editing && error && !form.title) {
    return <div className="card center"><div className="alert error">{error}</div><Link to="/organizer" className="btn">Back</Link></div>;
  }

  const isDraft = !editing || status === 'draft';
  const isSports = form.category === 'sports';
  const isHackathon = form.category === 'hackathon';
  const isChess = isSports && form.sportType === 'chess';

  return (
    <form className="card form narrow-wide" onSubmit={(e) => { e.preventDefault(); submit(false); }}>
      <h2>{editing ? 'Edit event' : 'Create event'}</h2>
      {error && <div className="alert error">{error}</div>}

      <label>Title<input required minLength={3} maxLength={200} value={form.title} onChange={set('title')} /></label>
      <label>Description<textarea required minLength={10} maxLength={10000} rows={5} value={form.description} onChange={set('description')} /></label>

      <div className="two-col">
        <label>Category
          <select value={form.category} onChange={(e) => {
            const cat = e.target.value;
            setForm({
              ...form,
              category: cat,
              capacity: cat === 'sports' ? 4 : cat === 'hackathon' ? 50 : form.capacity || 50,
            });
          }}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>
        <label>Mode
          <select value={form.mode} onChange={set('mode')}>
            <option value="in-person">In-person</option>
            <option value="online">Online</option>
          </select>
        </label>
      </div>

      {isHackathon && (
        <div className="two-col" style={{ background: 'rgba(99, 102, 241, 0.05)', padding: '1rem', borderRadius: '12px', border: '1px solid rgba(99, 102, 241, 0.2)', marginBottom: '1rem' }}>
          <label>Hackathon Participation Format
            <select value={form.hackathonTeamMode} onChange={(e) => {
              const mode = e.target.value;
              setForm({
                ...form,
                hackathonTeamMode: mode,
                capacity: mode === 'team' ? 50 : form.capacity || 100,
              });
            }}>
              <option value="team">👥 Team-Based Hackathon (Squads + 1 Submission Per Team)</option>
              <option value="solo">👤 Solo Hackathon (Individual Developers)</option>
            </select>
          </label>
          {form.hackathonTeamMode === 'team' ? (
            <label>Required Team Size (Qualification Quorum)
              <select value={form.hackathonRequiredMembers} onChange={(e) => {
                const val = Number(e.target.value);
                setForm({ ...form, hackathonRequiredMembers: val, hackathonTeamSize: val });
              }}>
                <option value={2}>2 Members per Team</option>
                <option value={3}>3 Members per Team</option>
                <option value={4}>4 Members per Team (Standard)</option>
                <option value={5}>5 Members per Team</option>
              </select>
              <span style={{ fontSize: '.76rem', color: 'var(--muted)', display: 'block', marginTop: '.2rem' }}>
                Teams must reach this number of accepted members before deadline to qualify.
              </span>
            </label>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', fontSize: '.85rem', color: 'var(--muted)' }}>
              Individual developers register and submit projects independently.
            </div>
          )}
        </div>
      )}

      {isSports && (
        <div className="two-col">
          <label>Sport Discipline
            <select value={form.sportType} onChange={set('sportType')}>
              <option value="football">⚽ Football / Soccer (11 v 11)</option>
              <option value="cricket">🏏 Cricket (11 Playing XI + Squad of 15)</option>
              <option value="chess">♟️ Chess (1 v 1 Swiss / Round Robin)</option>
              <option value="general">🏆 General Sports Tournament</option>
            </select>
          </label>
          <label>Tournament Bracket Format
            <select
              value={form.tournamentFormat}
              onChange={(e) => {
                const fmt = e.target.value;
                const defCap = fmt === 'knockout_2' ? 2 : fmt === 'knockout_8' ? 8 : 4;
                setForm({ ...form, tournamentFormat: fmt, capacity: defCap });
              }}
            >
              <option value="knockout_4">🏆 4-Team Knockout (2 Semis ➔ 1 Grand Final)</option>
              <option value="knockout_2">🏆 2-Team Championship Match (1v1 Final)</option>
              <option value="knockout_8">🏆 8-Team Knockout (4 QFs ➔ 2 Semis ➔ Final)</option>
              <option value="round_robin">🏆 Round-Robin League (Points Table)</option>
              <option value="custom">🏆 Custom / Open Tournament</option>
            </select>
          </label>
        </div>
      )}

      {form.mode === 'in-person'
        ? <label>Venue<input required maxLength={300} value={form.venue} onChange={set('venue')} /></label>
        : <label>Platform / Virtual Access Info<input maxLength={2048} placeholder="e.g. Zoom / Platform details (optional)" value={form.onlineLink} onChange={set('onlineLink')} /></label>}

      <div className="two-col">
        <label>Starts<input type="datetime-local" required value={form.startAt} onChange={set('startAt')} /></label>
        <label>Ends<input type="datetime-local" required value={form.endAt} onChange={set('endAt')} /></label>
      </div>
      <div className="two-col">
        <label>Registration deadline<input type="datetime-local" required value={form.registrationDeadline} onChange={set('registrationDeadline')} /></label>
        <label>
          {isSports
            ? (isChess ? 'Max Players (1v1 Competitor Limit)' : 'Max Teams (Tournament Slot Limit)')
            : (isHackathon && form.hackathonTeamMode === 'team')
              ? 'Max Teams (Team Capacity Limit, e.g. 50 Teams)'
              : 'Capacity (Seats / Tickets)'}
          <input type="number" required min={1} max={100000} step={1} value={form.capacity} onChange={set('capacity')} />
          {isSports && (
            <span style={{ fontSize: '.76rem', color: 'var(--muted)', display: 'block', marginTop: '.2rem' }}>
              Each registration takes 1 {isChess ? 'player' : 'team'} slot. Registration closes once limit is reached.
            </span>
          )}
          {isHackathon && form.hackathonTeamMode === 'team' && (
            <span style={{ fontSize: '.76rem', color: 'var(--muted)', display: 'block', marginTop: '.2rem' }}>
              Max number of teams allowed to register. Once all slots are taken, registration will show &quot;No seats available&quot;.
            </span>
          )}
        </label>
      </div>

      <div className="row">
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Save as draft'}</button>
        {isDraft && <button type="button" className="btn success" disabled={busy} onClick={() => submit(true)}>{editing ? 'Save & publish' : 'Create & publish'}</button>}
        <Link to="/organizer" className="btn ghost">Back</Link>
      </div>
    </form>
  );
};
