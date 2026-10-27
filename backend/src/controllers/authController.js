import User from '../models/User.js';
import { sendTokenResponse, clearTokenCookie } from '../utils/token.js';
import { isMailConfigured, sendPasswordResetEmail, sendVerificationEmail } from '../utils/mailer.js';
import { createOpaqueToken, hashOpaqueToken } from '../utils/totp.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isStr = (value) => typeof value === 'string';
const fail = (res, status, message, code) => res.status(status).json({ success: false, message, ...(code ? { code } : {}) });
const opaqueTokenExpiry = (hours) => new Date(Date.now() + hours * 60 * 60 * 1000);
const normalizedEmail = (email) => email.toLowerCase().trim();

const issueVerification = async (user) => {
  const token = createOpaqueToken();
  user.emailVerificationTokenHash = hashOpaqueToken(token);
  user.emailVerificationExpiresAt = opaqueTokenExpiry(24);
  await user.save();
  await sendVerificationEmail(user.email, token);
};

export const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body || {};
    if (!isStr(name) || !isStr(email) || !isStr(password) || !name.trim() || !email.trim() || !password) {
      return fail(res, 400, 'Name, email and password are required.');
    }
    if (name.trim().length < 2 || name.trim().length > 100) return fail(res, 400, 'Name must be 2–100 characters.');
    if (!EMAIL_RE.test(email.trim())) return fail(res, 400, 'Please enter a valid email address.');
    if (password.length < 8 || password.length > 72) return fail(res, 400, 'Password must be 8–72 characters.');

    const normalized = normalizedEmail(email);
    if (await User.findOne({ email: normalized })) return fail(res, 409, 'An account with this email already exists.');

    const user = await User.create({
      name: name.trim(),
      email: normalized,
      passwordHash: await User.hashPassword(password),
      role: 'participant',
      status: 'active',
      emailVerified: true,
    });

    return sendTokenResponse(res, 201, user, 'Account created successfully.');
  } catch (error) {
    if (error.code === 11000) return fail(res, 409, 'An account with this email already exists.');
    return next(error);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body || {};
    if (!isStr(token) || token.length !== 64) return fail(res, 400, 'Verification link is invalid or expired.');
    const user = await User.findOne({
      emailVerificationTokenHash: hashOpaqueToken(token),
      emailVerificationExpiresAt: { $gt: new Date() },
    }).select('+emailVerificationTokenHash +emailVerificationExpiresAt');
    if (!user) return fail(res, 400, 'Verification link is invalid or expired.');
    user.emailVerified = true;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpiresAt = null;
    await user.save();
    return res.status(200).json({ success: true, message: 'Email verified. You can now sign in.' });
  } catch (error) {
    return next(error);
  }
};

export const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!isStr(email) || !EMAIL_RE.test(email.trim())) return fail(res, 400, 'Enter a valid email address.');
    const user = await User.findOne({ email: normalizedEmail(email), emailVerified: false });
    if (user) {
      if (isMailConfigured()) {
        try {
          await issueVerification(user);
        } catch (error) {
          console.error('[Auth] Verification email delivery failed:', error.message);
          return fail(res, 503, 'Could not send verification email. Please try again later.', 'EMAIL_DELIVERY_FAILED');
        }
      } else {
        user.emailVerified = true;
        await user.save();
        return res.status(200).json({ success: true, message: 'Account verified successfully! You can now sign in.' });
      }
    }
    return res.status(200).json({ success: true, message: 'If the account needs verification, an email has been sent.' });
  } catch (error) {
    return next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!isStr(email) || !isStr(password) || !email || !password) return fail(res, 400, 'Email and password are required.');
    const user = await User.findOne({ email: normalizedEmail(email) });
    if (!user || !(await user.comparePassword(password))) return fail(res, 401, 'Invalid email or password.');
    if (user.status === 'suspended') {
      return fail(res, 403, 'Your organizer access has been suspended by the team admin. Please contact your administrator.');
    }
    if (!user.emailVerified) return fail(res, 403, 'Verify your email address before signing in.', 'EMAIL_NOT_VERIFIED');
    return sendTokenResponse(res, 200, user, 'Logged in.');
  } catch (error) {
    return next(error);
  }
};

export const requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!isStr(email) || !EMAIL_RE.test(email.trim())) return fail(res, 400, 'Enter a valid email address.');
    const user = await User.findOne({ email: normalizedEmail(email) });
    let resetUrl = null;
    if (user) {
      const token = createOpaqueToken();
      user.passwordResetTokenHash = hashOpaqueToken(token);
      user.passwordResetExpiresAt = opaqueTokenExpiry(1);
      await user.save();
      try {
        await sendPasswordResetEmail(user.email, token);
      } catch (error) {
        console.error('[Auth] Password reset email delivery failed:', error.message);
      }
      if (!isMailConfigured()) {
        resetUrl = `/reset-password?token=${encodeURIComponent(token)}`;
      }
    }
    return res.status(200).json({
      success: true,
      message: 'If an account exists for that address, a password reset email has been sent.',
      resetUrl,
    });
  } catch (error) {
    return next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body || {};
    if (!isStr(token) || token.length !== 64) return fail(res, 400, 'Reset link is invalid or expired.');
    if (!isStr(password) || password.length < 8 || password.length > 72) return fail(res, 400, 'Password must be 8–72 characters.');
    const user = await User.findOne({
      passwordResetTokenHash: hashOpaqueToken(token),
      passwordResetExpiresAt: { $gt: new Date() },
    }).select('+passwordResetTokenHash +passwordResetExpiresAt');
    if (!user) return fail(res, 400, 'Reset link is invalid or expired.');
    user.passwordHash = await User.hashPassword(password);
    user.authTokenVersion = (user.authTokenVersion || 0) + 1;
    user.passwordResetTokenHash = null;
    user.passwordResetExpiresAt = null;
    await user.save();
    clearTokenCookie(res);
    return res.status(200).json({ success: true, message: 'Password updated. Sign in with your new password.' });
  } catch (error) {
    return next(error);
  }
};

export const logout = (req, res) => {
  clearTokenCookie(res);
  res.status(200).json({ success: true, message: 'Logged out.' });
};

export const getMe = (req, res) => res.status(200).json({ success: true, user: req.user.toJSON() });
