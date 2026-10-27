import express from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  beginMfaSetup, completeMfaLogin, disableMfa, enableMfa, getMe, getMfaStatus, login, logout,
  register, requestPasswordReset, resendVerification, resetPassword, verifyEmail,
} from '../controllers/authController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
const recoveryLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false });
const mfaLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false });

router.post('/register', recoveryLimit, register);
router.post('/login', loginLimit, login);
router.post('/login/mfa', mfaLimit, completeMfaLogin);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.post('/verify-email', recoveryLimit, verifyEmail);
router.post('/resend-verification', recoveryLimit, resendVerification);
router.post('/password/forgot', recoveryLimit, requestPasswordReset);
router.post('/password/reset', recoveryLimit, resetPassword);
router.get('/mfa', authenticate, authorizeRoles('organizer'), getMfaStatus);
router.post('/mfa/setup', authenticate, authorizeRoles('organizer'), mfaLimit, beginMfaSetup);
router.post('/mfa/enable', authenticate, authorizeRoles('organizer'), mfaLimit, enableMfa);
router.post('/mfa/disable', authenticate, authorizeRoles('organizer'), mfaLimit, disableMfa);

export default router;
