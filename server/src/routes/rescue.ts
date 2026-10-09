import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  createAssignment,
  createIncident,
  createTeam,
  getAssignment,
  getSuitableTeams,
  listAssignments,
  listIncidents,
  listTeams,
  releaseCompletedTeam,
  updateAssignmentStatus,
} from '../controllers/rescue';
import { validateRequest } from '../middleware/validateRequest';

const router = Router();
const coordinateRules = [
  body('location.latitude').isFloat({ min: -90, max: 90 }),
  body('location.longitude').isFloat({ min: -180, max: 180 }),
];

router.get('/incidents', listIncidents);
router.post(
  '/incidents',
  body('title').trim().notEmpty(),
  body('locationName').trim().notEmpty(),
  body('requiredCapabilities').isArray({ min: 1 }),
  body('priority').isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  ...coordinateRules,
  validateRequest,
  createIncident
);

router.get('/teams/suitable', query('incidentId').isMongoId(), validateRequest, getSuitableTeams);
router.get('/teams', listTeams);
router.patch(
  '/teams/:id/availability',
  param('id').isMongoId(),
  body('status').equals('AVAILABLE'),
  validateRequest,
  releaseCompletedTeam
);
router.post(
  '/teams',
  body('name').trim().notEmpty(),
  body('capabilities').isArray({ min: 1 }),
  ...coordinateRules,
  body('contact').optional().isString().trim(),
  validateRequest,
  createTeam
);

router.get('/assignments', listAssignments);
router.post(
  '/assignments',
  body('incidentId').isMongoId(),
  body('teamId').isMongoId(),
  body('createdBy').trim().notEmpty(),
  body('etaMinutes').optional().isInt({ min: 1, max: 10080 }),
  body('notes').optional().isString().trim().isLength({ max: 1000 }),
  validateRequest,
  createAssignment
);
router.get('/assignments/:id', param('id').isMongoId(), validateRequest, getAssignment);
router.patch(
  '/assignments/:id/status',
  param('id').isMongoId(),
  body('status').isIn(['EN_ROUTE', 'ACTIVE', 'COMPLETE']),
  validateRequest,
  updateAssignmentStatus
);

export default router;