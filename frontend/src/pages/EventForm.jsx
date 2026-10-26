import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const CATEGORIES = [
  { value: 'hackathon', label: 'Hackathons / Competitions' },
  { value: 'conference', label: 'Conferences / Seminars' },
  { value: 'workshop', label: 'Workshops / Bootcamps' },
  { value: 'webinar', label: 'Webinars / Online Events' },
  { value: 'sports', label: 'Sports / Tournaments' },
  { value: 'festival', label: 'Festivals / Cultural Events' },
];

export const EventForm = () => {
  const { eventId } = useParams();
  const isEditing = Boolean(eventId);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'hackathon',
    mode: 'in-person',
    venue: '',
    onlineLink: '',
    startAt: '',
    endAt: '',
    registrationDeadline: '',
    capacity: 50,
    status: 'draft',
  });

  const [loading, setLoading] = useState(isEditing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Helper to convert Date to datetime-local input string
  const toLocalISO = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().slice(0, 16);
  };

  useEffect(() => {
    if (!isEditing) return;

    const loadEvent = async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/events/${eventId}`, {
          credentials: 'include',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load event');

        const ev = data.event;
        setFormData({
          title: ev.title || '',
          description: ev.description || '',
          category: ev.category || 'hackathon',
          mode: ev.mode || 'in-person',
          venue: ev.venue || '',
          onlineLink: ev.onlineLink || '',
          startAt: toLocalISO(ev.startAt),
          endAt: toLocalISO(ev.endAt),
          registrationDeadline: toLocalISO(ev.registrationDeadline),
          capacity: ev.capacity || 50,
          status: ev.status || 'draft',
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadEvent();
  }, [eventId, isEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'capacity' ? (parseInt(value, 10) || 0) : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    const start = new Date(formData.startAt);
    const end = new Date(formData.endAt);
    const deadline = new Date(formData.registrationDeadline);

    if (end <= start) {
      setError('Event end date/time must be strictly after the start date/time.');
      return;
    }

    if (deadline > start) {
      setError('Registration deadline cannot be after the event start date/time.');
      return;
    }

    if (formData.capacity < 1) {
      setError('Capacity must be at least 1 attendee.');
      return;
    }

    setSubmitting(true);
    try {
      const url = isEditing ? `${API_BASE}/events/${eventId}` : `${API_BASE}/events`;
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to save event');
      }

      navigate(`/events/${data.event._id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 1rem' }}>
        <div className="status-indicator checking" style={{ margin: '0 auto', display: 'inline-flex' }}>
          <span className="pulse-dot"></span>
          Loading event for editing...
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', width: '100%' }}>
      <div className="hero-card">
        <div style={{ marginBottom: '1.5rem' }}>
          <Link to="/organizer" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            ← Back to Organizer Dashboard
          </Link>
          <h1 className="hero-title" style={{ fontSize: '1.8rem', marginTop: '0.5rem' }}>
            {isEditing ? 'Edit Event' : 'Create a New Event'}
          </h1>
          <p className="hero-desc">
            Define event logistics, category classification, capacity constraints, and publication status.
          </p>
        </div>

        {error && (
          <div
            className="status-indicator disconnected"
            style={{ padding: '0.85rem 1rem', borderRadius: '10px', marginBottom: '1.5rem', width: '100%' }}
            id="event-form-error"
          >
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Event Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. AI Engineering Hackathon 2026"
              required
              minLength={3}
              id="event-title-input"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '0.95rem',
                outline: 'none',
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Description *
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              placeholder="Provide a comprehensive event overview, schedule, rules, and expectations..."
              required
              minLength={10}
              id="event-desc-input"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                borderRadius: '10px',
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '0.9rem',
                outline: 'none',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Category & Mode Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Category *
              </label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                id="event-category-select"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(18, 21, 38, 0.9)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Attendance Mode *
              </label>
              <select
                name="mode"
                value={formData.mode}
                onChange={handleChange}
                id="event-mode-select"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(18, 21, 38, 0.9)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              >
                <option value="in-person">📍 In-Person</option>
                <option value="online">🌐 Online</option>
              </select>
            </div>
          </div>

          {/* Venue or Online Link */}
          {formData.mode === 'in-person' ? (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Physical Venue Location
              </label>
              <input
                type="text"
                name="venue"
                value={formData.venue}
                onChange={handleChange}
                placeholder="e.g. Hall 4, City Convention Center, Austin, TX"
                id="event-venue-input"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          ) : (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Virtual Meeting / Stream Link
              </label>
              <input
                type="url"
                name="onlineLink"
                value={formData.onlineLink}
                onChange={handleChange}
                placeholder="https://meet.eventpilot.dev/session-id"
                id="event-online-link-input"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          )}

          {/* Dates Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Event Start Date & Time *
              </label>
              <input
                type="datetime-local"
                name="startAt"
                value={formData.startAt}
                onChange={handleChange}
                required
                id="event-start-input"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Event End Date & Time *
              </label>
              <input
                type="datetime-local"
                name="endAt"
                value={formData.endAt}
                onChange={handleChange}
                required
                id="event-end-input"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Registration Deadline & Capacity */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Registration Deadline *
              </label>
              <input
                type="datetime-local"
                name="registrationDeadline"
                value={formData.registrationDeadline}
                onChange={handleChange}
                required
                id="event-deadline-input"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Maximum Capacity *
              </label>
              <input
                type="number"
                name="capacity"
                value={formData.capacity}
                onChange={handleChange}
                required
                min={1}
                id="event-capacity-input"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* Initial Status (if creating) */}
          {!isEditing && (
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                Initial Publication Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                id="event-initial-status-select"
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  borderRadius: '10px',
                  background: 'rgba(18, 21, 38, 0.9)',
                  border: '1px solid var(--border-subtle)',
                  color: '#fff',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              >
                <option value="draft">Save as Draft (Private)</option>
                <option value="published">Publish Immediately (Publicly Discoverable)</option>
              </select>
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
              id="save-event-btn"
              style={{ flex: 1, justifyContent: 'center' }}
            >
              {submitting ? 'Saving Event...' : isEditing ? 'Update Event Details' : 'Create Event'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/organizer')}
              className="btn-primary"
              style={{ background: 'rgba(255, 255, 255, 0.08)', boxShadow: 'none' }}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
