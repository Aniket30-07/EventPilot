export const CATEGORIES = [
  { value: 'hackathon', label: 'Hackathons / Competitions' },
  { value: 'conference', label: 'Conferences / Seminars' },
  { value: 'workshop', label: 'Workshops / Bootcamps' },
  { value: 'webinar', label: 'Webinars / Online Events' },
  { value: 'sports', label: 'Sports / Tournaments' },
  { value: 'festival', label: 'Festivals / Cultural Events' },
];

export const categoryLabel = (v) => CATEGORIES.find((c) => c.value === v)?.label || v;

export const fmtDate = (d) =>
  d ? new Date(d).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

// Where each role lands after login / when blocked from a page
export const homeFor = (user) => (user?.role === 'organizer' ? '/organizer' : '/participant');
