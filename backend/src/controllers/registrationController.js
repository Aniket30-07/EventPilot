import Registration from '../models/Registration.js';
import Event from '../models/Event.js';
import { generateTicketCode } from '../utils/ticketGenerator.js';
import { getEventMetrics, shapeMetrics } from '../utils/metrics.js';

const fail = (res, status, message) => res.status(status).json({ success: false, message });

// POST /api/events/:eventId/register (participants only)
export const registerForEvent = async (req, res, next) => {
  try {
    if (req.user?.role === 'organizer') {
      return fail(res, 403, 'Organizers and staff members are not eligible to register or participate in events.');
    }

    const event = await Event.findById(req.params.eventId);
    if (!event || event.status !== 'published') return fail(res, 404, 'Event not found or not open for registration.');

    const now = new Date();
    if (now > event.registrationDeadline) return fail(res, 400, 'Registration is closed. The deadline has passed.');
    if (now > event.endAt) return fail(res, 400, 'This event has already ended.');

    const existing = await Registration.findOne({ eventId: event._id, participantId: req.user._id });
    if (existing?.status === 'confirmed') return fail(res, 409, 'You are already registered for this event.');
    if (existing?.status === 'cancelled') {
      return fail(res, 400, 'You cancelled your registration earlier. Re-registering is not allowed.');
    }

    if ((await Registration.countDocuments({ eventId: event._id, status: 'confirmed', roleInTeam: { $ne: 'player' } })) >= event.capacity) {
      return fail(res, 400, 'This event is full. No seats available.');
    }

    const { teamName, squadSize, playerNotes } = req.body || {};
    const isTeamHackathon = event.category === 'hackathon' && event.hackathonConfig?.teamMode !== 'solo';
    const isTeamSport = event.category === 'sports' && Boolean((teamName || '').trim());
    const isTeamEvent = isTeamSport || (isTeamHackathon && Boolean((teamName || '').trim()));

    if (isTeamHackathon && (!teamName || !teamName.trim())) {
      return fail(res, 400, 'Team name is required to register a team for this hackathon.');
    }

    if (teamName && teamName.trim()) {
      const duplicateTeam = await Registration.findOne({
        eventId: event._id,
        status: 'confirmed',
        teamName: { $regex: new RegExp(`^${teamName.trim()}$`, 'i') },
      });
      if (duplicateTeam) {
        return fail(res, 400, `Team name "${teamName.trim()}" is already registered. Please choose another name.`);
      }
    }

    let registration;
    for (let attempt = 0; attempt < 3 && !registration; attempt++) {
      try {
        registration = await Registration.create({
          eventId: event._id,
          participantId: req.user._id,
          ticketCode: generateTicketCode(event.category),
          registeredAt: now,
          teamName: (teamName || '').trim(),
          squadSize: Number(squadSize) || (isTeamHackathon ? (event.hackathonConfig?.teamSize || event.hackathonConfig?.requiredMembers || 4) : 1),
          playerNotes: (playerNotes || '').trim(),
          isCaptain: isTeamEvent,
          roleInTeam: isTeamEvent ? 'captain' : 'solo',
        });
      } catch (err) {
        // Retry only if the random ticket code collided; any other duplicate is handled below.
        if (!(err.code === 11000 && err.keyPattern?.ticketCode)) throw err;
      }
    }
    if (!registration) return fail(res, 500, 'Could not generate a ticket. Please try again.');

    // Concurrency guard (works without transactions): if more confirmed team registrations than capacity
    // exist at or before this one, this request lost the race, so roll it back.
    const position = await Registration.countDocuments({
      eventId: event._id, status: 'confirmed', roleInTeam: { $ne: 'player' }, _id: { $lte: registration._id },
    });
    if (position > event.capacity) {
      await Registration.deleteOne({ _id: registration._id });
      return fail(res, 400, 'This event is full. No seats available.');
    }

    res.status(201).json({ success: true, message: 'Registration confirmed!', registration });
  } catch (error) {
    if (error.code === 11000) return fail(res, 409, 'You are already registered for this event.');
    next(error);
  }
};

// POST /api/registrations/:registrationId/cancel (participants, own registration only)
export const cancelRegistration = async (req, res, next) => {
  try {
    const registration = await Registration.findById(req.params.registrationId).populate('eventId', 'startAt');
    if (!registration || !registration.participantId.equals(req.user._id)) {
      return fail(res, 404, 'Registration not found.');
    }
    if (registration.status === 'cancelled') return fail(res, 400, 'This registration is already cancelled.');
    if (registration.checkedInAt) return fail(res, 400, 'You are already checked in and cannot cancel.');
    if (new Date() >= registration.eventId.startAt) return fail(res, 400, 'The event has started; registrations can no longer be cancelled.');

    // Atomic state change: only one concurrent cancel can succeed.
    const updated = await Registration.findOneAndUpdate(
      { _id: registration._id, status: 'confirmed', checkedInAt: null },
      { status: 'cancelled', cancelledAt: new Date() },
      { new: true }
    );
    if (!updated) return fail(res, 400, 'This registration can no longer be cancelled.');

    res.status(200).json({ success: true, message: 'Registration cancelled. Your seat has been released.', registration: updated });
  } catch (error) {
    next(error);
  }
};

// GET /api/me/registrations (participants, own only)
export const getMyRegistrations = async (req, res, next) => {
  try {
    const regs = await Registration.find({ participantId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('eventId', 'title category startAt endAt mode venue onlineLink status')
      .lean();

    // Meeting link only for active registrations
    const registrations = regs
      .filter((r) => r.eventId)
      .map((r) => {
        if (r.status !== 'confirmed') delete r.eventId.onlineLink;
        return r;
      });
    res.status(200).json({ success: true, count: registrations.length, registrations });
  } catch (error) {
    next(error);
  }
};

const loadOwnedEvent = async (req, res) => {
  const event = await Event.findById(req.params.eventId);
  if (!event) { fail(res, 404, 'Event not found.'); return null; }
  if (!event.organizerId.equals(req.user._id)) { fail(res, 403, 'You do not own this event.'); return null; }
  return event;
};

// GET /api/events/:eventId/attendees (owner only)
export const getEventAttendees = async (req, res, next) => {
  try {
    const event = await loadOwnedEvent(req, res);
    if (!event) return;

    const attendees = await Registration.find({ eventId: event._id })
      .populate('participantId', 'name email')
      .sort({ createdAt: -1 });
    const metrics = shapeMetrics((await getEventMetrics([event._id])).get(event._id.toString()), event.capacity);

    res.status(200).json({
      success: true,
      event: { _id: event._id, title: event.title, status: event.status, startAt: event.startAt, endAt: event.endAt },
      metrics,
      attendees,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/events/:eventId/registrations/:registrationId/check-in (owner only, idempotent)
export const checkInAttendee = async (req, res, next) => {
  try {
    const event = await loadOwnedEvent(req, res);
    if (!event) return;
    if (event.status !== 'published') return fail(res, 400, `Check-in is only available for published events (this one is ${event.status}).`);

    const { registrationId } = req.params;

    // Atomic: only a confirmed, not-yet-checked-in registration of THIS event can be updated.
    const updated = await Registration.findOneAndUpdate(
      { _id: registrationId, eventId: event._id, status: 'confirmed', checkedInAt: null },
      { checkedInAt: new Date() },
      { new: true }
    ).populate('participantId', 'name email');
    if (updated) return res.status(200).json({ success: true, message: 'Attendee checked in.', registration: updated });

    const reg = await Registration.findById(registrationId).populate('participantId', 'name email');
    if (!reg) return fail(res, 404, 'Registration not found.');
    if (!reg.eventId.equals(event._id)) return fail(res, 400, 'This registration does not belong to this event.');
    if (reg.status === 'cancelled') return fail(res, 400, 'Cannot check in a cancelled registration.');
    // Already checked in: report it without changing the timestamp or the count.
    return res.status(200).json({ success: true, alreadyCheckedIn: true, message: 'Attendee was already checked in.', registration: reg });
  } catch (error) {
    next(error);
  }
};

// GET /api/events/:eventId/analytics (owner only)
export const getEventAnalytics = async (req, res, next) => {
  try {
    const event = await loadOwnedEvent(req, res);
    if (!event) return;
    const metrics = shapeMetrics((await getEventMetrics([event._id])).get(event._id.toString()), event.capacity);
    res.status(200).json({ success: true, event: { _id: event._id, title: event.title, status: event.status }, metrics });
  } catch (error) {
    next(error);
  }
};
