import { useState, useEffect } from 'react';

const calculateTimeLeft = (startAt, endAt) => {
  if (!startAt) return null;
  const now = new Date().getTime();
  const start = new Date(startAt).getTime();
  const end = endAt ? new Date(endAt).getTime() : start + 3600000;

  if (now < start) {
    const diff = start - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return {
      status: 'upcoming',
      badge: '⏳ Starts In',
      label: 'Event countdown until opening kickoff',
      units: { days, hours, minutes, seconds },
    };
  }

  if (now >= start && now <= end) {
    const diff = end - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / 1000 / 60) % 60);
    const seconds = Math.floor((diff / 1000) % 60);

    return {
      status: 'live',
      badge: '🔴 Live Now',
      label: 'In Progress! Closes in',
      units: { days, hours, minutes, seconds },
    };
  }

  return {
    status: 'concluded',
    badge: '🏁 Concluded',
    label: 'This event has concluded.',
    units: null,
  };
};

export const EventCountdown = ({ startAt, endAt }) => {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(startAt, endAt));

  useEffect(() => {
    setTimeLeft(calculateTimeLeft(startAt, endAt));
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(startAt, endAt));
    }, 1000);
    return () => clearInterval(timer);
  }, [startAt, endAt]);

  if (!timeLeft) return null;

  return (
    <div className={`event-countdown-bar ${timeLeft.status}`}>
      <div className="countdown-info">
        <span className="countdown-badge">{timeLeft.badge}</span>
        <span className="countdown-title">{timeLeft.label}</span>
      </div>

      {timeLeft.units ? (
        <div className="countdown-clock">
          <div className="countdown-segment">
            <span className="segment-value">{String(timeLeft.units.days).padStart(2, '0')}</span>
            <span className="segment-label">Days</span>
          </div>
          <span className="segment-divider">:</span>
          <div className="countdown-segment">
            <span className="segment-value">{String(timeLeft.units.hours).padStart(2, '0')}</span>
            <span className="segment-label">Hours</span>
          </div>
          <span className="segment-divider">:</span>
          <div className="countdown-segment">
            <span className="segment-value">{String(timeLeft.units.minutes).padStart(2, '0')}</span>
            <span className="segment-label">Mins</span>
          </div>
          <span className="segment-divider">:</span>
          <div className="countdown-segment">
            <span className="segment-value">{String(timeLeft.units.seconds).padStart(2, '0')}</span>
            <span className="segment-label">Secs</span>
          </div>
        </div>
      ) : (
        <span className="muted" style={{ fontSize: '.88rem' }}>Thank you for attending!</span>
      )}
    </div>
  );
};
