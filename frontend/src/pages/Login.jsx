import { useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homeFor } from '../lib/format';

export const Login = () => {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const from = useLocation().state?.from;
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />;

  const submit = async (e) => {
    e?.preventDefault?.();
    setError('');
    setBusy(true);
    try {
      const u = await login(form.email, form.password);
      // Only follow the "return to" path if this role may open it
      const allowed = from && (u.role === 'organizer' ? !from.startsWith('/participant') : !from.startsWith('/organizer'));
      navigate(allowed ? from : homeFor(u), { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const handleQuickLogin = async (email, password) => {
    setForm({ email, password });
    setError('');
    setBusy(true);
    try {
      const u = await login(email, password);
      const allowed = from && (u.role === 'organizer' ? !from.startsWith('/participant') : !from.startsWith('/organizer'));
      navigate(allowed ? from : homeFor(u), { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="card form narrow" onSubmit={submit}>
      <h2>Sign in</h2>
      {error && <div className="alert error">{error}</div>}
      <label>Email
        <input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </label>
      <label>Password
        <input type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </label>
      <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <p className="muted">New here? <Link to="/register">Create a participant account</Link></p>

      <div className="demo-box">
        <div className="demo-title">⚡ Quick Demo Accounts</div>
        <p className="demo-desc">Click to instantly test dashboards without typing:</p>
        <div className="demo-grid">
          <button
            type="button"
            className="demo-btn"
            disabled={busy}
            onClick={() => handleQuickLogin('organizer1@eventpilot.dev', 'Password123!')}
          >
            <strong>👔 Demo Organizer</strong>
            <span>organizer1@eventpilot.dev</span>
          </button>
          <button
            type="button"
            className="demo-btn"
            disabled={busy}
            onClick={() => handleQuickLogin('participant@eventpilot.dev', 'Password123!')}
          >
            <strong>🎟️ Demo Participant</strong>
            <span>participant@eventpilot.dev</span>
          </button>
        </div>
      </div>
    </form>
  );
};
