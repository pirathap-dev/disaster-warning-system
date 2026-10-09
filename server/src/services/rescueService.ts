import { Types } from 'mongoose';
import { IRescueAssignment, RescueAssignmentModel } from '../models/RescueAssignment';
import { IRescueIncident, RescueIncidentModel } from '../models/RescueIncident';
import { IRescueTeam, RescueTeamModel } from '../models/RescueTeam';
import {
  rankTeamsBySuitability,
  RescueTeamStatus,
  TeamSuitability,
} from './rescueSuitability';

export class RescueServiceError extends Error {
  constructor(message: string, public readonly statusCode: number, public readonly code: string) {
    super(message);
    this.name = 'RescueServiceError';
  }
}

export interface CreateAssignmentInput {
  incidentId: string;
  teamId: string;
  createdBy: string;
  etaMinutes?: number;
  notes?: string;
}

export interface CreateTeamInput {
  userId?: string;
  name: string;
  capabilities: string[];
  location: { latitude: number; longitude: number };
  contact?: string;
}

export interface CreateIncidentInput {
  title: string;
  locationName: string;
  location: { latitude: number; longitude: number };
  requiredCapabilities: string[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface RescueRepository {
  createIncident(data: CreateIncidentInput): Promise<IRescueIncident>;
  listIncidents(): Promise<IRescueIncident[]>;
  getIncident(id: string): Promise<IRescueIncident | null>;
  createTeam(data: CreateTeamInput): Promise<IRescueTeam>;
  listTeams(): Promise<IRescueTeam[]>;
  getTeam(id: string): Promise<IRescueTeam | null>;
  claimTeam(id: string): Promise<IRescueTeam | null>;
  releaseCompletedTeam(id: string): Promise<IRescueTeam | null>;
  setTeamStatus(id: string, status: RescueTeamStatus): Promise<void>;
  createAssignment(data: Record<string, unknown>): Promise<IRescueAssignment>;
  listAssignments(): Promise<IRescueAssignment[]>;
  getAssignment(id: string): Promise<IRescueAssignment | null>;
  updateAssignment(id: string, data: Record<string, unknown>): Promise<IRescueAssignment | null>;
}

const repository: RescueRepository = {
  createIncident: (data) => RescueIncidentModel.create(data),
  listIncidents: () => RescueIncidentModel.find({ status: 'ACTIVE' }).sort({ createdAt: -1 }).exec(),
  getIncident: (id) => RescueIncidentModel.findById(id).exec(),
  createTeam: (data) => RescueTeamModel.create(data),
  listTeams: () => RescueTeamModel.find().sort({ name: 1 }).exec(),
  getTeam: (id) => RescueTeamModel.findById(id).exec(),
  claimTeam: (id) =>
    RescueTeamModel.findOneAndUpdate(
      { _id: id, status: 'AVAILABLE' },
      { $set: { status: 'DISPATCHED' } },
      { new: true }
    ).exec(),
  releaseCompletedTeam: (id) =>
    RescueTeamModel.findOneAndUpdate(
      { _id: id, status: 'COMPLETE' },
      { $set: { status: 'AVAILABLE' } },
      { new: true }
    ).exec(),
  setTeamStatus: async (id, status) => {
    await RescueTeamModel.findByIdAndUpdate(id, { $set: { status } }).exec();
  },
  createAssignment: (data) => RescueAssignmentModel.create(data),
  listAssignments: () =>
    RescueAssignmentModel.find().populate('incident rescueTeam').sort({ assignedAt: -1 }).exec(),
  getAssignment: (id) => RescueAssignmentModel.findById(id).populate('incident rescueTeam').exec(),
  updateAssignment: (id, data) =>
    RescueAssignmentModel.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true })
      .populate('incident rescueTeam')
      .exec(),
};

export function getNextAssignmentStatus(
  current: RescueTeamStatus,
  next: RescueTeamStatus
): RescueTeamStatus {
  const transitions: Partial<Record<RescueTeamStatus, RescueTeamStatus>> = {
    DISPATCHED: 'EN_ROUTE',
    EN_ROUTE: 'ACTIVE',
    ACTIVE: 'COMPLETE',
  };
  if (transitions[current] !== next) {
    throw new RescueServiceError(
      `Cannot transition assignment from ${current} to ${next}`,
      409,
      'INVALID_STATUS_TRANSITION'
    );
  }
  return next;
}

export class RescueService {
  constructor(private readonly data: RescueRepository = repository) {}

  createIncident(input: CreateIncidentInput) {
    return this.data.createIncident(input);
  }

  listIncidents() {
    return this.data.listIncidents();
  }

  createTeam(input: CreateTeamInput) {
    return this.data.createTeam(input);
  }

  async listTeams(ownerUserId?: string) {
    const teams = await this.data.listTeams();
    return ownerUserId ? teams.filter((team) => team.userId === ownerUserId) : teams;
  }

  async decideAssignment(id: string, ownerUserId: string, decision: 'ACCEPTED' | 'DECLINED') {
    const assignment = await this.getAssignment(id);
    const team = assignment.rescueTeam as unknown as IRescueTeam;
    if (team.userId !== ownerUserId) {
      throw new RescueServiceError('You can only respond to your own assignments', 403, 'FORBIDDEN');
    }
    if (assignment.status !== 'DISPATCHED' || (assignment.decision && assignment.decision !== 'PENDING')) {
      throw new RescueServiceError('Only pending dispatches can be accepted or declined', 409, 'INVALID_ASSIGNMENT_DECISION');
    }
    const updated = await this.data.updateAssignment(id, {
      decision,
      ...(decision === 'DECLINED' ? { status: 'DECLINED' } : {}),
    });
    if (!updated) throw new RescueServiceError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
    if (decision === 'DECLINED') {
      const teamReference = assignment.rescueTeam as unknown as { _id?: Types.ObjectId };
      await this.data.setTeamStatus(String(teamReference._id ?? assignment.rescueTeam), 'AVAILABLE');
    }
    return updated;
  }

  async reassignPendingAssignment(id: string, nextTeamId: string): Promise<IRescueAssignment> {
    if (!Types.ObjectId.isValid(nextTeamId)) {
      throw new RescueServiceError('Invalid rescue team ID', 400, 'INVALID_TEAM_ID');
    }
    const assignment = await this.getAssignment(id);
    if (assignment.status !== 'DISPATCHED' || (assignment.decision && assignment.decision !== 'PENDING')) {
      throw new RescueServiceError('Only pending dispatches can be reassigned', 409, 'ASSIGNMENT_NOT_REASSIGNABLE');
    }
    const currentTeam = assignment.rescueTeam as unknown as IRescueTeam;
    if (String(currentTeam._id) === nextTeamId) {
      throw new RescueServiceError('Select a different rescue team', 400, 'SAME_RESCUE_TEAM');
    }
    const incidentRef = assignment.incident as unknown as { _id?: Types.ObjectId };
    const incident = await this.data.getIncident(String(incidentRef._id ?? assignment.incident));
    const nextTeam = await this.data.getTeam(nextTeamId);
    if (!incident || !nextTeam) {
      throw new RescueServiceError('Incident or rescue team not found', 404, 'REASSIGNMENT_TARGET_NOT_FOUND');
    }
    const suitability = rankTeamsBySuitability([{
      id: nextTeam.id,
      name: nextTeam.name,
      capabilities: nextTeam.capabilities,
      status: nextTeam.status,
      location: nextTeam.location,
    }], { requiredCapabilities: incident.requiredCapabilities, location: incident.location })[0];
    if (!suitability.suitable) {
      throw new RescueServiceError('Replacement team is not suitable for this incident', 409, 'TEAM_NOT_SUITABLE');
    }
    const claimedTeam = await this.data.claimTeam(nextTeamId);
    if (!claimedTeam) throw new RescueServiceError('Replacement team is no longer available', 409, 'TEAM_UNAVAILABLE');
    try {
      const updated = await this.data.updateAssignment(id, { rescueTeam: claimedTeam._id, decision: 'PENDING' });
      if (!updated) throw new RescueServiceError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
      await this.data.setTeamStatus(String(currentTeam._id), 'AVAILABLE');
      return updated;
    } catch (error) {
      await this.data.setTeamStatus(nextTeamId, 'AVAILABLE');
      throw error;
    }
  }

  async releaseCompletedTeam(id: string): Promise<IRescueTeam> {
    if (!Types.ObjectId.isValid(id)) {
      throw new RescueServiceError('Invalid rescue team ID', 400, 'INVALID_TEAM_ID');
    }
    const team = await this.data.releaseCompletedTeam(id);
    if (!team) {
      throw new RescueServiceError(
        'Only a completed rescue team can be marked available',
        409,
        'TEAM_NOT_COMPLETE'
      );
    }
    return team;
  }

  async suitableTeams(incidentId: string): Promise<TeamSuitability[]> {
    if (!Types.ObjectId.isValid(incidentId)) {
      throw new RescueServiceError('Invalid incident ID', 400, 'INVALID_INCIDENT_ID');
    }
    const incident = await this.data.getIncident(incidentId);
    if (!incident || incident.status !== 'ACTIVE') {
      throw new RescueServiceError('Active incident not found', 404, 'INCIDENT_NOT_FOUND');
    }
    const teams = await this.data.listTeams();
    return rankTeamsBySuitability(
      teams.map((team) => ({
        id: team.id,
        name: team.name,
        capabilities: team.capabilities,
        status: team.status,
        location: team.location,
      })),
      { requiredCapabilities: incident.requiredCapabilities, location: incident.location }
    );
  }

  async createAssignment(input: CreateAssignmentInput): Promise<IRescueAssignment> {
    if (!Types.ObjectId.isValid(input.incidentId)) {
      throw new RescueServiceError('Invalid incident ID', 400, 'INVALID_INCIDENT_ID');
    }
    if (!Types.ObjectId.isValid(input.teamId)) {
      throw new RescueServiceError('Invalid rescue team ID', 400, 'INVALID_TEAM_ID');
    }
    const incident = await this.data.getIncident(input.incidentId);
    if (!incident || incident.status !== 'ACTIVE') {
      throw new RescueServiceError('Active incident not found', 404, 'INCIDENT_NOT_FOUND');
    }
    const team = await this.data.getTeam(input.teamId);
    if (!team) throw new RescueServiceError('Rescue team not found', 404, 'TEAM_NOT_FOUND');

    const suitability = rankTeamsBySuitability(
      [{
        id: team.id,
        name: team.name,
        capabilities: team.capabilities,
        status: team.status,
        location: team.location,
      }],
      { requiredCapabilities: incident.requiredCapabilities, location: incident.location }
    )[0];
    if (!suitability.suitable) {
      throw new RescueServiceError('Rescue team is not suitable for this incident', 409, 'TEAM_NOT_SUITABLE');
    }

    const claimedTeam = await this.data.claimTeam(input.teamId);
    if (!claimedTeam) {
      throw new RescueServiceError('Rescue team is no longer available', 409, 'TEAM_UNAVAILABLE');
    }
    try {
      return await this.data.createAssignment({
        incident: incident._id,
        rescueTeam: claimedTeam._id,
        priority: incident.priority,
        location: incident.location,
        createdBy: input.createdBy,
        status: 'DISPATCHED',
        assignedAt: new Date(),
        etaMinutes: input.etaMinutes,
        notes: input.notes,
      });
    } catch (error) {
      await this.data.setTeamStatus(input.teamId, 'AVAILABLE');
      throw error;
    }
  }

  async listAssignments(ownerUserId?: string) {
    const assignments = await this.data.listAssignments();
    return ownerUserId
      ? assignments.filter((assignment) => (assignment.rescueTeam as unknown as IRescueTeam).userId === ownerUserId)
      : assignments;
  }

  async getAssignment(id: string) {
    if (!Types.ObjectId.isValid(id)) {
      throw new RescueServiceError('Invalid assignment ID', 400, 'INVALID_ASSIGNMENT_ID');
    }
    const assignment = await this.data.getAssignment(id);
    if (!assignment) throw new RescueServiceError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
    return assignment;
  }

  async updateAssignmentStatus(id: string, status: RescueTeamStatus) {
    const assignment = await this.getAssignment(id);
    if (assignment.status === 'DECLINED' || assignment.decision !== 'ACCEPTED') {
      throw new RescueServiceError('The assignment must be accepted before status updates', 409, 'ASSIGNMENT_NOT_ACCEPTED');
    }
    const nextStatus = getNextAssignmentStatus(assignment.status, status);
    const updated = await this.data.updateAssignment(id, {
      status: nextStatus,
      ...(nextStatus === 'COMPLETE' ? { completedAt: new Date() } : {}),
    });
    if (!updated) throw new RescueServiceError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
    const teamReference = assignment.rescueTeam as unknown as { _id?: Types.ObjectId };
    await this.data.setTeamStatus(
      String(teamReference._id ?? assignment.rescueTeam),
      nextStatus === 'COMPLETE' ? 'AVAILABLE' : nextStatus
    );
    return updated;
  }
}

export const rescueService = new RescueService();