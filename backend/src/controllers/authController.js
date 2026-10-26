import User from '../models/User.js';
import { sendTokenResponse, clearTokenCookie } from '../utils/token.js';

// Public participant registration
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and password are required fields.',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if email already registered
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    const passwordHash = await User.hashPassword(password);

    // SECURITY: Disregard any client-supplied role. Public registrations are always participant.
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: 'participant',
    });

    return sendTokenResponse(res, 201, user, 'Account registered successfully.');
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

// Login user
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    return sendTokenResponse(res, 200, user, 'Logged in successfully.');
  } catch (error) {
    return next(error);
  }
};

// Logout user
export const logout = async (req, res) => {
  clearTokenCookie(res);
  return res.status(200).json({
    success: true,
    message: 'Logged out successfully.',
  });
};

// Get current authenticated user
export const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user.toJSON(),
  });
};

// Controlled organizer seed endpoint (for development / testing)
export const seedOrganizer = async (req, res, next) => {
  try {
    if (
      process.env.NODE_ENV === 'production' ||
      process.env.NODE_ENV === 'staging' ||
      (process.env.NODE_ENV && process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test')
    ) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Organizer seeding is disabled in production mode.',
      });
    }

    const defaultEmail = (process.env.DEFAULT_ORGANIZER_EMAIL || 'organizer@eventpilot.dev').toLowerCase().trim();
    const defaultPassword = process.env.DEFAULT_ORGANIZER_PASSWORD || 'OrganizerPass123!';
    const defaultName = process.env.DEFAULT_ORGANIZER_NAME || 'Demo Organizer';

    let user = await User.findOne({ email: defaultEmail });

    const passwordHash = await User.hashPassword(defaultPassword);

    if (user) {
      user.name = defaultName;
      user.role = 'organizer';
      user.passwordHash = passwordHash;
      await user.save();
    } else {
      user = await User.create({
        name: defaultName,
        email: defaultEmail,
        passwordHash,
        role: 'organizer',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Organizer account seeded successfully.',
      credentials: {
        name: user.name,
        email: user.email,
        password: defaultPassword,
        role: user.role,
      },
    });
  } catch (error) {
    return next(error);
  }
};
