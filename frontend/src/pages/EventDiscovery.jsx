import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

const CATEGORIES = [
  { key: 'all', label: 'All Categories' },
  { key: 'hackathon', label: 'Hackathons / Competitions' },
  { key: 'conference', label: 'Conferences / Seminars' },
  { key: 'workshop', label: 'Workshops / Bootcamps' },
  { key: 'webinar', label: 'Webinars / Online Events' },
  { key: 'sports', label: 'Sports / Tournaments' },
  { key: 'festival', label: 'Festivals / Cultural Events' },
];

export const EventDiscovery = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedMode, setSelectedMode] = useState('all');
  const [sortBy, setSortBy] = useState('soonest');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.append('q', searchQuery.trim());
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedMode !== 'all') params.append('mode', selectedMode);
      if (sortBy) params.append('sort', sortBy);

      const res = await fetch(`${API_BASE}/events?${params.toString()}`);
      if (!res.ok) {
        throw new Error(`Failed to load events: HTTP ${res.status}`);
      }
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedCategory, selectedMode, sortBy]);

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      fetchEvents();
    }, 250);
    return () => clearTimeout(debounceTimer);
  }, [fetchEvents]);

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCategoryColor = (cat) => {
    const map = {
      hackathon: '#6366f1',
      conference: '#38bdf8',
      workshop: '#10b981',
      webinar: '#f59e0b',
      sports: '#ec4899',
      festival: '#8b5cf6',
    };
    return map[cat] || 'var(--primary)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Hero Header */}
      <div className="hero-card">
        <span className="phase-tag" style={{ color: '#38bdf8' }}>Discovery & Exploration</span>
        <h1 className="hero-title" style={{ marginTop: '0.4rem', fontSize: '2.1rem' }}>
          Discover Upcoming Events
        </h1>
        <p className="hero-desc">
          Browse verified hackathons, conferences, workshops, tournaments, and webinars. Filter by category,
          attendance mode, and find your next milestone event.
        </p>

        {/* Search Bar */}
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px', position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events by title or keywords..."
              id="event-search-input"
              style={{
                width: '100%',
                padding: '0.85rem 1.25rem',
                borderRadius: '12px',
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid var(--border-subtle)',
                color: '#fff',
                fontSize: '0.95rem',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-dim)',
                  fontSize: '0.9rem',
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Mode Selector */}
          <select
            value={selectedMode}
            onChange={(e) => setSelectedMode(e.target.value)}
            id="event-mode-select"
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '12px',
              background: 'rgba(18, 21, 38, 0.9)',
              border: '1px solid var(--border-subtle)',
              color: '#fff',
              fontSize: '0.9rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">All Modes</option>
            <option value="online">🌐 Online</option>
            <option value="in-person">📍 In-Person</option>
          </select>

          {/* Sort Selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            id="event-sort-select"
            style={{
              padding: '0.85rem 1rem',
              borderRadius: '12px',
              background: 'rgba(18, 21, 38, 0.9)',
              border: '1px solid var(--border-subtle)',
              color: '#fff',
              fontSize: '0.9rem',
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="soonest">📅 Soonest First</option>
            <option value="latest">⚡ Recently Added</option>
            <option value="capacity">👥 Largest Capacity</option>
          </select>
        </div>

        {/* Category Pills */}
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
          {CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setSelectedCategory(cat.key)}
                id={`filter-cat-${cat.key}`}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: '9999px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  transition: 'all 0.15s ease',
                  background: isActive ? 'var(--primary)' : 'rgba(255, 255, 255, 0.05)',
                  color: isActive ? '#fff' : 'var(--text-muted)',
                  border: isActive ? '1px solid var(--primary)' : '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 className="section-title">
          <span>🎯 Available Events</span>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 400 }}>
            ({events.length} {events.length === 1 ? 'event' : 'events'} found)
          </span>
        </h2>
        <button
          onClick={fetchEvents}
          disabled={loading}
          className="btn-primary"
          style={{ padding: '0.45rem 0.9rem', fontSize: '0.8rem', background: 'rgba(255, 255, 255, 0.05)', boxShadow: 'none' }}
        >
          {loading ? 'Refreshing...' : '↻ Refresh'}
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="status-indicator error" style={{ padding: '1rem', borderRadius: '12px', display: 'flex', gap: '0.5rem' }}>
          ⚠️ {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="status-grid">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="status-card" style={{ height: '220px', opacity: 0.5, animation: 'pulse 1.5s infinite' }}>
              <div className="status-label">Loading event...</div>
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && events.length === 0 && (
        <div className="hero-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🔍</div>
          <h3 style={{ fontSize: '1.4rem', marginBottom: '0.5rem' }}>No published events match your criteria</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '450px', margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
            Try resetting your search query or switching categories. If you are an organizer, you can publish a draft event from your dashboard.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedCategory('all');
              setSelectedMode('all');
            }}
            className="btn-primary"
            style={{ margin: '0 auto' }}
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Events Grid */}
      {!loading && events.length > 0 && (
        <div className="status-grid" id="events-grid">
          {events.map((ev) => (
            <div key={ev._id} className="status-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                {/* Header tags */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '6px',
                      background: `${getCategoryColor(ev.category)}20`,
                      color: getCategoryColor(ev.category),
                      border: `1px solid ${getCategoryColor(ev.category)}40`,
                    }}
                  >
                    {ev.category}
                  </span>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    {ev.mode === 'online' ? '🌐 Online' : '📍 In-Person'}
                  </span>
                </div>

                {/* Title */}
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', lineHeight: '1.3' }}>
                  <Link to={`/events/${ev._id}`} style={{ color: 'var(--text-main)', transition: 'color 0.15s' }}>
                    {ev.title}
                  </Link>
                </h3>

                {/* Description Snippet */}
                <p
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                    lineHeight: '1.5',
                    marginBottom: '1rem',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {ev.description}
                </p>
              </div>

              {/* Meta details & action */}
              <div style={{ paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
                  <span>📅 {formatDate(ev.startAt)}</span>
                  <span>👥 Cap: {ev.capacity}</span>
                </div>

                {ev.venue && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📍 {ev.venue}
                  </div>
                )}

                <Link
                  to={`/events/${ev._id}`}
                  className="btn-primary"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    marginTop: '0.5rem',
                    padding: '0.55rem 1rem',
                    fontSize: '0.85rem',
                  }}
                  id={`view-event-${ev._id}`}
                >
                  View Details & Register →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
