import { Router } from 'express';
import { body, param, query } from 'express-validator';
import {
  createAssignment,
  createIncident,
  createTeam,
  decideAssignment,
  getAssignment,
  getSuitableTeams,
  listAssignments,
  listIncidents,
  listTeams,
  listOwnedTeams,
  releaseCompletedTeam,
  reassignAssignment,
  updateAssignmentStatus,
} from '../controllers/rescue';
import { validateRequest } from '../middleware/validateRequest';
import { allowRoles, authenticate } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();
const signedIn = authenticate;
const districtOfficer = allowRoles(UserRole.DISTRICT_OFFICER);
const rescueOrDistrict = allowRoles(UserRole.RESCUE_TEAM, UserRole.DISTRICT_OFFICER);
const coordinateRules = [
  body('location.latitude').isFloat({ min: -90, max: 90 }),
  body('location.longitude').isFloat({ min: -180, max: 180 }),
];

router.get('/incidents', signedIn, districtOfficer, listIncidents);
router.post(
  '/incidents',
  signedIn,
  districtOfficer,
  body('title').trim().notEmpty(),
  body('locationName').trim().notEmpty(),
  body('requiredCapabilities').isArray({ min: 1 }),
  body('priority').isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  ...coordinateRules,
  validateRequest,
  createIncident
);

router.get('/teams/suitable', signedIn, districtOfficer, query('incidentId').isMongoId(), validateRequest, getSuitableTeams);
router.get('/teams', signedIn, rescueOrDistrict, listOwnedTeams);
router.patch(
  '/teams/:id/availability',
  signedIn,
  districtOfficer,
  param('id').isMongoId(),
  body('status').equals('AVAILABLE'),
  validateRequest,
  releaseCompletedTeam
);
router.post(
  '/teams',
  signedIn,
  districtOfficer,
  body('name').trim().notEmpty(),
  body('capabilities').isArray({ min: 1 }),
  body('userId').optional().isMongoId(),
  ...coordinateRules,
  body('contact').optional().isString().trim(),
  validateRequest,
  createTeam
);

router.get('/assignments', signedIn, rescueOrDistrict, listAssignments);
router.post(
  '/assignments',
  signedIn,
  districtOfficer,
  body('incidentId').isMongoId(),
  body('teamId').isMongoId(),
  body('createdBy').trim().notEmpty(),
  body('etaMinutes').optional().isInt({ min: 1, max: 10080 }),
  body('notes').optional().isString().trim().isLength({ max: 1000 }),
  validateRequest,
  createAssignment
);
router.get('/assignments/:id', signedIn, rescueOrDistrict, param('id').isMongoId(), validateRequest, getAssignment);
router.patch(
  '/assignments/:id/status',
  signedIn,
  allowRoles(UserRole.RESCUE_TEAM),
  param('id').isMongoId(),
  body('status').isIn(['EN_ROUTE', 'ACTIVE', 'COMPLETE']),
  validateRequest,
  updateAssignmentStatus
);
router.patch(
  '/assignments/:id/decision',
  signedIn,
  allowRoles(UserRole.RESCUE_TEAM),
  param('id').isMongoId(),
  body('decision').isIn(['ACCEPTED', 'DECLINED']),
  validateRequest,
  decideAssignment
);
router.patch(
  '/assignments/:id/reassign',
  signedIn,
  districtOfficer,
  param('id').isMongoId(),
  body('teamId').isMongoId(),
  validateRequest,
  reassignAssignment
);

export default router;