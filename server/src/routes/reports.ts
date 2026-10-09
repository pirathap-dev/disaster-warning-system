import { Router } from 'express';
import { body } from 'express-validator';
import { DisasterType, SeverityLevel, ReportStatus } from '../types';
import { validateRequest } from '../middleware/validate';
import * as controller from '../controllers/groundReportController';
import { allowRoles, authenticate } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();
const authenticated = authenticate;
const reportSubmitters = allowRoles(UserRole.CITIZEN, UserRole.VOLUNTEER);
const dmcOfficers = allowRoles(UserRole.DMC_DUTY_OFFICER, UserRole.DMC_OFFICER);
const reportReaders = allowRoles(
  UserRole.CITIZEN,
  UserRole.VOLUNTEER,
  UserRole.DMC_DUTY_OFFICER,
  UserRole.DMC_OFFICER
);

// Create a new ground report
router.post(
  '/',
  authenticated,
  reportSubmitters,
  [
    body('disasterType').isIn(Object.values(DisasterType)).withMessage('Invalid disaster type'),
    body('description').notEmpty().withMessage('Description is required'),
    body('severity').isIn(Object.values(SeverityLevel)).withMessage('Invalid severity level'),
    body('location.latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
    body('location.longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
  ],
  validateRequest,
  controller.createReport
);

// Get all reports (with optional filters: ?status=UNDER_REVIEW&reporterId=citizen_123)
router.get('/', authenticated, reportReaders, controller.getReports);
router.get('/:id', authenticated, reportReaders, controller.getReport);

// Edit a report (citizen only, status must be UNDER_REVIEW or NEEDS_MORE_INFO)
router.put(
  '/:id',
  authenticated,
  reportSubmitters,
  [
    body('disasterType').optional().isIn(Object.values(DisasterType)).withMessage('Invalid disaster type'),
    body('description').optional().notEmpty().withMessage('Description cannot be empty'),
    body('severity').optional().isIn(Object.values(SeverityLevel)).withMessage('Invalid severity level'),
    body('location.latitude').optional().isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
    body('location.longitude').optional().isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
  ],
  validateRequest,
  controller.editReport
);

// Delete a report (citizen only, status must be UNDER_REVIEW)
router.delete('/:id', authenticated, reportSubmitters, controller.deleteReport);

// DMC Officer: update report status
router.patch(
  '/:id/status',
  authenticated,
  dmcOfficers,
  [
    body('status').isIn(Object.values(ReportStatus)).withMessage('Invalid status'),
    body('remarks').optional().isString()
  ],
  validateRequest,
  controller.updateStatus
);

export default router;
