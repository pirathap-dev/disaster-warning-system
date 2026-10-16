import { Router } from 'express';
import {
  confirmAllocationReceipt,
  createAllocation,
  deleteAllocation,
  listReliefAllocations,
  readAllocation,
  updateAllocationStatus,
} from '../controllers/reliefAllocations';

const router = Router();

router.get('/', listReliefAllocations);
router.post('/', createAllocation);
router.get('/:id', readAllocation);
router.delete('/:id', deleteAllocation);
router.patch('/:id/status', updateAllocationStatus);
router.patch('/:id/receipt', confirmAllocationReceipt);

export default router;
