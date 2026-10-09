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

export const createTeam = handle(async (req, res) =>
  respond(res, await rescueService.createTeam(req.body), 201)
);

export const releaseCompletedTeam = handle(async (req, res) =>
  respond(res, await rescueService.releaseCompletedTeam(req.params.id))
);

export const getSuitableTeams = handle(async (req, res) =>
  respond(res, await rescueService.suitableTeams(String(req.query.incidentId)))
);

export const listAssignments = handle(async (_req, res) =>
  respond(res, await rescueService.listAssignments())
);

export const createAssignment = handle(async (req, res) =>
  respond(res, await rescueService.createAssignment(req.body), 201)
);

export const getAssignment = handle(async (req, res) =>
  respond(res, await rescueService.getAssignment(req.params.id))
);

export const updateAssignmentStatus = handle(async (req, res) =>
  respond(
    res,
    await rescueService.updateAssignmentStatus(req.params.id, req.body.status as RescueTeamStatus)
  )
);