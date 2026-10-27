import Registration from '../models/Registration.js';

// Database-derived counts per event: { confirmed, checkedIn, cancelled }
export const getEventMetrics = async (eventIds) => {
  const rows = await Registration.aggregate([
    { $match: { eventId: { $in: eventIds } } },
    {
      $group: {
        _id: { eventId: '$eventId', status: '$status' },
        // Team players belong to an existing team slot and do not consume a separate team quota
        count: { $sum: { $cond: [{ $eq: ['$roleInTeam', 'player'] }, 0, 1] } },
        checkedIn: { $sum: { $cond: [{ $gt: ['$checkedInAt', null] }, 1, 0] } },
      },
    },
  ]);

  const map = new Map();
  const get = (id) => {
    const key = id.toString();
    if (!map.has(key)) map.set(key, { confirmed: 0, checkedIn: 0, cancelled: 0 });
    return map.get(key);
  };
  eventIds.forEach(get);
  for (const r of rows) {
    const m = get(r._id.eventId);
    if (r._id.status === 'confirmed') {
      m.confirmed = r.count;
      m.checkedIn = r.checkedIn;
    } else {
      m.cancelled = r.count;
    }
  }
  return map;
};

export const shapeMetrics = (m, capacity) => ({
  capacity,
  confirmedCount: m.confirmed,
  checkedInCount: m.checkedIn,
  cancelledCount: m.cancelled,
  checkInRate: m.confirmed > 0 ? Number(((m.checkedIn / m.confirmed) * 100).toFixed(1)) : 0,
  remainingSeats: Math.max(0, capacity - m.confirmed),
});
