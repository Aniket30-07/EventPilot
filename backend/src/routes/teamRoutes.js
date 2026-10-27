import { Router } from 'express';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import {
  listOrganizers,
  createOrganizer,
  toggleOrganizerStatus,
  deleteOrganizer,
} from '../controllers/teamController.js';

const router = Router();

// Only organizers can manage organizer team
router.use(authenticate, authorizeRoles('organizer'));

router.get('/', listOrganizers);
router.post('/', createOrganizer);
router.patch('/:id/status', toggleOrganizerStatus);
router.delete('/:id', deleteOrganizer);

export default router;
