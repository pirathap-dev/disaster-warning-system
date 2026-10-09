import { Router } from 'express';
import { listShelters, readShelter, updateOccupancy } from '../controllers/shelters';
import { allowRoles, authenticate } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();

router.get('/', authenticate, allowRoles(UserRole.CITIZEN, UserRole.VOLUNTEER, UserRole.DISTRICT_OFFICER, UserRole.SHELTER_COORDINATOR), listShelters);
router.get('/:id', authenticate, allowRoles(UserRole.CITIZEN, UserRole.VOLUNTEER, UserRole.DISTRICT_OFFICER, UserRole.SHELTER_COORDINATOR), readShelter);
router.patch('/:id/occupancy', authenticate, allowRoles(UserRole.SHELTER_COORDINATOR), updateOccupancy);

export default router;
