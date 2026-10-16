import { Router } from 'express';
import {
  clearShelter,
  createShelter,
  listShelters,
  readShelter,
} from '../controllers/shelters';

const router = Router();

router.get('/', listShelters);
router.post('/', createShelter);
router.post('/:id/clear-occupancy', clearShelter);
router.get('/:id', readShelter);

export default router;
