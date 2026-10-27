import { useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homeFor } from '../lib/format';
import { api } from '../lib/api';

const DEMO_ROLES = [
  {
    icon: '🛡️',
    name: 'Lead Organiser (Root Admin)',
    email: 'organiser1@gmail.com',
    password: 'organiser1@',
    badge: 'ORGANIZER',
    badgeColor: '#c084fc',
    badgeBg: 'rgba(168, 85, 247, 0.16)',
    desc: 'Password: organiser1@',
  },
  {
    icon: '🚀',
    name: 'User 1 (Team Alpha Captain)',
    email: 'user1@gmail.com',
    password: 'user1@',
    badge: 'CAPTAIN',
    badgeColor: '#34d399',
    badgeBg: 'rgba(52, 211, 153, 0.16)',
    desc: 'Password: user1@ (Submitted project)',
  },
  {
    icon: '💻',
    name: 'User 5 (Team Beta Captain)',
    email: 'user5@gmail.com',
    password: 'user5@',
    badge: 'PARTICIPANT',
    badgeColor: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.16)',
    desc: 'Password: user5@ (Ready to submit)',
  },
  {
    icon: '🏏',
    name: 'Player 1 (Cricket Captain)',
    email: 'player1@gmail.com',
    password: 'player1@',
    badge: 'CRICKET XI',
    badgeColor: '#fbbf24',
    badgeBg: 'rgba(251, 191, 36, 0.16)',
    desc: 'Password: player1@ (15 Squad players)',
  },
  {
    icon: '👤',
    name: 'Guest Evaluator (Clean State)',
    email: 'guest.evaluator@gmail.com',
    password: 'guest@',
    badge: 'NEW USER',
    badgeColor: '#2dd4bf',
    badgeBg: 'rgba(45, 212, 191, 0.16)',
    desc: 'Password: guest@ (0 registrations)',
  },
];

export const Login = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;
  const notice = location.state?.notice;
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />;

  const submit = async (e, overrideEmail, overridePassword) => {
    e?.preventDefault?.();
    setError('');
    setErrorCode('');
    setBusy(true);
    const emailToUse = overrideEmail || form.email;
    const passwordToUse = overridePassword || form.password;

    try {
      const u = await login(emailToUse, passwordToUse);
      const allowed = from && (u.user.role === 'organizer' ? !from.startsWith('/participant') : !from.startsWith('/organizer'));
      navigate(allowed ? from : homeFor(u.user), { replace: true });
    } catch (err) {
      setError(err.message);
      setErrorCode(err.code || '');
      setBusy(false);
    }
  };

  const resendVerification = async () => {
    setError('');
    setFeedback('');
    setErrorCode('');
    try {
      const result = await api('/auth/resend-verification', { method: 'POST', body: { email: form.email } });
      setFeedback(result.message);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card form account-card" style={{ maxWidth: '480px', margin: '2rem auto', width: '100%' }}>
      <span className="eyebrow">WELCOME BACK</span>
      <h2>Sign in</h2>
      {notice && <div className="alert info">{notice}</div>}
      {error && <div className="alert error">{error}</div>}
      {feedback && <div className="alert success">{feedback}</div>}

      <form className="form" onSubmit={submit}>
        <label>Email
          <input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="e.g. organiser1@gmail.com"
          />
        </label>
        <label>Password
          <input
            type="password"
            required
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="••••••••"
          />
        </label>
        <div className="account-form-links">
          <Link to="/forgot-password">Forgot password?</Link>
        </div>
        <button className="btn" disabled={busy} style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem' }}>
          {busy ? 'Signing in…' : 'Sign In to Dashboard →'}
        </button>
        {errorCode === 'EMAIL_NOT_VERIFIED' && (
          <button type="button" className="btn ghost" onClick={resendVerification}>
            Resend verification email
          </button>
        )}
        <p className="muted account-bottom-link">
          New here? <Link to="/register">Create a participant account</Link>
        </p>
      </form>

      {/* 1-Click Role Fill UI for Evaluation & Testing */}
      <div style={{ marginTop: '0.75rem', paddingTop: '1.25rem', borderTop: '1px dashed var(--border)' }}>
        <div style={{
          textAlign: 'center',
          fontSize: '0.74rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'var(--muted)',
          textTransform: 'uppercase',
          marginBottom: '0.9rem',
        }}>
          1-CLICK ROLE FILL (EVALUATION & TESTING)
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {DEMO_ROLES.map((role) => {
            const isSelected = form.email === role.email;
            return (
              <button
                key={role.email}
                type="button"
                onClick={() => {
                  setForm({ email: role.email, password: role.password });
                  setFeedback(`Selected ${role.name}. Click "Sign In to Dashboard →" or press Enter.`);
                  setError('');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.7rem 0.9rem',
                  borderRadius: '12px',
                  border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                  background: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease',
                  color: 'inherit',
                  font: 'inherit',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                  <span style={{
                    fontSize: '1.15rem',
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '10px',
                    background: role.badgeBg,
                    flexShrink: 0,
                  }}>
                    {role.icon}
                  </span>
                  <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {role.name}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--muted)', fontFamily: 'ui-monospace, monospace' }}>
                      {role.email} • {role.desc}
                    </div>
                  </div>
                </div>
                <span style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  padding: '0.2rem 0.55rem',
                  borderRadius: '6px',
                  color: role.badgeColor,
                  background: role.badgeBg,
                  border: `1px solid ${role.badgeColor}40`,
                  flexShrink: 0,
                  textTransform: 'uppercase',
                }}>
                  {role.badge}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
