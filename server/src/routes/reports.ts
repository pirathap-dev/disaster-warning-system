import { Router } from 'express';
import { body } from 'express-validator';
import { DisasterType, SeverityLevel, ReportStatus } from '../types';
import { validateRequest } from '../middleware/validate';
import * as controller from '../controllers/groundReportController';

const router = Router();

router.post(
  '/',
  [
    body('reporterId').notEmpty().withMessage('Reporter ID is required'),
    body('disasterType').isIn(Object.values(DisasterType)).withMessage('Invalid disaster type'),
    body('description').notEmpty().withMessage('Description is required'),
    body('severity').isIn(Object.values(SeverityLevel)).withMessage('Invalid severity level'),
    body('location.latitude').isFloat({ min: -90, max: 90 }).withMessage('Valid latitude is required'),
    body('location.longitude').isFloat({ min: -180, max: 180 }).withMessage('Valid longitude is required'),
  ],
  validateRequest,
  controller.createReport
);

router.get('/', controller.getReports);
router.get('/:id', controller.getReport);

router.patch(
  '/:id/status',
  [
    body('status').isIn(Object.values(ReportStatus)).withMessage('Invalid status'),
    body('reviewerId').notEmpty().withMessage('Reviewer ID is required'),
    body('remarks').optional().isString()
  ],
  validateRequest,
  controller.updateStatus
);

export default router;
