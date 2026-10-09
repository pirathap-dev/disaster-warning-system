import { Router } from 'express';
import { allowRoles, authenticate } from '../middleware/auth';
import { UserRole } from '../types';
import {
  confirmAllocationReceipt,
  createAllocation,
  listReliefAllocations,
  readAllocation,
  updateAllocationStatus,
} from '../controllers/reliefAllocations';

const router = Router();
const signedIn = authenticate;
const district = allowRoles(UserRole.DISTRICT_OFFICER);
const allocationReaders = allowRoles(UserRole.DISTRICT_OFFICER, UserRole.SHELTER_COORDINATOR);

router.get('/', signedIn, allocationReaders, listReliefAllocations);
router.post('/', signedIn, district, createAllocation);
router.get('/:id', signedIn, allocationReaders, readAllocation);
router.patch('/:id/status', signedIn, district, updateAllocationStatus);
router.patch('/:id/receipt', signedIn, allowRoles(UserRole.SHELTER_COORDINATOR), confirmAllocationReceipt);

export default router;
