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

  listTeams() {
    return this.data.listTeams();
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

  listAssignments() {
    return this.data.listAssignments();
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
    const nextStatus = getNextAssignmentStatus(assignment.status, status);
    const updated = await this.data.updateAssignment(id, {
      status: nextStatus,
      ...(nextStatus === 'COMPLETE' ? { completedAt: new Date() } : {}),
    });
    if (!updated) throw new RescueServiceError('Assignment not found', 404, 'ASSIGNMENT_NOT_FOUND');
    const teamReference = assignment.rescueTeam as unknown as { _id?: Types.ObjectId };
    await this.data.setTeamStatus(
      String(teamReference._id ?? assignment.rescueTeam),
      nextStatus
    );
    return updated;
  }
}

export const rescueService = new RescueService();