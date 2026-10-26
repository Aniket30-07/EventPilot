import { NavLink, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <header className="navbar">
      <Link to="/" className="brand">✈️ EventPilot</Link>
      <nav>
        <NavLink to="/events">Explore Events</NavLink>
        {user?.role === 'participant' && <NavLink to="/participant">My Dashboard</NavLink>}
        {user?.role === 'organizer' && <NavLink to="/organizer">Organizer Dashboard</NavLink>}
      </nav>
      <div className="nav-user">
        {user ? (
          <>
            <span className="nav-name">{user.name} <span className={`pill ${user.role}`}>{user.role}</span></span>
            <button className="btn ghost sm" onClick={handleLogout}>Sign out</button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn ghost sm">Sign in</Link>
            <Link to="/register" className="btn sm">Sign up</Link>
          </>
        )}
      </div>
    </header>
  );
};
