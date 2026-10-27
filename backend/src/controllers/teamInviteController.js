import TeamInvite from '../models/TeamInvite.js';
import Registration from '../models/Registration.js';
import Event from '../models/Event.js';
import User from '../models/User.js';
import { generateTicketCode } from '../utils/ticketGenerator.js';

const fail = (res, status, message) => res.status(status).json({ success: false, message });

// POST /api/events/:eventId/invites (Captain invites a player)
export const invitePlayerToTeam = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || !email.trim()) {
      return fail(res, 400, 'Player email is required.');
    }
    const cleanEmail = email.trim().toLowerCase();

    const event = await Event.findById(req.params.eventId);
    if (!event || event.status !== 'published') {
      return fail(res, 404, 'Event not found or not published.');
    }

    // Verify requesting user is captain of a confirmed team registration
    const captainReg = await Registration.findOne({
      eventId: event._id,
      participantId: req.user._id,
      status: 'confirmed',
      isCaptain: true,
    });
    if (!captainReg) {
      return fail(res, 403, 'Only the team captain who registered the team can invite squad members.');
    }

    // Check if target user exists
    const targetUser = await User.findOne({ email: cleanEmail });
    if (!targetUser) {
      return fail(res, 404, `No participant found with email "${cleanEmail}". Make sure they have an account.`);
    }

    if (targetUser.role === 'organizer') {
      return fail(res, 400, `"${cleanEmail}" is an event organizer and cannot be invited as a team player.`);
    }

    if (targetUser._id.equals(req.user._id)) {
      return fail(res, 400, 'You are already the captain of this team.');
    }

    // Check if target user is already registered for this event
    const existingReg = await Registration.findOne({
      eventId: event._id,
      participantId: targetUser._id,
      status: 'confirmed',
    });
    if (existingReg) {
      return fail(res, 400, `User "${cleanEmail}" is already registered for this event in team "${existingReg.teamName}".`);
    }

    // Check existing invite
    let invite = await TeamInvite.findOne({ eventId: event._id, invitedUserId: targetUser._id });
    if (invite) {
      if (invite.status === 'pending') {
        return fail(res, 400, `An invitation has already been sent to "${cleanEmail}".`);
      }
      if (invite.status === 'accepted') {
        return fail(res, 400, `"${cleanEmail}" has already accepted and joined the squad.`);
      }
      // If declined earlier, re-open invite
      invite.status = 'pending';
      invite.teamName = captainReg.teamName;
      invite.captainId = req.user._id;
      invite.captainName = req.user.name;
      invite.respondedAt = null;
      await invite.save();
      return res.status(200).json({ success: true, message: `Invitation re-sent to ${cleanEmail}!`, invite });
    }

    invite = await TeamInvite.create({
      eventId: event._id,
      registrationId: captainReg._id,
      teamName: captainReg.teamName,
      captainId: req.user._id,
      captainName: req.user.name,
      invitedUserId: targetUser._id,
      invitedEmail: targetUser.email,
      invitedName: targetUser.name,
      role: 'player',
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      message: `Squad invitation sent to ${targetUser.name} (${cleanEmail})!`,
      invite,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/me/invites (Participant gets their pending invitations)
export const getMyPendingInvites = async (req, res, next) => {
  try {
    const invites = await TeamInvite.find({
      invitedUserId: req.user._id,
      status: 'pending',
    })
      .populate('eventId', 'title category startAt endAt venue mode status')
      .populate('captainId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: invites.length, invites });
  } catch (error) {
    next(error);
  }
};

// POST /api/invites/:inviteId/accept (Participant accepts squad invitation)
export const acceptTeamInvite = async (req, res, next) => {
  try {
    if (req.user?.role === 'organizer') {
      return fail(res, 403, 'Organizers and staff members are not eligible to register or participate in events.');
    }

    const invite = await TeamInvite.findOne({
      _id: req.params.inviteId,
      invitedUserId: req.user._id,
      status: 'pending',
    });
    if (!invite) {
      return fail(res, 404, 'Invitation not found or already processed.');
    }

    const event = await Event.findById(invite.eventId);
    if (!event || event.status !== 'published') {
      return fail(res, 400, 'Event is no longer open.');
    }

    const now = new Date();
    // Check registration deadline first
    if (now > new Date(event.registrationDeadline)) {
      invite.status = 'declined';
      invite.respondedAt = now;
      await invite.save();
      return fail(res, 400, 'Registration and team formation deadline has passed. Invitations can no longer be accepted.');
    }

    // If the event/tournament has already started or concluded
    if (now >= new Date(event.startAt)) {
      invite.status = 'declined';
      invite.respondedAt = now;
      await invite.save();
      return fail(res, 400, 'Registration is closed. This event has already begun or concluded.');
    }

    // Check if already registered
    const existing = await Registration.findOne({
      eventId: event._id,
      participantId: req.user._id,
      status: 'confirmed',
    });
    if (existing) {
      invite.status = 'accepted';
      invite.respondedAt = now;
      await invite.save();
      return fail(res, 400, 'You are already registered for this event.');
    }

    // Squad limit check
    const captainRegId = invite.registrationId;
    const currentSquadCount = await Registration.countDocuments({
      eventId: event._id,
      status: 'confirmed',
      $or: [{ _id: captainRegId }, { captainRegistrationId: captainRegId }],
    });

    const isHackathon = event.category === 'hackathon';
    const MAX_SQUAD_LIMIT = isHackathon
      ? (event.hackathonConfig?.teamSize || event.hackathonConfig?.requiredMembers || 4)
      : (event.category === 'sports' && event.sportsData?.sportType === 'cricket' ? 15 : 15);

    if (currentSquadCount >= MAX_SQUAD_LIMIT) {
      // Squad is full, decline invite and clear from pending
      invite.status = 'declined';
      invite.respondedAt = now;
      await invite.save();
      return fail(res, 400, `Team squad is full! All ${MAX_SQUAD_LIMIT} member slots have been filled.`);
    }

    // Create participant registration linked to team
    const registration = await Registration.create({
      eventId: event._id,
      participantId: req.user._id,
      ticketCode: generateTicketCode(event.category),
      registeredAt: now,
      teamName: invite.teamName,
      isCaptain: false,
      roleInTeam: 'player',
      captainRegistrationId: invite.registrationId,
    });

    // Update squadSize on the captain's registration
    await Registration.findByIdAndUpdate(captainRegId, {
      $set: { squadSize: currentSquadCount + 1 }
    });

    invite.status = 'accepted';
    invite.respondedAt = now;
    await invite.save();

    res.status(200).json({
      success: true,
      message: `Successfully joined ${invite.teamName}! Your match ticket is ready.`,
      registration,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/invites/:inviteId/decline (Participant declines squad invitation)
export const declineTeamInvite = async (req, res, next) => {
  try {
    const invite = await TeamInvite.findOne({
      _id: req.params.inviteId,
      invitedUserId: req.user._id,
      status: 'pending',
    });
    if (!invite) {
      return fail(res, 404, 'Invitation not found or already processed.');
    }

    invite.status = 'declined';
    invite.respondedAt = new Date();
    await invite.save();

    res.status(200).json({ success: true, message: 'Squad invitation declined.' });
  } catch (error) {
    next(error);
  }
};

// GET /api/events/:eventId/squad (Get squad status for this event & team)
export const getEventSquad = async (req, res, next) => {
  try {
    const event = await Event.findById(req.params.eventId);
    if (!event) return fail(res, 404, 'Event not found.');

    // Find any registration of the current user for this event
    const userReg = await Registration.findOne({
      eventId: event._id,
      participantId: req.user._id,
      status: 'confirmed',
    });

    if (!userReg) {
      return res.status(200).json({ success: true, isMember: false, squad: [] });
    }

    // Find captain registration ID
    const captainRegId = userReg.isCaptain ? userReg._id : userReg.captainRegistrationId;
    const captainReg = captainRegId
      ? await Registration.findById(captainRegId).populate('participantId', 'name email')
      : userReg;

    // Find all players confirmed in this team
    const confirmedPlayers = await Registration.find({
      eventId: event._id,
      status: 'confirmed',
      $or: [{ _id: captainReg._id }, { captainRegistrationId: captainReg._id }],
    }).populate('participantId', 'name email');

    // Find all invites for this team
    const teamInvites = await TeamInvite.find({
      eventId: event._id,
      registrationId: captainReg._id,
    }).populate('invitedUserId', 'name email');

    // Find suggestion list of participants to invite
    const suggestedUsers = await User.find({
      role: 'participant',
      _id: { $ne: req.user._id },
    })
      .select('name email')
      .limit(20)
      .lean();

    const isHackathon = event.category === 'hackathon';
    const requiredMembers = isHackathon ? (event.hackathonConfig?.requiredMembers || 4) : 11;
    const maxTeamSize = isHackathon ? (event.hackathonConfig?.teamSize || event.hackathonConfig?.requiredMembers || 4) : 15;
    const deadlinePassed = new Date() > new Date(event.registrationDeadline);
    const isQualified = confirmedPlayers.length >= requiredMembers;
    const isDisqualified = deadlinePassed && !isQualified;

    res.status(200).json({
      success: true,
      isMember: true,
      isCaptain: userReg.isCaptain,
      teamName: userReg.teamName,
      requiredMembers,
      maxTeamSize,
      isQualified,
      isDisqualified,
      deadlinePassed,
      captain: {
        id: captainReg.participantId?._id,
        name: captainReg.participantId?.name,
        email: captainReg.participantId?.email,
        ticketCode: captainReg.ticketCode,
      },
      confirmedPlayers: confirmedPlayers.map((cp) => ({
        id: cp.participantId?._id,
        name: cp.participantId?.name,
        email: cp.participantId?.email,
        ticketCode: cp.ticketCode,
        isCaptain: cp.isCaptain,
        role: cp.roleInTeam,
      })),
      invites: teamInvites.map((ti) => ({
        id: ti._id,
        userId: ti.invitedUserId?._id,
        name: ti.invitedUserId?.name || ti.invitedName,
        email: ti.invitedEmail,
        status: ti.status,
        createdAt: ti.createdAt,
      })),
      suggestedUsers,
    });
  } catch (error) {
    next(error);
  }
};
