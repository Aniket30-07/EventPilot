import express from 'express';
import { rateLimit } from 'express-rate-limit';
import {
  getMe, login, logout, register, requestPasswordReset,
  resendVerification, resetPassword, verifyEmail,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
const recoveryLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-8', legacyHeaders: false });

router.post('/register', recoveryLimit, register);
router.post('/login', loginLimit, login);
router.post('/logout', logout);
router.get('/me', authenticate, getMe);
router.post('/verify-email', recoveryLimit, verifyEmail);
router.post('/resend-verification', recoveryLimit, resendVerification);
router.post('/password/forgot', recoveryLimit, requestPasswordReset);
router.post('/password/reset', recoveryLimit, resetPassword);

export default router;
