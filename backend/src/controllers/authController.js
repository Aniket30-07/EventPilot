import User from '../models/User.js';
import { sendTokenResponse, clearTokenCookie, sendMfaChallenge, verifyMfaChallenge } from '../utils/token.js';
import { isMailConfigured, sendPasswordResetEmail, sendVerificationEmail } from '../utils/mailer.js';
import {
  createOpaqueToken, createTotpUri, decryptTotpSecret, encryptTotpSecret, generateRecoveryCodes,
  generateTotpSecret, hashOpaqueToken, hashRecoveryCode, verifyTotp,
} from '../utils/totp.js';

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

const consumeRecoveryCode = async (user, code) => {
  if (!isStr(code)) return false;
  const hash = hashRecoveryCode(code);
  if (!user.mfaRecoveryCodeHashes.includes(hash)) return false;
  const result = await User.updateOne(
    { _id: user._id, mfaRecoveryCodeHashes: hash },
    { $pull: { mfaRecoveryCodeHashes: hash } }
  );
  return result.modifiedCount === 1;
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
    if (!isMailConfigured()) return fail(res, 503, 'Email verification is unavailable until SMTP is configured.', 'EMAIL_UNAVAILABLE');

    const normalized = normalizedEmail(email);
    if (await User.findOne({ email: normalized })) return fail(res, 409, 'An account with this email already exists.');

    const user = await User.create({
      name: name.trim(),
      email: normalized,
      passwordHash: await User.hashPassword(password),
      role: 'participant',
      emailVerified: false,
    });
    try {
      await issueVerification(user);
    } catch (error) {
      console.error('[Auth] Verification email delivery failed:', error.message);
      return fail(res, 503, 'Your account was created, but the verification email could not be sent. Use resend verification after email delivery is fixed.', 'EMAIL_DELIVERY_FAILED');
    }
    return res.status(201).json({ success: true, message: 'Account created. Check your email to verify your address before signing in.' });
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
    if (!isMailConfigured()) return fail(res, 503, 'Email delivery is not configured.', 'EMAIL_UNAVAILABLE');
    const user = await User.findOne({ email: normalizedEmail(email), emailVerified: false });
    if (user) {
      try {
        await issueVerification(user);
      } catch (error) {
        console.error('[Auth] Verification email delivery failed:', error.message);
        return fail(res, 503, 'Could not send verification email. Please try again later.', 'EMAIL_DELIVERY_FAILED');
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
    const user = await User.findOne({ email: normalizedEmail(email) }).select('+mfaSecretEncrypted');
    if (!user || !(await user.comparePassword(password))) return fail(res, 401, 'Invalid email or password.');
    if (!user.emailVerified) return fail(res, 403, 'Verify your email address before signing in.', 'EMAIL_NOT_VERIFIED');
    if (user.mfaEnabled) {
      sendMfaChallenge(res, user._id);
      return res.status(200).json({ success: true, mfaRequired: true, message: 'Enter your authenticator code to continue.' });
    }
    return sendTokenResponse(res, 200, user, 'Logged in.');
  } catch (error) {
    return next(error);
  }
};

export const completeMfaLogin = async (req, res, next) => {
  try {
    const { code } = req.body || {};
    const challenge = req.cookies?.mfa_challenge;
    if (!challenge || !isStr(code)) return fail(res, 401, 'Your sign-in challenge expired. Please sign in again.', 'MFA_CHALLENGE_EXPIRED');
    const payload = verifyMfaChallenge(challenge);
    const user = await User.findById(payload.id).select('+mfaSecretEncrypted +mfaRecoveryCodeHashes');
    if (!user || !user.mfaEnabled || user.role !== 'organizer') return fail(res, 401, 'Your sign-in challenge is no longer valid.');

    let valid = false;
    if (/^\d{6}$/.test(code) && user.mfaSecretEncrypted) {
      valid = verifyTotp(decryptTotpSecret(user.mfaSecretEncrypted), code);
    } else {
      valid = await consumeRecoveryCode(user, code);
    }
    if (!valid) return fail(res, 401, 'Authenticator or recovery code is invalid.');
    return sendTokenResponse(res, 200, user, 'Logged in.');
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return fail(res, 401, 'Your sign-in challenge expired. Please sign in again.', 'MFA_CHALLENGE_EXPIRED');
    }
    return next(error);
  }
};

export const requestPasswordReset = async (req, res, next) => {
  try {
    const { email } = req.body || {};
    if (!isStr(email) || !EMAIL_RE.test(email.trim())) return fail(res, 400, 'Enter a valid email address.');
    if (!isMailConfigured()) return fail(res, 503, 'Email delivery is not configured.', 'EMAIL_UNAVAILABLE');
    const user = await User.findOne({ email: normalizedEmail(email) });
    if (user) {
      const token = createOpaqueToken();
      user.passwordResetTokenHash = hashOpaqueToken(token);
      user.passwordResetExpiresAt = opaqueTokenExpiry(1);
      await user.save();
      try {
        await sendPasswordResetEmail(user.email, token);
      } catch (error) {
        console.error('[Auth] Password reset email delivery failed:', error.message);
        return fail(res, 503, 'Could not send the password reset email. Please try again later.', 'EMAIL_DELIVERY_FAILED');
      }
    }
    return res.status(200).json({ success: true, message: 'If an account exists for that address, a password reset email has been sent.' });
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

export const getMfaStatus = (req, res) => res.status(200).json({ success: true, enabled: req.user.mfaEnabled });

export const beginMfaSetup = async (req, res, next) => {
  try {
    const secret = generateTotpSecret();
    req.user.mfaPendingSecretEncrypted = encryptTotpSecret(secret);
    req.user.mfaPendingExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await req.user.save();
    return res.status(200).json({
      success: true,
      secret,
      otpauthUrl: createTotpUri(secret, req.user.email),
      expiresInSeconds: 600,
    });
  } catch (error) {
    if (error.message.includes('MFA_ENCRYPTION_KEY')) return fail(res, 503, error.message, 'MFA_UNAVAILABLE');
    return next(error);
  }
};

export const enableMfa = async (req, res, next) => {
  try {
    const { code } = req.body || {};
    const user = await User.findById(req.user._id).select('+mfaPendingSecretEncrypted +mfaPendingExpiresAt');
    if (!user?.mfaPendingSecretEncrypted || !user.mfaPendingExpiresAt || user.mfaPendingExpiresAt <= new Date()) {
      return fail(res, 400, 'Start MFA setup again; the setup code has expired.');
    }
    const secret = decryptTotpSecret(user.mfaPendingSecretEncrypted);
    if (!verifyTotp(secret, code)) return fail(res, 400, 'The authenticator code is invalid.');
    const recoveryCodes = generateRecoveryCodes();
    user.mfaSecretEncrypted = user.mfaPendingSecretEncrypted;
    user.mfaPendingSecretEncrypted = null;
    user.mfaPendingExpiresAt = null;
    user.mfaRecoveryCodeHashes = recoveryCodes.map(hashRecoveryCode);
    user.mfaEnabled = true;
    await user.save();
    return res.status(200).json({ success: true, enabled: true, recoveryCodes });
  } catch (error) {
    return next(error);
  }
};

export const disableMfa = async (req, res, next) => {
  try {
    const { password, code } = req.body || {};
    const user = await User.findById(req.user._id).select('+passwordHash +mfaSecretEncrypted');
    if (!isStr(password) || !(await user.comparePassword(password))) return fail(res, 401, 'Password is incorrect.');
    if (!user.mfaEnabled || !user.mfaSecretEncrypted || !verifyTotp(decryptTotpSecret(user.mfaSecretEncrypted), code)) {
      return fail(res, 401, 'Authenticator code is invalid or MFA is already disabled.');
    }
    user.mfaEnabled = false;
    user.mfaSecretEncrypted = null;
    user.mfaRecoveryCodeHashes = [];
    user.mfaPendingSecretEncrypted = null;
    user.mfaPendingExpiresAt = null;
    await user.save();
    return res.status(200).json({ success: true, enabled: false, message: 'Multi-factor authentication disabled.' });
  } catch (error) {
    return next(error);
  }
};

export const logout = (req, res) => {
  clearTokenCookie(res);
  res.status(200).json({ success: true, message: 'Logged out.' });
};

export const getMe = (req, res) => res.status(200).json({ success: true, user: req.user.toJSON() });
