import User from '../models/User.js';

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
const fail = (res, status, message) => res.status(status).json({ success: false, message });

export const isLeadOrganizer = (user) => {
  if (!user || user.role !== 'organizer') return false;
  const leadEmail = (process.env.PRIMARY_ORGANIZER_EMAIL || 'organiser1@gmail.com').toLowerCase().trim();
  return user.email.toLowerCase().trim() === leadEmail;
};

// GET /api/team - List all organizers
export const listOrganizers = async (req, res, next) => {
  try {
    const organizers = await User.find({ role: 'organizer' })
      .select('name email role status createdAt updatedAt')
      .sort({ createdAt: 1 });

    const leadEmail = (process.env.PRIMARY_ORGANIZER_EMAIL || 'organiser1@gmail.com').toLowerCase().trim();

    return res.status(200).json({
      success: true,
      organizers: organizers.map((org) => ({
        ...org.toObject(),
        isLead: org.email.toLowerCase() === leadEmail,
      })),
      currentUserId: req.user._id,
      isPrimaryOrganizer: isLeadOrganizer(req.user),
      leadOrganizerEmail: leadEmail,
    });
  } catch (error) {
    return next(error);
  }
};

// POST /api/team - Create a new organizer account (Lead Organizer only)
export const createOrganizer = async (req, res, next) => {
  try {
    if (!isLeadOrganizer(req.user)) {
      return fail(res, 403, 'Permission denied. Only the lead organizer (organiser1@gmail.com) can add new co-organizers.');
    }

    const { name, email, password } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return fail(res, 400, 'Organizer name must be at least 2 characters.');
    }
    if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
      return fail(res, 400, 'Please enter a valid email address.');
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return fail(res, 400, 'Password must be at least 6 characters long.');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return fail(res, 409, 'An account with this email address already exists.');
    }

    const passwordHash = await User.hashPassword(password);
    const newOrganizer = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'organizer',
      status: 'active',
      emailVerified: true,
    });

    return res.status(201).json({
      success: true,
      message: `Organizer account created for ${newOrganizer.email}`,
      organizer: {
        _id: newOrganizer._id,
        name: newOrganizer.name,
        email: newOrganizer.email,
        role: newOrganizer.role,
        status: newOrganizer.status,
        createdAt: newOrganizer.createdAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// PATCH /api/team/:id/status - Toggle active/suspended (Lead Organizer only)
export const toggleOrganizerStatus = async (req, res, next) => {
  try {
    if (!isLeadOrganizer(req.user)) {
      return fail(res, 403, 'Permission denied. Only the lead organizer (organiser1@gmail.com) can pause or resume organizer accounts.');
    }

    const { id } = req.params;
    if (req.user._id.toString() === id) {
      return fail(res, 400, 'You cannot pause or suspend your own organizer account.');
    }

    const targetUser = await User.findOne({ _id: id, role: 'organizer' });
    if (!targetUser) {
      return fail(res, 404, 'Organizer not found.');
    }

    if (isLeadOrganizer(targetUser)) {
      return fail(res, 400, 'The lead organizer account cannot be paused or suspended.');
    }

    const nextStatus = targetUser.status === 'suspended' ? 'active' : 'suspended';
    targetUser.status = nextStatus;

    // Invalidate sessions immediately if suspended
    if (nextStatus === 'suspended') {
      targetUser.authTokenVersion = (targetUser.authTokenVersion || 0) + 1;
    }

    await targetUser.save();

    return res.status(200).json({
      success: true,
      message: `Organizer ${targetUser.name} is now ${nextStatus === 'suspended' ? 'suspended (access paused)' : 'active'}.`,
      organizer: {
        _id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        status: targetUser.status,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/team/:id - Revoke and terminate organizer access (Lead Organizer only)
export const deleteOrganizer = async (req, res, next) => {
  try {
    if (!isLeadOrganizer(req.user)) {
      return fail(res, 403, 'Permission denied. Only the lead organizer (organiser1@gmail.com) can terminate organizer accounts.');
    }

    const { id } = req.params;
    if (req.user._id.toString() === id) {
      return fail(res, 400, 'You cannot terminate your own organizer account.');
    }

    const targetUser = await User.findOne({ _id: id, role: 'organizer' });
    if (!targetUser) {
      return fail(res, 404, 'Organizer not found.');
    }

    if (isLeadOrganizer(targetUser)) {
      return fail(res, 400, 'The lead organizer account cannot be terminated or removed.');
    }

    await User.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: `Organizer ${targetUser.name} (${targetUser.email}) access revoked and removed.`,
    });
  } catch (error) {
    return next(error);
  }
};
