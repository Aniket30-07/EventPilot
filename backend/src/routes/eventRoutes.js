import express from 'express';
import {
  getPublishedEvents,
  getEventById,
  getMyEvents,
  createEvent,
  updateEvent,
  publishEvent,
  cancelEvent,
} from '../controllers/eventController.js';
import { authenticate, authorizeRoles, optionalAuthenticate } from '../middleware/auth.js';

import {
  registerForEvent,
  getEventRegistrationStatus,
  getEventAttendees,
  checkInAttendee,
  getEventAnalytics,
  getOrganizerAnalytics,
} from '../controllers/registrationController.js';

const router = express.Router();

// Public discovery of published events
router.get('/', getPublishedEvents);

// Organizer's owned events and portfolio analytics
router.get('/mine', authenticate, authorizeRoles('organizer'), getMyEvents);
router.get('/mine/analytics', authenticate, authorizeRoles('organizer'), getOrganizerAnalytics);

// Event registration status & remaining capacity
router.get('/:eventId/my-registration', optionalAuthenticate, getEventRegistrationStatus);

// Participant registers for an event
router.post('/:eventId/register', authenticate, registerForEvent);

// Phase 4: Owner-only event attendees & check-in
router.get('/:eventId/attendees', authenticate, authorizeRoles('organizer'), getEventAttendees);
router.get('/:eventId/analytics', authenticate, authorizeRoles('organizer'), getEventAnalytics);
router.post(
  '/:eventId/registrations/:registrationId/check-in',
  authenticate,
  authorizeRoles('organizer'),
  checkInAttendee
);

// Event detail (published for public; draft/cancelled for owner)
router.get('/:eventId', optionalAuthenticate, getEventById);

// Organizer lifecycle actions
router.post('/', authenticate, authorizeRoles('organizer'), createEvent);
router.patch('/:eventId', authenticate, authorizeRoles('organizer'), updateEvent);
router.post('/:eventId/publish', authenticate, authorizeRoles('organizer'), publishEvent);
router.post('/:eventId/cancel', authenticate, authorizeRoles('organizer'), cancelEvent);

export default router;
