import express from 'express';
import mongoose from 'mongoose';
import {
  getPublishedEvents, getEventById, createEvent, updateEvent, publishEvent, cancelEvent, getOrganizerAnalytics,
} from '../controllers/eventController.js';
import {
  registerForEvent, getEventAttendees, checkInAttendee, getEventAnalytics,
} from '../controllers/registrationController.js';
import { authenticate, authorizeRoles, optionalAuthenticate } from '../middleware/auth.js';

const router = express.Router();
const organizer = [authenticate, authorizeRoles('organizer')];
const participant = [authenticate, authorizeRoles('participant')];

// Reject malformed ids before any controller runs
router.param('eventId', (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid event ID.' });
  next();
});
router.param('registrationId', (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid registration ID.' });
  next();
});

router.get('/', getPublishedEvents);
router.get('/mine/analytics', ...organizer, getOrganizerAnalytics);
router.post('/', ...organizer, createEvent);

router.get('/:eventId', optionalAuthenticate, getEventById);
router.patch('/:eventId', ...organizer, updateEvent);
router.post('/:eventId/publish', ...organizer, publishEvent);
router.post('/:eventId/cancel', ...organizer, cancelEvent);

router.post('/:eventId/register', ...participant, registerForEvent);

router.get('/:eventId/attendees', ...organizer, getEventAttendees);
router.get('/:eventId/analytics', ...organizer, getEventAnalytics);
router.post('/:eventId/registrations/:registrationId/check-in', ...organizer, checkInAttendee);

export default router;
