import User from '../models/User.js';
import { sendTokenResponse, clearTokenCookie } from '../utils/token.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isStr = (v) => typeof v === 'string';

// Public signup: ALWAYS creates a participant. Any role in the body is ignored.
export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};

    if (!isStr(name) || !isStr(email) || !isStr(password) || !name.trim() || !email.trim() || !password) {
      return res.status(400).json({ success: false, message: 'Name, email and password are required.' });
    }
    if (name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({ success: false, message: 'Name must be 2–100 characters.' });
    }
    if (!EMAIL_RE.test(email.trim())) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }
    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({ success: false, message: 'Password must be 8–72 characters.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (await User.findOne({ email: normalizedEmail })) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash: await User.hashPassword(password),
      role: 'participant',
    });
    return sendTokenResponse(res, 201, user, 'Account created.');
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }
    return next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!isStr(email) || !isStr(password) || !email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }
    return sendTokenResponse(res, 200, user, 'Logged in.');
  } catch (error) {
    return next(error);
  }
};

export const logout = (req, res) => {
  clearTokenCookie(res);
  res.status(200).json({ success: true, message: 'Logged out.' });
};

export const getMe = (req, res) => res.status(200).json({ success: true, user: req.user.toJSON() });
