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
      <Link to="/" className="brand"><span className="brand-mark" aria-hidden="true">✳</span>Event<span>Pilot</span></Link>
      <nav>
        <NavLink to="/events">Discover</NavLink>
        {user?.role === 'participant' && <NavLink to="/participant">My tickets</NavLink>}
        {user?.role === 'organizer' && (
          <>
            <NavLink to="/organizer" end>Your events</NavLink>
            <NavLink to="/organizer/team">Organizer Team</NavLink>
          </>
        )}
      </nav>
      <div className="nav-user">
        {user ? (
          <>
            <span className="nav-name"><span className="nav-avatar">{user.name?.slice(0, 1).toUpperCase()}</span><span className="nav-welcome">Hi, {user.name?.split(' ')[0]}</span></span>
            <button className="btn ghost sm" onClick={handleLogout}>Sign out <span aria-hidden="true">↗</span></button>
          </>
        ) : (
          <>
            <Link to="/login" className="btn ghost sm">Sign in</Link>
            <Link to="/register" className="btn sm">Join EventPilot <span aria-hidden="true">↗</span></Link>
          </>
        )}
      </div>
    </header>
  );
};
