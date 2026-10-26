import mongoose from 'mongoose';
import Event, { EVENT_CATEGORIES } from '../models/Event.js';

// GET /api/events - Public discovery of published events
export const getPublishedEvents = async (req, res, next) => {
  try {
    const { q, category, mode, sort } = req.query;

    const filter = { status: 'published' };

    // Category filter
    if (category && category !== 'all') {
      if (EVENT_CATEGORIES.includes(category)) {
        filter.category = category;
      }
    }

    // Mode filter
    if (mode && ['online', 'in-person'].includes(mode)) {
      filter.mode = mode;
    }

    // Text search filter
    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      filter.$or = [{ title: regex }, { description: regex }];
    }

    // Sorting
    let sortOption = { startAt: 1 }; // Default: upcoming soonest
    if (sort === 'latest') {
      sortOption = { createdAt: -1 };
    } else if (sort === 'capacity') {
      sortOption = { capacity: -1 };
    }

    const events = await Event.find(filter)
      .sort(sortOption)
      .populate('organizerId', 'name email');

    return res.status(200).json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/events/:eventId - Event details (public if published; owner-only if draft/cancelled)
export const getEventById = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid event ID format.',
      });
    }

    const event = await Event.findById(eventId).populate('organizerId', 'name email');
    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found.',
      });
    }

    // If event is not published, only the event owner can view it
    if (event.status !== 'published') {
      const isOwner = req.user && event.organizerId._id.equals(req.user._id);
      if (!isOwner) {
        return res.status(404).json({
          success: false,
          message: 'Event not found or not published.',
        });
      }
    }

    return res.status(200).json({
      success: true,
      event,
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/events/mine - List all events owned by current organizer
export const getMyEvents = async (req, res, next) => {
  try {
    const events = await Event.find({ organizerId: req.user._id }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: events.length,
      events,
    });
  } catch (error) {
    return next(error);
  }
};

// POST /api/events - Create new event (Organizer only)
export const createEvent = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      startAt,
      endAt,
      mode,
      venue,
      onlineLink,
      capacity,
      registrationDeadline,
      status,
    } = req.body;

    // Date validations
    const startDate = new Date(startAt);
    const endDate = new Date(endAt);
    const deadlineDate = new Date(registrationDeadline);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || isNaN(deadlineDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format provided for startAt, endAt, or registrationDeadline.',
      });
    }

    if (endDate <= startDate) {
      return res.status(400).json({
        success: false,
        message: 'End date/time must be strictly after the start date/time.',
      });
    }

    if (deadlineDate > startDate) {
      return res.status(400).json({
        success: false,
        message: 'Registration deadline cannot be after the event start time.',
      });
    }

    const event = await Event.create({
      title,
      description,
      category,
      startAt: startDate,
      endAt: endDate,
      mode,
      venue: mode === 'in-person' ? venue : '',
      onlineLink: mode === 'online' ? onlineLink : '',
      capacity,
      registrationDeadline: deadlineDate,
      organizerId: req.user._id,
      status: ['draft', 'published'].includes(status) ? status : 'draft',
    });

    return res.status(201).json({
      success: true,
      message: 'Event created successfully.',
      event,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', '),
      });
    }
    return next(error);
  }
};

// PATCH /api/events/:eventId - Edit event (Owner only)
export const updateEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    // Strict ownership verification on server
    if (!event.organizerId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to edit this event.',
      });
    }

    if (event.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cancelled events cannot be modified.',
      });
    }

    const allowedUpdates = [
      'title',
      'description',
      'category',
      'startAt',
      'endAt',
      'mode',
      'venue',
      'onlineLink',
      'capacity',
      'registrationDeadline',
    ];

    const updates = {};
    for (const key of allowedUpdates) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    // Validate revised dates if changed
    const targetStart = updates.startAt ? new Date(updates.startAt) : event.startAt;
    const targetEnd = updates.endAt ? new Date(updates.endAt) : event.endAt;
    const targetDeadline = updates.registrationDeadline ? new Date(updates.registrationDeadline) : event.registrationDeadline;

    if (targetEnd <= targetStart) {
      return res.status(400).json({
        success: false,
        message: 'End date/time must be strictly after the start date/time.',
      });
    }

    if (targetDeadline > targetStart) {
      return res.status(400).json({
        success: false,
        message: 'Registration deadline cannot be after the event start time.',
      });
    }

    Object.assign(event, updates);
    await event.save();

    return res.status(200).json({
      success: true,
      message: 'Event updated successfully.',
      event,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    return next(error);
  }
};

// POST /api/events/:eventId/publish - Publish event (Owner only)
export const publishEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    // Ownership check
    if (!event.organizerId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to publish this event.',
      });
    }

    if (event.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot publish a cancelled event.',
      });
    }

    event.status = 'published';
    await event.save();

    return res.status(200).json({
      success: true,
      message: 'Event published successfully and is now discoverable.',
      event,
    });
  } catch (error) {
    return next(error);
  }
};

// POST /api/events/:eventId/cancel - Cancel event (Owner only)
export const cancelEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    // Ownership check
    if (!event.organizerId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are not authorized to cancel this event.',
      });
    }

    event.status = 'cancelled';
    await event.save();

    return res.status(200).json({
      success: true,
      message: 'Event has been cancelled.',
      event,
    });
  } catch (error) {
    return next(error);
  }
};
