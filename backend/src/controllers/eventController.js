import Event, { EVENT_CATEGORIES } from '../models/Event.js';
import Registration from '../models/Registration.js';
import { getEventMetrics, shapeMetrics } from '../utils/metrics.js';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isOwner = (event, user) => Boolean(user && event.organizerId.equals(user._id));
const fail = (res, status, message) => res.status(status).json({ success: false, message });

const EDITABLE = ['title', 'description', 'category', 'startAt', 'endAt', 'mode', 'venue', 'onlineLink', 'capacity', 'registrationDeadline'];

// Validates a full event object (merged existing + changes). Returns an error string or null.
const validateEvent = (e, { requireFutureStart = false } = {}) => {
  if (typeof e.title !== 'string' || e.title.trim().length < 3 || e.title.trim().length > 200) return 'Title must be 3–200 characters.';
  if (typeof e.description !== 'string' || e.description.trim().length < 10) return 'Description must be at least 10 characters.';
  if (!EVENT_CATEGORIES.includes(e.category)) return 'Please choose a valid category.';
  if (!['online', 'in-person'].includes(e.mode)) return 'Mode must be online or in-person.';

  const start = new Date(e.startAt), end = new Date(e.endAt), deadline = new Date(e.registrationDeadline);
  if ([start, end, deadline].some((d) => isNaN(d.getTime()))) return 'Start, end and registration deadline must be valid dates.';
  if (end <= start) return 'End time must be after the start time.';
  if (deadline > start) return 'Registration deadline cannot be after the event start.';
  if (requireFutureStart && start <= new Date()) return 'Start time must be in the future.';

  if (!Number.isInteger(Number(e.capacity)) || Number(e.capacity) < 1 || Number(e.capacity) > 100000) return 'Capacity must be a whole number between 1 and 100000.';

  if (e.mode === 'in-person' && !(typeof e.venue === 'string' && e.venue.trim())) return 'Venue is required for in-person events.';
  if (e.mode === 'online') {
    try {
      const u = new URL(e.onlineLink);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
    } catch {
      return 'A valid meeting link (http/https) is required for online events.';
    }
  }
  return null;
};

const loadOwnedEvent = async (req, res) => {
  const event = await Event.findById(req.params.eventId);
  if (!event) { fail(res, 404, 'Event not found.'); return null; }
  if (!isOwner(event, req.user)) { fail(res, 403, 'You do not own this event.'); return null; }
  return event;
};

// GET /api/events — published, not-yet-ended events only
export const getPublishedEvents = async (req, res, next) => {
  try {
    const { q, category, mode, sort } = req.query;
    const filter = { status: 'published', endAt: { $gte: new Date() } };

    if (typeof category === 'string' && EVENT_CATEGORIES.includes(category)) filter.category = category;
    if (mode === 'online' || mode === 'in-person') filter.mode = mode;
    if (typeof q === 'string' && q.trim()) {
      const regex = new RegExp(escapeRegex(q.trim().slice(0, 100)), 'i');
      filter.$or = [{ title: regex }, { description: regex }];
    }

    const sortOption = sort === 'latest' ? { createdAt: -1 } : { startAt: 1 };
    const events = await Event.find(filter).sort(sortOption).populate('organizerId', 'name').select('-onlineLink').lean();
    const metrics = await getEventMetrics(events.map((e) => e._id));

    const result = events.map((e) => {
      const m = shapeMetrics(metrics.get(e._id.toString()), e.capacity);
      return { ...e, confirmedCount: m.confirmedCount, remainingSeats: m.remainingSeats };
    });
    res.status(200).json({ success: true, count: result.length, events: result });
  } catch (error) {
    next(error);
  }
};

// GET /api/events/:eventId — published (public) or any status (owner)
export const getEventById = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId).populate('organizerId', 'name');
    if (!event) return fail(res, 404, 'Event not found.');

    const owner = Boolean(req.user && event.organizerId._id.equals(req.user._id));
    if (event.status !== 'published' && !owner) return fail(res, 404, 'Event not found.');

    const obj = event.toObject();
    const m = shapeMetrics((await getEventMetrics([event._id])).get(event._id.toString()), event.capacity);
    obj.confirmedCount = m.confirmedCount;
    obj.remainingSeats = m.remainingSeats;

    let myRegistration = null;
    if (req.user?.role === 'participant') {
      myRegistration = await Registration.findOne({ eventId: event._id, participantId: req.user._id });
    }
    // The private meeting link is only shown to the owner and to confirmed registrants.
    if (!owner && myRegistration?.status !== 'confirmed') delete obj.onlineLink;

    res.status(200).json({ success: true, event: obj, isOwner: owner, myRegistration });
  } catch (error) {
    next(error);
  }
};

// POST /api/events — always creates a draft
export const createEvent = async (req, res, next) => {
  try {
    const body = req.body || {};
    const data = Object.fromEntries(EDITABLE.map((k) => [k, body[k]]));
    const err = validateEvent(data, { requireFutureStart: true });
    if (err) return fail(res, 400, err);

    const event = await Event.create({
      ...data,
      title: data.title.trim(),
      description: data.description.trim(),
      capacity: Number(data.capacity),
      venue: data.mode === 'in-person' ? data.venue.trim() : '',
      onlineLink: data.mode === 'online' ? data.onlineLink.trim() : '',
      organizerId: req.user._id,
      status: 'draft',
    });
    res.status(201).json({ success: true, message: 'Event saved as draft.', event });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/events/:eventId
export const updateEvent = async (req, res, next) => {
  try {
    const event = await loadOwnedEvent(req, res);
    if (!event) return;
    if (['cancelled', 'completed'].includes(event.status)) return fail(res, 400, `A ${event.status} event cannot be edited.`);

    const merged = Object.fromEntries(EDITABLE.map((k) => [k, req.body?.[k] !== undefined ? req.body[k] : event[k]]));
    const err = validateEvent(merged, { requireFutureStart: req.body?.startAt !== undefined });
    if (err) return fail(res, 400, err);

    const { confirmed } = (await getEventMetrics([event._id])).get(event._id.toString());
    if (Number(merged.capacity) < confirmed) {
      return fail(res, 400, `Capacity cannot be lower than the ${confirmed} confirmed registrations.`);
    }

    Object.assign(event, merged, {
      title: merged.title.trim(),
      description: merged.description.trim(),
      capacity: Number(merged.capacity),
      venue: merged.mode === 'in-person' ? merged.venue.trim() : '',
      onlineLink: merged.mode === 'online' ? merged.onlineLink.trim() : '',
    });
    await event.save();
    res.status(200).json({ success: true, message: 'Event updated.', event });
  } catch (error) {
    next(error);
  }
};

// POST /api/events/:eventId/publish
export const publishEvent = async (req, res, next) => {
  try {
    const event = await loadOwnedEvent(req, res);
    if (!event) return;
    if (event.status !== 'draft') return fail(res, 400, `Only draft events can be published (this one is ${event.status}).`);
    if (event.endAt <= new Date()) return fail(res, 400, 'This event has already ended. Edit the dates before publishing.');

    event.status = 'published';
    await event.save();
    res.status(200).json({ success: true, message: 'Event published.', event });
  } catch (error) {
    next(error);
  }
};

// POST /api/events/:eventId/cancel
export const cancelEvent = async (req, res, next) => {
  try {
    const event = await loadOwnedEvent(req, res);
    if (!event) return;
    if (event.status === 'cancelled') return fail(res, 400, 'This event is already cancelled.');

    event.status = 'cancelled';
    await event.save();
    res.status(200).json({ success: true, message: 'Event cancelled.', event });
  } catch (error) {
    next(error);
  }
};

// GET /api/events/mine/analytics — organizer dashboard (own events only)
export const getOrganizerAnalytics = async (req, res, next) => {
  try {
    const events = await Event.find({ organizerId: req.user._id }).sort({ startAt: -1 }).lean();
    const metrics = await getEventMetrics(events.map((e) => e._id));

    const rows = events.map((e) => ({
      _id: e._id, title: e.title, status: e.status, category: e.category, mode: e.mode,
      startAt: e.startAt, endAt: e.endAt,
      ...shapeMetrics(metrics.get(e._id.toString()), e.capacity),
    }));

    const confirmed = rows.reduce((s, r) => s + r.confirmedCount, 0);
    const checkedIn = rows.reduce((s, r) => s + r.checkedInCount, 0);
    res.status(200).json({
      success: true,
      summary: {
        totalEvents: rows.length,
        publishedEvents: rows.filter((r) => r.status === 'published').length,
        confirmedRegistrations: confirmed,
        checkedInAttendees: checkedIn,
        overallCheckInRate: confirmed > 0 ? Number(((checkedIn / confirmed) * 100).toFixed(1)) : 0,
      },
      events: rows,
    });
  } catch (error) {
    next(error);
  }
};
