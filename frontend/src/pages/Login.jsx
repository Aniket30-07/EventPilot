import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [seedNotice, setSeedNotice] = useState(null);

  const { login, authError, setAuthError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;

    setSubmitting(true);
    try {
      const res = await login(email, password);
      if (res.user.role === 'organizer') {
        navigate('/organizer');
      } else {
        navigate(from === '/login' ? '/participant' : from);
      }
    } catch {
      // error handled in AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  const fillOrganizer = () => {
    setEmail('organizer@eventpilot.dev');
    setPassword('OrganizerPass123!');
    setAuthError(null);
  };

  const triggerSeed = async () => {
    try {
      const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
      const res = await fetch(`${API_BASE}/auth/seed-organizer`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSeedNotice('Organizer account verified & seeded in database!');
        fillOrganizer();
      }
    } catch (err) {
      setSeedNotice(`Seed failed: ${err.message}`);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '2rem auto', width: '100%' }}>
      <div className="hero-card">
        <h2 style={{ fontSize: '1.6rem', marginBottom: '0.4rem', textAlign: 'center' }}>
          Welcome Back
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          Sign in to access your EventPilot account.
        </p>

        {authError && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#f87171',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
            }}
            id="auth-error-banner"
          >
            ⚠️ {authError}
          </div>
        )}

        {seedNotice && (
          <div
            style={{
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#34d399',
              fontSize: '0.85rem',
              marginBottom: '1.25rem',
            }}
          >
            ✓ {seedNotice}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              id="login-email-input"
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
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              id="login-password-input"
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

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting}
            id="login-submit-btn"
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
          >
            {submitting ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Development Quick Helper - Only rendered in dev mode */}
        {import.meta.env.DEV && (
          <div
            style={{
              marginTop: '1.75rem',
              paddingTop: '1.25rem',
              borderTop: '1px solid var(--border-subtle)',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Development Quick-Fill
            </span>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
              <button
                type="button"
                onClick={fillOrganizer}
                className="btn-primary"
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  background: 'rgba(99, 102, 241, 0.15)',
                  border: '1px solid rgba(99, 102, 241, 0.3)',
                  color: '#a5b4fc',
                  boxShadow: 'none',
                }}
                id="quick-fill-organizer-btn"
              >
                Fill Organizer Creds
              </button>
              <button
                type="button"
                onClick={triggerSeed}
                className="btn-primary"
                style={{
                  padding: '0.35rem 0.75rem',
                  fontSize: '0.75rem',
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)',
                  boxShadow: 'none',
                }}
              >
                Seed Organizer DB
              </button>
            </div>
          </div>
        )}

        <p style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Sign up as Participant
          </Link>
        </p>
      </div>
    </div>
  );
};
