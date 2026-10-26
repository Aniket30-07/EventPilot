import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '5rem 1rem' }}>
        <div className="status-indicator checking" style={{ margin: '0 auto', display: 'inline-flex' }}>
          <span className="pulse-dot"></span>
          Verifying session credentials...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="hero-card" style={{ maxWidth: '640px', margin: '3rem auto', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚫</div>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.75rem', color: '#f87171' }}>
          403 — Access Denied
        </h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: '1.6' }}>
          Your account is currently registered as a <strong>{user.role}</strong>.
          This area requires the <strong>{allowedRoles.join(', ')}</strong> role.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
          <Link to="/" className="btn-primary" style={{ background: 'rgba(255, 255, 255, 0.1)' }}>
            Return Home
          </Link>
          <Link to="/participant" className="btn-primary">
            Go to Participant Area
          </Link>
        </div>
      </div>
    );
  }

  return children;
};
