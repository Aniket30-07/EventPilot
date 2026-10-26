import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { EventDiscovery } from './pages/EventDiscovery';
import { EventDetail } from './pages/EventDetail';
import { EventForm } from './pages/EventForm';
import { MyRegistrations } from './pages/MyRegistrations';
import { ParticipantDashboard } from './pages/ParticipantDashboard';
import { OrganizerDashboard } from './pages/OrganizerDashboard';
import { EventAttendees } from './pages/EventAttendees';
import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <div className="app-container">
          <Navbar />
          <main style={{ minHeight: '65vh' }}>
            <Routes>
              {/* Public Discovery & Auth Routes */}
              <Route path="/" element={<Home />} />
              <Route path="/events" element={<EventDiscovery />} />
              <Route path="/events/:eventId" element={<EventDetail />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />

              {/* Protected Participant Registrations & Tickets */}
              <Route
                path="/my-registrations"
                element={
                  <ProtectedRoute allowedRoles={['participant', 'organizer']}>
                    <MyRegistrations />
                  </ProtectedRoute>
                }
              />

              {/* Protected Organizer Event Lifecycle Routes */}
              <Route
                path="/organizer/events/new"
                element={
                  <ProtectedRoute allowedRoles={['organizer']}>
                    <EventForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organizer/events/:eventId/edit"
                element={
                  <ProtectedRoute allowedRoles={['organizer']}>
                    <EventForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organizer/events/:eventId/attendees"
                element={
                  <ProtectedRoute allowedRoles={['organizer']}>
                    <EventAttendees />
                  </ProtectedRoute>
                }
              />

              {/* Protected Routes */}
              <Route
                path="/participant"
                element={
                  <ProtectedRoute allowedRoles={['participant', 'organizer']}>
                    <ParticipantDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/organizer"
                element={
                  <ProtectedRoute allowedRoles={['organizer']}>
                    <OrganizerDashboard />
                  </ProtectedRoute>
                }
              />

              {/* 404 Not Found */}
              <Route
                path="*"
                element={
                  <div className="hero-card" style={{ textAlign: 'center', margin: '4rem auto', maxWidth: '500px' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🧭</div>
                    <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Page Not Found</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                      The requested route does not exist.
                    </p>
                    <Link to="/" className="btn-primary" style={{ margin: '0 auto' }}>
                      Return Home
                    </Link>
                  </div>
                }
              />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </Router>
  );
}

export default App;
