import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, homeFor } from '../lib/format';

export const Home = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const search = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    navigate(`/events${params.size ? `?${params}` : ''}`);
  };

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> YOUR NEXT GREAT DAY STARTS HERE</span>
          <h1>Find your people.<br /><span>Find your next thing.</span></h1>
          <p>Real-world ideas, new skills, and moments worth showing up for. Discover events made for you.</p>
          <form className="hero-search" onSubmit={search}>
            <span className="hero-search-icon" aria-hidden="true">⌕</span>
            <input
              aria-label="Search events"
              placeholder="Try “design”, “tech” or “weekend”"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="submit" className="btn">Find events <span aria-hidden="true">↗</span></button>
          </form>
          <div className="hero-trust"><span>✦</span> Discover something worth leaving home for</div>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="hero-art-orbit orbit-one" />
          <div className="hero-art-orbit orbit-two" />
          <div className="hero-art-sun">✳</div>
          <div className="hero-floating-card float-top"><span>✦</span><div><strong>Good things happen</strong><small>when we get together</small></div></div>
          <div className="hero-floating-card float-bottom"><span>↗</span><div><strong>Your next story</strong><small>starts right here</small></div></div>
          <div className="hero-art-stamp">SHOW UP<br />CURIOUS</div>
        </div>
      </section>

      <section className="category-section">
        <div className="section-heading">
          <div><span className="eyebrow">A LITTLE BIT OF EVERYTHING</span><h2>What are you into?</h2></div>
          <Link to="/events" className="text-link">Explore all events <span aria-hidden="true">↗</span></Link>
        </div>
        <div className="category-grid">
          {CATEGORIES.map((c) => (
            <Link key={c.value} to={`/events?category=${c.value}`} className={`category-tile category-${c.value}`}>
              <span className="category-icon" aria-hidden="true">
                {{ hackathon: '⌘', conference: '◈', workshop: '✳', webinar: '↗', sports: '◉', festival: '✺' }[c.value]}
              </span>
              <span>{c.label.split(' / ')[0]}</span>
              <span className="category-arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
};
