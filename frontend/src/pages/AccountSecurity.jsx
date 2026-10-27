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
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const result = await api('/auth/password/forgot', { method: 'POST', body: { email } });
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
      <h2>Forgot your password?</h2>
      <p className="muted">Enter the email address on your account. If it exists, we’ll send a secure reset link.</p>
      {message && <div className="alert success">{message}</div>}
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

export const OrganizerSecurity = () => {
  const [enabled, setEnabled] = useState(false);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const result = await api('/auth/mfa');
    setEnabled(result.enabled);
  };

  useEffect(() => {
    load().catch((loadError) => setError(loadError.message));
  }, []);

  const begin = async () => {
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      setSetup(await api('/auth/mfa/setup', { method: 'POST', body: {} }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const enable = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api('/auth/mfa/enable', { method: 'POST', body: { code } });
      setEnabled(true);
      setSetup(null);
      setRecoveryCodes(result.recoveryCodes);
      setFeedback('MFA is enabled. Save these recovery codes now; they will not be shown again.');
      setCode('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const disable = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api('/auth/mfa/disable', { method: 'POST', body: { password, code } });
      setEnabled(false);
      setRecoveryCodes([]);
      setFeedback(result.message);
      setCode('');
      setPassword('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card form narrow-wide security-panel">
      <span className="eyebrow">ORGANIZER ACCOUNT</span>
      <h1>Sign-in security</h1>
      <p className="muted">Add an authenticator app as a second step when you sign in to your organizer account.</p>
      {error && <div className="alert error">{error}</div>}
      {feedback && <div className="alert success">{feedback}</div>}

      {recoveryCodes.length > 0 && (
        <div className="recovery-codes">
          <h3>Recovery codes</h3>
          <p>Each code works once. Store them somewhere safe, separate from your authenticator.</p>
          <div>{recoveryCodes.map((item) => <code key={item}>{item}</code>)}</div>
        </div>
      )}

      {!enabled && !setup && <button className="btn" disabled={busy} onClick={begin}>{busy ? 'Preparing…' : 'Set up authenticator'}</button>}
      {!enabled && setup && (
        <form className="form" onSubmit={enable}>
          <div className="mfa-setup-details">
            <h2>Connect your authenticator</h2>
            <p>Add EventPilot to an authenticator app using this setup key. The key expires in 10 minutes.</p>
            <code>{setup.secret}</code>
            <a href={setup.otpauthUrl}>Open authenticator app</a>
          </div>
          <label>6-digit authenticator code
            <input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <div className="row">
            <button className="btn" disabled={busy}>{busy ? 'Verifying…' : 'Enable MFA'}</button>
            <button className="btn ghost" type="button" onClick={() => setSetup(null)}>Cancel</button>
          </div>
        </form>
      )}
      {enabled && (
        <form className="form mfa-disable-form" onSubmit={disable}>
          <div className="alert success">Authenticator MFA is enabled for your organizer account.</div>
          <label>Current password
            <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label>6-digit authenticator code
            <input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} />
          </label>
          <button className="btn danger" disabled={busy}>{busy ? 'Updating…' : 'Disable MFA'}</button>
        </form>
      )}
    </section>
  );
};
