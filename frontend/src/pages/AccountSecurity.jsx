import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';

const TokenResult = ({ title, token, endpoint, successFallback }) => {
  const [status, setStatus] = useState(() => (
    token
      ? { loading: true, message: '' }
      : { loading: false, message: 'This link is incomplete or invalid.', error: true }
  ));

  useEffect(() => {
    let active = true;
    if (!token) return () => { active = false; };
    api(endpoint, { method: 'POST', body: { token } })
      .then((result) => active && setStatus({ loading: false, message: result.message || successFallback }))
      .catch((error) => active && setStatus({ loading: false, message: error.message, error: true }));
    return () => { active = false; };
  }, [endpoint, successFallback, token]);

  return (
    <section className="card form narrow account-card">
      <span className="eyebrow">ACCOUNT SECURITY</span>
      <h2>{title}</h2>
      <div className={`alert ${status.loading ? 'info' : status.error ? 'error' : 'success'}`}>
        {status.loading ? 'Checking your secure link…' : status.message}
      </div>
      {!status.loading && <Link className="btn" to="/login">Continue to sign in</Link>}
    </section>
  );
};

export const VerifyEmail = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  return <TokenResult key={token} title="Verify your email" token={token} endpoint="/auth/verify-email" successFallback="Email verified. You can now sign in." />;
};

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    setResetUrl('');
    setError('');
    try {
      const result = await api('/auth/password/forgot', { method: 'POST', body: { email } });
      setMessage(result.message);
      if (result.resetUrl) {
        setResetUrl(result.resetUrl);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form narrow account-card" onSubmit={submit}>
      <span className="eyebrow">ACCOUNT RECOVERY</span>
      <h2>Forgot your password?</h2>
      <p className="muted">Enter the email address on your account. If it exists, we’ll send a secure reset link.</p>
      {message && <div className="alert success">{message}</div>}
      {resetUrl && (
        <div style={{ padding: '.85rem 1rem', background: 'rgba(99,102,241,.12)', borderRadius: '8px', border: '1px solid rgba(99,102,241,.3)', display: 'flex', flexDirection: 'column', gap: '.4rem' }}>
          <span style={{ fontSize: '.85rem', color: '#c7d2fe' }}>
            ⚡ <strong>Testing / Local Mode:</strong> Reset link generated:
          </span>
          <Link to={resetUrl} className="btn sm">
            Proceed to Reset Password ➔
          </Link>
        </div>
      )}
      {error && <div className="alert error">{error}</div>}
      <label>Email
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <button className="btn" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
      <Link to="/login" className="account-form-links">Back to sign in</Link>
    </form>
  );
};

export const ResetPassword = () => {
  const [params] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const token = params.get('token') || '';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (password !== confirmation) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const result = await api('/auth/password/reset', { method: 'POST', body: { token, password } });
      setMessage(result.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="card form narrow account-card" onSubmit={submit}>
      <span className="eyebrow">ACCOUNT RECOVERY</span>
      <h2>Choose a new password</h2>
      {!token && <div className="alert error">This reset link is incomplete or invalid.</div>}
      {message && <div className="alert success">{message} <Link to="/login">Sign in</Link></div>}
      {error && <div className="alert error">{error}</div>}
      {token && !message && <>
        <label>New password (8–72 characters)
          <input type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <label>Confirm new password
          <input type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
        </label>
        <button className="btn" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button>
      </>}
    </form>
  );
};

