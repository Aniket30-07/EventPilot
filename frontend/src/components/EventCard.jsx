import { Link } from 'react-router-dom';
import { categoryLabel, fmtDate } from '../lib/format';

export const EventCard = ({ event }) => (
  <Link to={`/events/${event._id}`} className="card event-card">
    <span className="pill">{categoryLabel(event.category)}</span>
    <h3>{event.title}</h3>
    <p className="muted clamp">{event.description}</p>
    <div className="meta">
      <span>📅 {fmtDate(event.startAt)}</span>
      <span>{event.mode === 'online' ? '🌐 Online' : `📍 ${event.venue}`}</span>
      <span className={event.remainingSeats === 0 ? 'danger-text' : 'ok-text'}>
        {event.remainingSeats === 0 ? 'Full' : `${event.remainingSeats} of ${event.capacity} seats left`}
      </span>
    </div>
  </Link>
);
