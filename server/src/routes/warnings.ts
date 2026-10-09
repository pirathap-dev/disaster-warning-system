import { Router } from 'express';
import { body } from 'express-validator';
import { WarningController } from '../controllers/warningController';
import { validateRequest } from '../middleware/validate';
import { WarningLevel, WarningPriority, WarningStatus } from '../types';
import { allowRoles, authenticate } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();
const signedIn = authenticate;
const readers = allowRoles(UserRole.CITIZEN, UserRole.VOLUNTEER, UserRole.DMC_DUTY_OFFICER, UserRole.DMC_OFFICER, UserRole.DISTRICT_OFFICER);
const officers = allowRoles(UserRole.DMC_DUTY_OFFICER, UserRole.DMC_OFFICER);

// 1. Get verified hazards for assessment
router.get('/hazards', signedIn, officers, WarningController.getVerifiedHazards);

// 2. Create warning
router.post(
  '/',
  signedIn,
  officers,
  [
    body('hazardId').notEmpty().withMessage('Related hazard ID is required'),
    body('warningLevel')
      .isIn(Object.values(WarningLevel))
      .withMessage(`Warning level must be one of: ${Object.values(WarningLevel).join(', ')}`),
    body('priority')
      .optional()
      .isIn(Object.values(WarningPriority))
      .withMessage(`Priority must be one of: ${Object.values(WarningPriority).join(', ')}`),
    body('message')
      .isString()
      .trim()
      .isLength({ min: 5 })
      .withMessage('Warning message is required and must be at least 5 characters'),
    body('affectedArea')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Affected geographic area is required'),
    body('startTime')
      .isISO8601()
      .withMessage('Start time must be a valid ISO8601 date string'),
    body('expiryTime')
      .isISO8601()
      .withMessage('Expiry time must be a valid ISO8601 date string'),
    body('recommendedAction')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Recommended action is required'),
    body('createdBy')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('Created by officer identifier is required'),
    body('status')
      .optional()
      .isIn([WarningStatus.DRAFT, WarningStatus.PUBLISHED])
      .withMessage('Initial status must be DRAFT or PUBLISHED'),
  ],
  validateRequest,
  WarningController.createWarning
);

// 3. Get all warnings
router.get('/', signedIn, readers, WarningController.getWarnings);

// 4. Get warning by ID
router.get('/:id', signedIn, readers, WarningController.getWarningById);

// 5. Update warning content
router.patch(
  '/:id',
  signedIn,
  officers,
  [
    body('warningLevel')
      .optional()
      .isIn(Object.values(WarningLevel))
      .withMessage(`Warning level must be one of: ${Object.values(WarningLevel).join(', ')}`),
    body('priority')
      .optional()
      .isIn(Object.values(WarningPriority))
      .withMessage(`Priority must be one of: ${Object.values(WarningPriority).join(', ')}`),
    body('message')
      .optional()
      .isString()
      .trim()
      .isLength({ min: 5 })
      .withMessage('Warning message must be at least 5 characters'),
    body('startTime')
      .optional()
      .isISO8601()
      .withMessage('Start time must be a valid ISO8601 date string'),
    body('expiryTime')
      .optional()
      .isISO8601()
      .withMessage('Expiry time must be a valid ISO8601 date string'),
  ],
  validateRequest,
  WarningController.updateWarning
);

// 6. Update warning status
router.patch(
  '/:id/status',
  signedIn,
  officers,
  [
    body('status')
      .notEmpty()
      .isIn(Object.values(WarningStatus))
      .withMessage(`Status must be one of: ${Object.values(WarningStatus).join(', ')}`),
  ],
  validateRequest,
  WarningController.updateStatus
);

// 7. Get notification delivery records and summary
router.get('/:id/notifications', signedIn, officers, WarningController.getNotifications);

// 8. Simulate notification delivery progression
router.post('/:id/notifications/simulate', signedIn, officers, WarningController.simulateNotifications);

export default router;
