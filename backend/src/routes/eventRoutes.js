import express from 'express';
import mongoose from 'mongoose';
import {
  getPublishedEvents, getEventById, createEvent, updateEvent, publishEvent, cancelEvent,
  getOrganizerAnalytics, updateEventRecap, updateSportsData,
} from '../controllers/eventController.js';
import {
  registerForEvent, getEventAttendees, checkInAttendee, getEventAnalytics,
} from '../controllers/registrationController.js';
import {
  submitProject, getMySubmission, getEventSubmissions, evaluateSubmission,
  togglePublishResults, getLeaderboard,
} from '../controllers/submissionController.js';
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
router.param('submissionId', (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid submission ID.' });
  next();
});

// Discovery & Public Event Info
router.get('/', getPublishedEvents);
router.get('/mine/analytics', ...organizer, getOrganizerAnalytics);
router.post('/', ...organizer, createEvent);

router.get('/:eventId', optionalAuthenticate, getEventById);
router.patch('/:eventId', ...organizer, updateEvent);
router.post('/:eventId/publish', ...organizer, publishEvent);
router.post('/:eventId/cancel', ...organizer, cancelEvent);

// Registrations & Attendees
router.post('/:eventId/register', ...participant, registerForEvent);
router.get('/:eventId/attendees', ...organizer, getEventAttendees);
router.get('/:eventId/analytics', ...organizer, getEventAnalytics);
router.post('/:eventId/registrations/:registrationId/check-in', ...organizer, checkInAttendee);

// Hackathon: Project Submissions, Evaluation & Leaderboard
router.post('/:eventId/submissions', ...participant, submitProject);
router.get('/:eventId/submissions/mine', ...participant, getMySubmission);
router.get('/:eventId/submissions', ...organizer, getEventSubmissions);
router.patch('/:eventId/submissions/:submissionId/evaluate', ...organizer, evaluateSubmission);
router.post('/:eventId/publish-results', ...organizer, togglePublishResults);
router.get('/:eventId/leaderboard', optionalAuthenticate, getLeaderboard);

// Conferences & Webinars: Event Summary / Recap
router.patch('/:eventId/recap', ...organizer, updateEventRecap);

// Sports: Match Schedule & Standings
router.patch('/:eventId/sports', ...organizer, updateSportsData);

export default router;
