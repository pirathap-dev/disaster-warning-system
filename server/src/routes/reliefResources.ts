import { Router } from 'express';
import { listReliefResources } from '../controllers/reliefResources';

const router = Router();

router.get('/', listReliefResources);

export default router;
