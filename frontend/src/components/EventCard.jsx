import { Link } from 'react-router-dom';
import { categoryLabel, fmtDate } from '../lib/format';

const CATEGORY_ART = {
  hackathon: { icon: '⌘', scene: 'violet', caption: 'Build something brilliant' },
  conference: { icon: '◈', scene: 'blue', caption: 'Ideas worth sharing' },
  workshop: { icon: '✳', scene: 'orange', caption: 'Learn by doing' },
  webinar: { icon: '↗', scene: 'cyan', caption: 'Good ideas, anywhere' },
  sports: { icon: '◉', scene: 'green', caption: 'Bring your energy' },
  festival: { icon: '✺', scene: 'pink', caption: 'Make a day of it' },
};

export const EventCard = ({ event }) => {
  const art = CATEGORY_ART[event.category] || CATEGORY_ART.conference;
  const remaining = Math.max(0, event.remainingSeats ?? 0);
  const capacity = Math.max(1, event.capacity || 1);
  const bookedPercent = Math.min(100, Math.round(((capacity - remaining) / capacity) * 100));

  return (
    <Link to={`/events/${event._id}`} className={`event-card event-art-${art.scene}`}>
      <div className="event-card-art">
        <span className="event-card-date">{fmtDate(event.startAt).split(',').slice(0, 2).join(',')}</span>
        <span className="event-card-symbol" aria-hidden="true">{art.icon}</span>
        <span className="event-card-mode">{event.mode === 'online' ? 'Online event' : 'In person'}</span>
      </div>
      <div className="event-card-body">
        <div className="event-card-category">{categoryLabel(event.category)}</div>
        <h3>{event.title}</h3>
        <p className="muted clamp">{event.description}</p>
        <div className="event-card-details">
          <span>{event.mode === 'online' ? '◉ Join from anywhere' : `⌖ ${event.venue}`}</span>
        </div>
        <div className="event-card-footer">
          <div className="seat-summary">
            <span className={remaining === 0 ? 'danger-text' : ''}>
              {remaining === 0 ? 'Fully booked' : `${remaining} spots left`}
            </span>
            <span className="seat-track" aria-hidden="true">
              <span style={{ width: `${bookedPercent}%` }} />
            </span>
          </div>
          <span className="event-card-arrow" aria-hidden="true">↗</span>
        </div>
      </div>
    </Link>
  );
};
