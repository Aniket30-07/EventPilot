import express from 'express';
import {
  cancelRegistration,
  getMyRegistrations,
} from '../controllers/registrationController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Cancel own registration
router.post('/:registrationId/cancel', authenticate, cancelRegistration);

export default router;
