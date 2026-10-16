import { Router } from 'express';
import {
  createShelter,
  listCoordinatorRequests,
  listShelters,
  readShelter,
  requestCoordinator,
  respondToCoordinatorRequest,
  updateOccupancy,
} from '../controllers/shelters';
import { allowRoles, authenticate } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();

router.get('/', authenticate, allowRoles(UserRole.CITIZEN, UserRole.VOLUNTEER, UserRole.DISTRICT_OFFICER, UserRole.SHELTER_COORDINATOR), listShelters);
router.post('/', authenticate, allowRoles(UserRole.DISTRICT_OFFICER), createShelter);
router.get('/coordinator-requests', authenticate, allowRoles(UserRole.SHELTER_COORDINATOR), listCoordinatorRequests);
router.post('/:id/coordinator-request', authenticate, allowRoles(UserRole.DISTRICT_OFFICER), requestCoordinator);
router.patch('/:id/coordinator-request', authenticate, allowRoles(UserRole.SHELTER_COORDINATOR), respondToCoordinatorRequest);
router.get('/:id', authenticate, allowRoles(UserRole.CITIZEN, UserRole.VOLUNTEER, UserRole.DISTRICT_OFFICER, UserRole.SHELTER_COORDINATOR), readShelter);
router.patch('/:id/occupancy', authenticate, allowRoles(UserRole.SHELTER_COORDINATOR), updateOccupancy);

export default router;
