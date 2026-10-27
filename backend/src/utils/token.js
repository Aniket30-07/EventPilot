import jwt from 'jsonwebtoken';

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MFA_CHALLENGE_MAX_AGE_MS = 5 * 60 * 1000;

const cookieBase = () => {
  const isProd = process.env.NODE_ENV === 'production';
  return { httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/' };
};

export const sendTokenResponse = (res, statusCode, user, message) => {
  const token = jwt.sign({ id: user._id, version: user.authTokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.clearCookie('mfa_challenge', cookieBase());
  res.cookie('token', token, { ...cookieBase(), maxAge: COOKIE_MAX_AGE_MS });
  // Token is only delivered via the httpOnly cookie, never in the body.
  return res.status(statusCode).json({ success: true, message, user: user.toJSON() });
};

export const sendMfaChallenge = (res, userId) => {
  const token = jwt.sign({ id: userId, purpose: 'mfa' }, process.env.JWT_SECRET, { expiresIn: '5m' });
  res.clearCookie('token', cookieBase());
  res.cookie('mfa_challenge', token, { ...cookieBase(), maxAge: MFA_CHALLENGE_MAX_AGE_MS });
};

export const verifyMfaChallenge = (token) => {
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  if (payload.purpose !== 'mfa') throw new jwt.JsonWebTokenError('Invalid MFA challenge.');
  return payload;
};

export const clearTokenCookie = (res) => {
  res.clearCookie('token', cookieBase());
  res.clearCookie('mfa_challenge', cookieBase());
};
