import { Router } from 'express';
import {
  confirmAllocationReceipt,
  createAllocation,
  listReliefAllocations,
  readAllocation,
  updateAllocationStatus,
} from '../controllers/reliefAllocations';

const router = Router();

router.get('/', listReliefAllocations);
router.post('/', createAllocation);
router.get('/:id', readAllocation);
router.patch('/:id/status', updateAllocationStatus);
router.patch('/:id/receipt', confirmAllocationReceipt);

export default router;
