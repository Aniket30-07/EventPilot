import express from 'express';
import mongoose from 'mongoose';
import { cancelRegistration } from '../controllers/registrationController.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

router.param('registrationId', (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid registration ID.' });
  next();
});

router.post('/:registrationId/cancel', authenticate, authorizeRoles('participant'), cancelRegistration);

export default router;
