import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, homeFor } from '../lib/format';

export const Home = () => {
  const { user } = useAuth();
  return (
    <>
      <section className="card hero">
        <h1>Discover events. Register in one click.</h1>
        <p className="muted">
          Hackathons, conferences, workshops, webinars, sports and festivals — all in one place.
        </p>
        <div className="row">
          <Link to="/events" className="btn">Explore events</Link>
          {user ? (
            <Link to={homeFor(user)} className="btn ghost">
              {user.role === 'organizer' ? 'Organizer dashboard' : 'My dashboard'}
            </Link>
          ) : (
            <Link to="/register" className="btn ghost">Create an account</Link>
          )}
        </div>
      </section>
      <section>
        <h2>Browse by category</h2>
        <div className="grid">
          {CATEGORIES.map((c) => (
            <Link key={c.value} to={`/events?category=${c.value}`} className="card cat">{c.label}</Link>
          ))}
        </div>
      </section>
    </>
  );
};
