import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const loadUser = async (req) => {
  const token = req.cookies?.token;
  if (!token) return null;
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  return User.findById(decoded.id);
};

export const authenticate = async (req, res, next) => {
  try {
    const user = await loadUser(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Please log in to continue.' });
    }
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Session expired. Please log in again.' });
    }
    next(error);
  }
};

// Attaches req.user when a valid session exists; otherwise continues anonymously.
export const optionalAuthenticate = async (req, res, next) => {
  try {
    req.user = (await loadUser(req)) || undefined;
  } catch {
    req.user = undefined;
  }
  next();
};

export const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Authentication required.' });
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'You do not have permission to do this.' });
  }
  next();
};
