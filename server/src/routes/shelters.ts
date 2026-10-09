import { Router } from 'express';
import { listShelters, readShelter } from '../controllers/shelters';

const router = Router();

router.get('/', listShelters);
router.get('/:id', readShelter);

export default router;
