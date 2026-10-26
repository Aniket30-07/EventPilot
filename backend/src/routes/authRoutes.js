import express from 'express';
import {
  register,
  login,
  logout,
  getMe,
  seedOrganizer,
} from '../controllers/authController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// Public auth endpoints
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);

// Current user profile
router.get('/me', authenticate, getMe);

// Controlled dev seed method
router.post('/seed-organizer', seedOrganizer);

// Protected role test routes (for Phase 1 verification)
router.get('/organizer-only', authenticate, authorizeRoles('organizer'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Authorized: Access granted to organizer-only endpoint.',
    user: req.user.toJSON(),
  });
});

router.get('/participant-only', authenticate, authorizeRoles('participant'), (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Authorized: Access granted to participant-only endpoint.',
    user: req.user.toJSON(),
  });
});

export default router;
