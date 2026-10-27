import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import {
  invitePlayerToTeam,
  getMyPendingInvites,
  acceptTeamInvite,
  declineTeamInvite,
  getEventSquad,
} from '../controllers/teamInviteController.js';

const router = Router();

// Participant views their pending team invitations
router.get('/me/invites', authenticate, authorizeRoles('participant'), getMyPendingInvites);

// Participant accepts / declines invite
router.post('/invites/:inviteId/accept', authenticate, authorizeRoles('participant'), acceptTeamInvite);
router.post('/invites/:inviteId/decline', authenticate, authorizeRoles('participant'), declineTeamInvite);

// Squad management for an event
router.get('/events/:eventId/squad', authenticate, authorizeRoles('participant'), getEventSquad);
router.post('/events/:eventId/invites', authenticate, authorizeRoles('participant'), invitePlayerToTeam);

export default router;
