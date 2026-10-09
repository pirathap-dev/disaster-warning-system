import { NextFunction, Request, Response } from 'express';
import { rescueService } from '../services/rescueService';
import { RescueTeamStatus } from '../services/rescueSuitability';

const handle =
  (action: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    action(req, res).catch(next);
  };

const respond = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });

export const listIncidents = handle(async (_req, res) =>
  respond(res, await rescueService.listIncidents())
);

export const createIncident = handle(async (req, res) =>
  respond(res, await rescueService.createIncident(req.body), 201)
);

export const listTeams = handle(async (_req, res) => respond(res, await rescueService.listTeams()));

export const listOwnedTeams = handle(async (req, res) =>
  respond(res, await rescueService.listTeams(req.user?.role === 'RESCUE_TEAM' ? req.user.id : undefined))
);

export const createTeam = handle(async (req, res) =>
  respond(res, await rescueService.createTeam(req.body), 201)
);

export const releaseCompletedTeam = handle(async (req, res) =>
  respond(res, await rescueService.releaseCompletedTeam(req.params.id))
);

export const getSuitableTeams = handle(async (req, res) =>
  respond(res, await rescueService.suitableTeams(String(req.query.incidentId)))
);

export const listAssignments = handle(async (req, res) =>
  respond(res, await rescueService.listAssignments(req.user?.role === 'RESCUE_TEAM' ? req.user.id : undefined))
);

export const createAssignment = handle(async (req, res) =>
  respond(res, await rescueService.createAssignment({ ...req.body, createdBy: req.user!.name }), 201)
);

export const getAssignment = handle(async (req, res) => {
  const assignment = await rescueService.getAssignment(req.params.id);
  const team = assignment.rescueTeam as unknown as { userId?: string };
  if (req.user?.role === 'RESCUE_TEAM' && team.userId !== req.user.id) {
    res.status(403).json({ success: false, error: { message: 'You can only view your own assignments', code: 'FORBIDDEN' } });
    return;
  }
  respond(res, assignment);
});

export const updateAssignmentStatus = handle(async (req, res) => {
  const assignment = await rescueService.getAssignment(req.params.id);
  const team = assignment.rescueTeam as unknown as { userId?: string };
  if (team.userId !== req.user?.id) {
    res.status(403).json({ success: false, error: { message: 'You can only update your own assignments', code: 'FORBIDDEN' } });
    return;
  }
  respond(res, await rescueService.updateAssignmentStatus(req.params.id, req.body.status as RescueTeamStatus));
});

export const decideAssignment = handle(async (req, res) =>
  respond(res, await rescueService.decideAssignment(
    req.params.id,
    req.user!.id,
    req.body.decision as 'ACCEPTED' | 'DECLINED'
  ))
);

export const reassignAssignment = handle(async (req, res) =>
  respond(res, await rescueService.reassignPendingAssignment(req.params.id, req.body.teamId))
);