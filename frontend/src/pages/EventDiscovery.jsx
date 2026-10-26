import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { CATEGORIES } from '../lib/format';
import { EventCard } from '../components/EventCard';

export const EventDiscovery = () => {
  const [params, setParams] = useSearchParams();
  const category = params.get('category') || '';
  const sort = params.get('sort') || '';
  const urlQ = params.get('q') || '';

  const [search, setSearch] = useState(urlQ);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: true });
  };

  // Debounce the search box into the URL
  useEffect(() => {
    const t = setTimeout(() => { if (search !== urlQ) update('q', search.trim()); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    const qs = new URLSearchParams();
    if (urlQ) qs.set('q', urlQ);
    if (category) qs.set('category', category);
    if (sort) qs.set('sort', sort);
    api(`/events?${qs}`)
      .then((d) => !cancelled && setEvents(d.events))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [urlQ, category, sort]);

  return (
    <>
      <h1>Explore events</h1>
      <div className="filters">
        <input placeholder="Search events…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={category} onChange={(e) => update('category', e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={sort} onChange={(e) => update('sort', e.target.value)}>
          <option value="">Soonest first</option>
          <option value="latest">Recently added</option>
        </select>
      </div>

      {error && <div className="alert error">{error}</div>}
      {loading && <p className="state">Loading events…</p>}
      {!loading && !error && events.length === 0 && (
        <p className="state">No events match your search.</p>
      )}
      <div className="grid">
        {events.map((ev) => <EventCard key={ev._id} event={ev} />)}
      </div>
    </>
  );
};
