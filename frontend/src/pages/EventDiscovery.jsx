import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { CATEGORIES } from '../lib/format';
import { EventCard } from '../components/EventCard';

export const EventDiscovery = () => {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const sort = params.get('sort') || '';
  const mode = params.get('mode') || '';
  const urlQ = params.get('q') || '';

  const [search, setSearch] = useState(urlQ);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  // Debounce the search box into the URL
  useEffect(() => {
    const t = setTimeout(() => { if (search !== urlQ) update('q', search.trim()); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    setSearch(urlQ);
  }, [urlQ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const qs = new URLSearchParams();
    if (urlQ) qs.set('q', urlQ);
    if (category) qs.set('category', category);
    if (mode) qs.set('mode', mode);
    if (sort) qs.set('sort', sort);
    api(`/events?${qs}`)
      .then((d) => !cancelled && setEvents(d.events))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [urlQ, category, mode, sort]);

  return (
    <>
      <section className="discovery-heading">
        <div>
          <span className="eyebrow">MAKE ROOM FOR SOMETHING NEW</span>
          <h1>Explore events</h1>
          <p>Find your next favorite thing to do, learn, or be part of.</p>
        </div>
        {!loading && !error && <span className="result-count">{events.length} {events.length === 1 ? 'event' : 'events'} to explore</span>}
      </section>
      <div className="filters discovery-filters">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input aria-label="Search events" placeholder="Search events, topics or places…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </label>
        <select value={category} onChange={(e) => update('category', e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={mode} onChange={(e) => update('mode', e.target.value)}>
          <option value="">All formats</option>
          <option value="in-person">In-person</option>
          <option value="online">Online</option>
        </select>
        <select value={sort} onChange={(e) => update('sort', e.target.value)}>
          <option value="">Soonest first</option>
          <option value="latest">Recently added</option>
        </select>
      </div>

      {error && <div className="alert error">{error}</div>}
      {loading && <p className="state">Finding your next great event…</p>}
      {!loading && !error && events.length === 0 && (
        <div className="empty-state card">
          <span aria-hidden="true">✳</span>
          <h2>Nothing on this page just yet</h2>
          <p>Try another search or clear your filters. Your next event is out there.</p>
          <button className="btn ghost" onClick={() => { setSearch(''); setParams({}, { replace: true }); }}>Clear filters</button>
        </div>
      )}
      <div className="grid event-grid">
        {events.map((ev) => <EventCard key={ev._id} event={ev} />)}
      </div>
    </>
  );
};
