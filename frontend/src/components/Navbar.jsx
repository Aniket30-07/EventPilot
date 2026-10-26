import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="app-header">
      <Link to="/" className="brand">
        <div className="brand-icon">✈️</div>
        <span className="brand-title">EventPilot</span>
      </Link>

      <nav style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <Link to="/events" style={{ color: 'var(--text-main)', fontSize: '0.9rem', fontWeight: 600 }}>
          Explore Events
        </Link>
        {user && (
          <Link to="/my-registrations" style={{ color: '#38bdf8', fontSize: '0.9rem', fontWeight: 600 }} id="nav-my-tickets">
            🎟️ My Tickets
          </Link>
        )}
        {user?.role === 'organizer' ? (
          <Link
            to="/organizer"
            style={{
              color: '#a5b4fc',
              fontSize: '0.9rem',
              fontWeight: 700,
              padding: '0.25rem 0.6rem',
              borderRadius: '6px',
              background: 'rgba(99, 102, 241, 0.15)',
              border: '1px solid rgba(99, 102, 241, 0.3)',
            }}
            id="nav-organizer-area"
          >
            📊 Organizer Command
          </Link>
        ) : (
          <Link to="/organizer" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
            Organizer Area
          </Link>
        )}
        <Link to="/participant" style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>
          Participant Area
        </Link>
        <Link to="/" style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
          System Health
        </Link>
      </nav>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {user ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{user.name}</div>
              <span
                style={{
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '0.15rem 0.5rem',
                  borderRadius: '4px',
                  background: user.role === 'organizer' ? 'rgba(99, 102, 241, 0.25)' : 'rgba(56, 189, 248, 0.2)',
                  color: user.role === 'organizer' ? '#a5b4fc' : '#38bdf8',
                  fontWeight: 700,
                }}
              >
                {user.role}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="btn-primary"
              style={{
                padding: '0.45rem 0.9rem',
                fontSize: '0.8rem',
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                boxShadow: 'none',
              }}
              id="logout-btn"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <Link
              to="/login"
              className="btn-primary"
              style={{
                padding: '0.45rem 1rem',
                fontSize: '0.85rem',
                background: 'transparent',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'none',
              }}
              id="nav-login-btn"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="btn-primary"
              style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}
              id="nav-register-btn"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
};
