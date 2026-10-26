import jwt from 'jsonwebtoken';

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

const cookieBase = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' };
};

export const sendTokenResponse = (res, statusCode, user, message) => {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { ...cookieBase(), maxAge: COOKIE_MAX_AGE_MS });
  // Token is only delivered via the httpOnly cookie, never in the body.
  return res.status(statusCode).json({ success: true, message, user: user.toJSON() });
};

export const clearTokenCookie = (res) => res.clearCookie('token', cookieBase());
