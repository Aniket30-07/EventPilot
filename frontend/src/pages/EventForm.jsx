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
  title: '', description: '', category: 'hackathon', mode: 'in-person', venue: '', onlineLink: '',
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
      const body = {
        title: form.title, description: form.description, category: form.category, mode: form.mode,
        venue: form.venue, onlineLink: form.onlineLink, capacity: Number(form.capacity),
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        registrationDeadline: new Date(form.registrationDeadline).toISOString(),
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

  return (
    <form className="card form narrow-wide" onSubmit={(e) => { e.preventDefault(); submit(false); }}>
      <h2>{editing ? 'Edit event' : 'Create event'}</h2>
      {error && <div className="alert error">{error}</div>}

      <label>Title<input required minLength={3} maxLength={200} value={form.title} onChange={set('title')} /></label>
      <label>Description<textarea required minLength={10} maxLength={10000} rows={5} value={form.description} onChange={set('description')} /></label>

      <div className="two-col">
        <label>Category
          <select value={form.category} onChange={set('category')}>
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

      {form.mode === 'in-person'
        ? <label>Venue<input required maxLength={300} value={form.venue} onChange={set('venue')} /></label>
        : <label>Meeting link<input type="url" required maxLength={2048} placeholder="https://…" value={form.onlineLink} onChange={set('onlineLink')} /></label>}

      <div className="two-col">
        <label>Starts<input type="datetime-local" required value={form.startAt} onChange={set('startAt')} /></label>
        <label>Ends<input type="datetime-local" required value={form.endAt} onChange={set('endAt')} /></label>
      </div>
      <div className="two-col">
        <label>Registration deadline<input type="datetime-local" required value={form.registrationDeadline} onChange={set('registrationDeadline')} /></label>
        <label>Capacity<input type="number" required min={1} max={100000} step={1} value={form.capacity} onChange={set('capacity')} /></label>
      </div>

      <div className="row">
        <button className="btn" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Save as draft'}</button>
        {isDraft && <button type="button" className="btn success" disabled={busy} onClick={() => submit(true)}>{editing ? 'Save & publish' : 'Create & publish'}</button>}
        <Link to="/organizer" className="btn ghost">Back</Link>
      </div>
    </form>
  );
};
