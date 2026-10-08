import { Router } from 'express';
import { checkHealth } from '../controllers/health';

const router = Router();

router.get('/', checkHealth);

export default router;
