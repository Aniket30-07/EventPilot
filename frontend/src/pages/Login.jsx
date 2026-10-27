import { useState } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homeFor } from '../lib/format';
import { api } from '../lib/api';

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

  const submit = async (e) => {
    e?.preventDefault?.();
    setError('');
    setErrorCode('');
    setBusy(true);
    try {
      const u = await login(form.email, form.password);
      // Only follow the "return to" path if this role may open it
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
    <div className="card form narrow account-card">
      <span className="eyebrow">WELCOME BACK</span>
      <h2>Sign in</h2>
      {notice && <div className="alert info">{notice}</div>}
      {error && <div className="alert error">{error}</div>}
      {feedback && <div className="alert success">{feedback}</div>}
      <form className="form" onSubmit={submit}>
        <label>Email
          <input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </label>
        <label>Password
          <input type="password" required autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
        </label>
        <div className="account-form-links"><Link to="/forgot-password">Forgot password?</Link></div>
        <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {errorCode === 'EMAIL_NOT_VERIFIED' && (
          <button type="button" className="btn ghost" onClick={resendVerification}>Resend verification email</button>
        )}
        <p className="muted account-bottom-link">New here? <Link to="/register">Create a participant account</Link></p>
      </form>
    </div>
  );
};
