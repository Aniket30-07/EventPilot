import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { EventDiscovery } from './pages/EventDiscovery';
import { EventDetail } from './pages/EventDetail';
import { EventForm } from './pages/EventForm';
import { ParticipantDashboard } from './pages/ParticipantDashboard';
import { OrganizerDashboard } from './pages/OrganizerDashboard';
import { EventAttendees } from './pages/EventAttendees';
import { ForgotPassword, OrganizerSecurity, ResetPassword, VerifyEmail } from './pages/AccountSecurity';

const organizerOnly = (el) => <ProtectedRoute role="organizer">{el}</ProtectedRoute>;

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <main className="container">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/events" element={<EventDiscovery />} />
            <Route path="/events/:eventId" element={<EventDetail />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/participant" element={<ProtectedRoute role="participant"><ParticipantDashboard /></ProtectedRoute>} />
            <Route path="/my-registrations" element={<Navigate to="/participant" replace />} />

            <Route path="/organizer" element={organizerOnly(<OrganizerDashboard />)} />
            <Route path="/organizer/security" element={organizerOnly(<OrganizerSecurity />)} />
            <Route path="/organizer/events/new" element={organizerOnly(<EventForm />)} />
            <Route path="/organizer/events/:eventId/edit" element={organizerOnly(<EventForm />)} />
            <Route path="/organizer/events/:eventId/attendees" element={organizerOnly(<EventAttendees />)} />

            <Route path="*" element={
              <div className="card center">
                <h2>Page not found</h2>
                <Link to="/" className="btn">Go home</Link>
              </div>
            } />
          </Routes>
        </main>
      </AuthProvider>
    </BrowserRouter>
  );
}
