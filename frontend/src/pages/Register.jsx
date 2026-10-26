import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { register, authError, setAuthError } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) return;

    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate('/participant');
    } catch {
      // error handled in AuthContext
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '440px', margin: '2rem auto', width: '100%' }}>
      <div className="hero-card">
        <h2 style={{ fontSize: '1.6rem', marginBottom: '0.4rem', textAlign: 'center' }}>
          Create an Account
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem', textAlign: 'center' }}>
          Join EventPilot to discover and register for events.
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
            id="register-error-banner"
          >
            ⚠️ {authError}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Johnson"
              required
              id="register-name-input"
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
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@example.com"
              required
              id="register-email-input"
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
              Password (min. 6 characters)
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={6}
              id="register-password-input"
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

          <div
            style={{
              padding: '0.6rem 0.8rem',
              borderRadius: '8px',
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              fontSize: '0.75rem',
              color: '#a5b4fc',
            }}
          >
            🔒 <strong>PRD Role Policy:</strong> Public registrations are automatically assigned the <em>Participant</em> role. Organizer privileges require controlled seeding.
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={submitting}
            id="register-submit-btn"
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
          >
            {submitting ? 'Creating Account...' : 'Register as Participant'}
          </button>
        </form>

        <p style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};
