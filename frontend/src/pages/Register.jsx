import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homeFor } from '../lib/format';

export const Register = () => {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to={homeFor(user)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await register(form.name, form.email, form.password);
      navigate('/login', { replace: true, state: { notice: result.message } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form className="card form narrow" onSubmit={submit}>
      <h2>Create your account</h2>
      {error && <div className="alert error">{error}</div>}
      <label>Name
        <input required minLength={2} maxLength={100} autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </label>
      <label>Email
        <input type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </label>
      <label>Password (8–72 characters)
        <input type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      </label>
      <button className="btn" disabled={busy}>{busy ? 'Creating…' : 'Sign up'}</button>
      <p className="muted">Already have an account? <Link to="/login">Sign in</Link></p>
    </form>
  );
};
