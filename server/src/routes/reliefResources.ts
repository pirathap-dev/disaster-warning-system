import { Router } from 'express';
import {
	createReliefResourceRecord,
	listReliefResources,
	updateReliefResourceRecord,
} from '../controllers/reliefResources';
import { allowRoles, authenticate } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();

router.get('/', authenticate, allowRoles(UserRole.DISTRICT_OFFICER, UserRole.SHELTER_COORDINATOR, UserRole.RESOURCE_ORGANIZATION), listReliefResources);
router.post('/', authenticate, allowRoles(UserRole.RESOURCE_ORGANIZATION), createReliefResourceRecord);
router.patch('/:id', authenticate, allowRoles(UserRole.RESOURCE_ORGANIZATION), updateReliefResourceRecord);

export default router;
