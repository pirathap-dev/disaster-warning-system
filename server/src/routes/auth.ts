import { Router } from 'express';
import { body } from 'express-validator';
import { login, me, register, testLogin } from '../controllers/auth';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import { UserRole } from '../types';
import { isTestAccessEnabled } from '../config/testAccess';

const router = Router();

router.post('/register', [
  body('name').isString().trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isString().isLength({ min: 8 }),
  body('role').optional().isIn([UserRole.CITIZEN, UserRole.VOLUNTEER]),
], validateRequest, register);

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').isString().notEmpty(),
], validateRequest, login);

router.post('/test-login', (req, res, next) => {
  if (!isTestAccessEnabled()) {
    res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });
    return;
  }
  next();
}, body('role').isIn([
  UserRole.CITIZEN,
  UserRole.VOLUNTEER,
  UserRole.DMC_DUTY_OFFICER,
  UserRole.DISTRICT_OFFICER,
  UserRole.RESCUE_TEAM,
  UserRole.SHELTER_COORDINATOR,
  UserRole.RESOURCE_ORGANIZATION,
]), validateRequest, testLogin);

router.get('/me', authenticate, me);

export default router;