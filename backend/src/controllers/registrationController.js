import mongoose from 'mongoose';
import Registration from '../models/Registration.js';
import Event from '../models/Event.js';
import { generateTicketCode } from '../utils/ticketGenerator.js';

// POST /api/events/:eventId/register - Register participant for an event
export const registerForEvent = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    // Rule 1: Event must be published
    if (event.status !== 'published') {
      return res.status(400).json({
        success: false,
        message: `Cannot register for an event with status '${event.status}'. Event must be published.`,
      });
    }

    const now = new Date();

    // Rule 2: Registration deadline check
    if (now > event.registrationDeadline) {
      return res.status(400).json({
        success: false,
        message: 'Registration is closed. The registration deadline has passed.',
      });
    }

    // Rule 3: Event has not ended
    if (now > event.endAt) {
      return res.status(400).json({
        success: false,
        message: 'This event has already ended.',
      });
    }

    // Rule 4: Check if already registered
    const existingRegistration = await Registration.findOne({
      eventId,
      participantId: req.user._id,
    });

    if (existingRegistration) {
      if (existingRegistration.status === 'confirmed') {
        return res.status(409).json({
          success: false,
          message: 'You are already registered for this event.',
          registration: existingRegistration,
        });
      }
      if (existingRegistration.status === 'cancelled') {
        return res.status(400).json({
          success: false,
          message: 'You previously cancelled your registration for this event. Re-registration is not permitted in this version.',
          registration: existingRegistration,
        });
      }
    }

    // Rule 5: Server-side capacity enforcement
    const confirmedCount = await Registration.countDocuments({
      eventId,
      status: 'confirmed',
    });

    if (confirmedCount >= event.capacity) {
      return res.status(400).json({
        success: false,
        message: 'Event is at full capacity. No remaining seats are available.',
      });
    }

    // Rule 6: Generate human-readable ticket code & create record
    let ticketCode = generateTicketCode(event.category);
    let attempts = 0;
    while (attempts < 3) {
      const codeExists = await Registration.exists({ ticketCode });
      if (!codeExists) break;
      ticketCode = generateTicketCode(event.category);
      attempts++;
    }

    const registration = await Registration.create({
      eventId,
      participantId: req.user._id,
      status: 'confirmed',
      ticketCode,
      registeredAt: now,
    });

    return res.status(201).json({
      success: true,
      message: 'Registration confirmed successfully!',
      registration,
    });
  } catch (error) {
    // Handle MongoDB compound unique index violation gracefully
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Duplicate registration: You have already submitted a registration for this event.',
      });
    }
    return next(error);
  }
};

// POST /api/registrations/:registrationId/cancel - Participant cancels own registration
export const cancelRegistration = async (req, res, next) => {
  try {
    const { registrationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(registrationId)) {
      return res.status(400).json({ success: false, message: 'Invalid registration ID.' });
    }

    const registration = await Registration.findById(registrationId);
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration record not found.' });
    }

    // Rule: Participant can only cancel their own registration
    if (!registration.participantId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You are only authorized to cancel your own registration.',
      });
    }

    // Rule: Cancellation idempotency / duplicate rejection
    if (registration.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'This registration is already cancelled.',
      });
    }

    registration.status = 'cancelled';
    registration.cancelledAt = new Date();
    await registration.save();

    return res.status(200).json({
      success: true,
      message: 'Registration successfully cancelled. Your seat has been released.',
      registration,
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/me/registrations - Retrieve current participant's registrations
export const getMyRegistrations = async (req, res, next) => {
  try {
    const registrations = await Registration.find({ participantId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('eventId', 'title description category startAt endAt mode venue onlineLink capacity registrationDeadline status');

    return res.status(200).json({
      success: true,
      count: registrations.length,
      registrations,
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/events/:eventId/my-registration - Check participant's status for a specific event
export const getEventRegistrationStatus = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID.' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const confirmedCount = await Registration.countDocuments({
      eventId,
      status: 'confirmed',
    });

    const userRegistration = req.user
      ? await Registration.findOne({ eventId, participantId: req.user._id })
      : null;

    return res.status(200).json({
      success: true,
      confirmedCount,
      capacity: event.capacity,
      remainingSeats: Math.max(0, event.capacity - confirmedCount),
      userRegistration,
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/events/:eventId/attendees - Owner-only attendee list with registration & check-in status
export const getEventAttendees = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID format.' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    // Owner-only authorization check
    if (!event.organizerId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not own this event.',
      });
    }

    const attendees = await Registration.find({ eventId })
      .populate('participantId', 'name email')
      .sort({ createdAt: -1 });

    const totalCount = attendees.length;
    const confirmedCount = attendees.filter((a) => a.status === 'confirmed').length;
    const checkedInCount = attendees.filter((a) => a.status === 'confirmed' && a.checkedInAt).length;
    const cancelledCount = attendees.filter((a) => a.status === 'cancelled').length;
    const checkInRate = confirmedCount > 0 ? Number(((checkedInCount / confirmedCount) * 100).toFixed(1)) : 0;
    const remainingSeats = Math.max(0, event.capacity - confirmedCount);

    return res.status(200).json({
      success: true,
      event: {
        _id: event._id,
        title: event.title,
        category: event.category,
        status: event.status,
        capacity: event.capacity,
        startAt: event.startAt,
        endAt: event.endAt,
      },
      metrics: {
        totalCount,
        confirmedCount,
        checkedInCount,
        cancelledCount,
        checkInRate,
        remainingSeats,
      },
      attendees,
    });
  } catch (error) {
    return next(error);
  }
};

// POST /api/events/:eventId/registrations/:registrationId/check-in - Manual check-in for confirmed registration
export const checkInAttendee = async (req, res, next) => {
  try {
    const { eventId, registrationId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId) || !mongoose.Types.ObjectId.isValid(registrationId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID or registration ID format.' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    // Owner-only check
    if (!event.organizerId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not own this event.',
      });
    }

    const registration = await Registration.findById(registrationId).populate('participantId', 'name email');
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found.' });
    }

    // Validate registration belongs to this event
    if (!registration.eventId.equals(event._id)) {
      return res.status(400).json({
        success: false,
        message: 'Registration does not belong to this event.',
      });
    }

    // Validate registration is confirmed
    if (registration.status === 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Cannot check in a cancelled registration.',
      });
    }

    // Repeated check-in safety: reject duplicate without double-counting or altering timestamp
    if (registration.checkedInAt) {
      return res.status(400).json({
        success: false,
        alreadyCheckedIn: true,
        message: `Attendee is already checked in (Checked in on ${new Date(registration.checkedInAt).toLocaleString()}).`,
        registration,
      });
    }

    // Check in attendee
    registration.checkedInAt = new Date();
    await registration.save();

    return res.status(200).json({
      success: true,
      message: 'Attendee checked in successfully.',
      registration,
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/events/:eventId/analytics - Single event registration & check-in metrics
export const getEventAnalytics = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ success: false, message: 'Invalid event ID format.' });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    if (!event.organizerId.equals(req.user._id)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not own this event.',
      });
    }

    const registrations = await Registration.find({ eventId }).lean();
    const confirmedCount = registrations.filter((r) => r.status === 'confirmed').length;
    const checkedInCount = registrations.filter((r) => r.status === 'confirmed' && r.checkedInAt).length;
    const cancelledCount = registrations.filter((r) => r.status === 'cancelled').length;
    const checkInRate = confirmedCount > 0 ? Number(((checkedInCount / confirmedCount) * 100).toFixed(1)) : 0;
    const remainingSeats = Math.max(0, event.capacity - confirmedCount);

    return res.status(200).json({
      success: true,
      event: {
        _id: event._id,
        title: event.title,
        category: event.category,
        status: event.status,
        capacity: event.capacity,
      },
      metrics: {
        capacity: event.capacity,
        totalRegistrations: registrations.length,
        confirmedCount,
        checkedInCount,
        cancelledCount,
        checkInRate,
        remainingSeats,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/events/mine/analytics - Aggregated portfolio metrics across all owned events
export const getOrganizerAnalytics = async (req, res, next) => {
  try {
    const events = await Event.find({ organizerId: req.user._id }).lean();
    const eventIds = events.map((e) => e._id);

    const registrations = await Registration.find({ eventId: { $in: eventIds } }).lean();

    const totalEvents = events.length;
    const publishedEvents = events.filter((e) => e.status === 'published').length;
    const totalCapacity = events
      .filter((e) => e.status === 'published')
      .reduce((sum, e) => sum + (e.capacity || 0), 0);

    const totalRegistrations = registrations.length;
    const confirmedRegistrations = registrations.filter((r) => r.status === 'confirmed').length;
    const cancelledRegistrations = registrations.filter((r) => r.status === 'cancelled').length;
    const checkedInAttendees = registrations.filter((r) => r.status === 'confirmed' && r.checkedInAt).length;

    const overallCheckInRate =
      confirmedRegistrations > 0
        ? Number(((checkedInAttendees / confirmedRegistrations) * 100).toFixed(1))
        : 0;

    // Per-event metrics mapping
    const eventBreakdowns = events.map((ev) => {
      const eventRegs = registrations.filter((r) => r.eventId.toString() === ev._id.toString());
      const confirmed = eventRegs.filter((r) => r.status === 'confirmed').length;
      const checkedIn = eventRegs.filter((r) => r.status === 'confirmed' && r.checkedInAt).length;
      const cancelled = eventRegs.filter((r) => r.status === 'cancelled').length;
      const rate = confirmed > 0 ? Number(((checkedIn / confirmed) * 100).toFixed(1)) : 0;
      const remaining = Math.max(0, ev.capacity - confirmed);

      return {
        _id: ev._id,
        title: ev.title,
        status: ev.status,
        category: ev.category,
        capacity: ev.capacity,
        startAt: ev.startAt,
        endAt: ev.endAt,
        confirmedCount: confirmed,
        checkedInCount: checkedIn,
        cancelledCount: cancelled,
        checkInRate: rate,
        remainingSeats: remaining,
      };
    });

    return res.status(200).json({
      success: true,
      summary: {
        totalEvents,
        publishedEvents,
        totalCapacity,
        totalRegistrations,
        confirmedRegistrations,
        cancelledRegistrations,
        checkedInAttendees,
        overallCheckInRate,
      },
      events: eventBreakdowns,
    });
  } catch (error) {
    return next(error);
  }
};
