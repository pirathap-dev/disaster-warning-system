import { Types } from 'mongoose';
import { IRescueAssignment } from '../models/RescueAssignment';
import { IRescueIncident } from '../models/RescueIncident';
import { IRescueTeam } from '../models/RescueTeam';
import {
  getNextAssignmentStatus,
  RescueRepository,
  RescueService,
  RescueServiceError,
} from '../services/rescueService';

const incidentId = '65a000000000000000000001';
const teamId = '65a000000000000000000002';
const assignmentId = '65a000000000000000000003';
const location = { latitude: 6.9271, longitude: 79.8612 };

const incident = {
  _id: new Types.ObjectId(incidentId),
  id: incidentId,
  title: 'Flooded town center',
  locationName: 'Town Center',
  location,
  requiredCapabilities: ['medical', 'water rescue'],
  priority: 'HIGH',
  status: 'ACTIVE',
} as unknown as IRescueIncident;

const team = {
  _id: new Types.ObjectId(teamId),
  id: teamId,
  name: 'River Response',
  capabilities: ['medical', 'water rescue'],
  status: 'AVAILABLE',
  location,
} as unknown as IRescueTeam;

const assignment = {
  _id: new Types.ObjectId(assignmentId),
  incident: incident._id,
  rescueTeam: team._id,
  status: 'DISPATCHED',
  priority: 'HIGH',
  location,
  createdBy: 'District Officer',
  assignedAt: new Date('2026-10-08T10:00:00.000Z'),
} as unknown as IRescueAssignment;

function setup(overrides: Partial<RescueRepository> = {}) {
  const data = {
    createIncident: jest.fn(),
    listIncidents: jest.fn(async () => [incident]),
    getIncident: jest.fn(async () => incident),
    createTeam: jest.fn(),
    listTeams: jest.fn(async () => [team]),
    getTeam: jest.fn(async () => team),
    claimTeam: jest.fn(async () => team),
    setTeamStatus: jest.fn(async () => undefined),
    createAssignment: jest.fn(async () => assignment),
    listAssignments: jest.fn(async () => [assignment]),
    getAssignment: jest.fn(async () => assignment),
    updateAssignment: jest.fn(async (_id: string, update: Record<string, unknown>) => ({
      ...assignment,
      ...update,
    } as unknown as IRescueAssignment)),
    ...overrides,
  } as unknown as RescueRepository;
  return { data, service: new RescueService(data) };
}

describe('rescue assignment business rules', () => {
  it('creates a DISPATCHED assignment using the incident priority and location', async () => {
    const { data, service } = setup();

    const result = await service.createAssignment({
      incidentId,
      teamId,
      createdBy: 'District Officer',
      etaMinutes: 35,
      notes: 'Use east access road',
    });

    expect(result.status).toBe('DISPATCHED');
    expect(data.claimTeam).toHaveBeenCalledWith(teamId);
    expect(data.createAssignment).toHaveBeenCalledWith(expect.objectContaining({
      incident: incident._id,
      rescueTeam: team._id,
      priority: 'HIGH',
      location,
      createdBy: 'District Officer',
      etaMinutes: 35,
      notes: 'Use east access road',
      status: 'DISPATCHED',
    }));
  });

  it('rejects a malformed incident ID before repository access', async () => {
    const { data, service } = setup();

    await expect(service.createAssignment({ incidentId: 'bad-id', teamId, createdBy: 'Officer' }))
      .rejects.toMatchObject({ code: 'INVALID_INCIDENT_ID', statusCode: 400 });
    expect(data.getIncident).not.toHaveBeenCalled();
  });

  it('rejects suitability lookup for a malformed incident ID', async () => {
    const { data, service } = setup();

    await expect(service.suitableTeams('bad-id'))
      .rejects.toMatchObject({ code: 'INVALID_INCIDENT_ID', statusCode: 400 });
    expect(data.getIncident).not.toHaveBeenCalled();
  });

  it('rejects a validly formatted but missing incident', async () => {
    const { data, service } = setup({ getIncident: jest.fn(async () => null) });

    await expect(service.createAssignment({ incidentId, teamId, createdBy: 'Officer' }))
      .rejects.toMatchObject({ code: 'INCIDENT_NOT_FOUND', statusCode: 404 });
    expect(data.getTeam).not.toHaveBeenCalled();
  });

  it('rejects a resolved incident during suitability evaluation', async () => {
    const resolvedIncident = { ...incident, status: 'RESOLVED' } as unknown as IRescueIncident;
    const { data, service } = setup({ getIncident: jest.fn(async () => resolvedIncident) });

    await expect(service.suitableTeams(incidentId))
      .rejects.toMatchObject({ code: 'INCIDENT_NOT_FOUND', statusCode: 404 });
    expect(data.listTeams).not.toHaveBeenCalled();
  });

  it('returns transparent rankings even when no team is suitable', async () => {
    const unavailableTeam = { ...team, status: 'ACTIVE' } as unknown as IRescueTeam;
    const { service } = setup({ listTeams: jest.fn(async () => [unavailableTeam]) });

    const results = await service.suitableTeams(incidentId);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ suitable: false, availabilityScore: 0 });
    expect(results[0].reasons).toContain('Team is active');
  });

  it('rejects a malformed rescue team ID', async () => {
    const { service } = setup();

    await expect(service.createAssignment({ incidentId, teamId: 'not-an-id', createdBy: 'Officer' }))
      .rejects.toMatchObject({ code: 'INVALID_TEAM_ID', statusCode: 400 });
  });

  it('rejects an unknown rescue team', async () => {
    const { data, service } = setup({ getTeam: jest.fn(async () => null) });

    await expect(service.createAssignment({ incidentId, teamId, createdBy: 'Officer' }))
      .rejects.toMatchObject({ code: 'TEAM_NOT_FOUND', statusCode: 404 });
    expect(data.claimTeam).not.toHaveBeenCalled();
  });

  it('does not dispatch a team without every required capability', async () => {
    const partialTeam = { ...team, capabilities: ['medical'] } as unknown as IRescueTeam;
    const { data, service } = setup({ getTeam: jest.fn(async () => partialTeam) });

    await expect(service.createAssignment({ incidentId, teamId, createdBy: 'Officer' }))
      .rejects.toMatchObject({ code: 'TEAM_NOT_SUITABLE', statusCode: 409 });
    expect(data.claimTeam).not.toHaveBeenCalled();
  });

  it('rejects a team claimed by another dispatch before assignment creation', async () => {
    const { data, service } = setup({ claimTeam: jest.fn(async () => null) });

    await expect(service.createAssignment({ incidentId, teamId, createdBy: 'Officer' }))
      .rejects.toMatchObject({ code: 'TEAM_UNAVAILABLE', statusCode: 409 });
    expect(data.createAssignment).not.toHaveBeenCalled();
  });

  it('restores team availability when assignment persistence fails', async () => {
    const { data, service } = setup({
      createAssignment: jest.fn(async () => { throw new Error('database write failed'); }),
    });

    await expect(service.createAssignment({ incidentId, teamId, createdBy: 'Officer' }))
      .rejects.toThrow('database write failed');
    expect(data.setTeamStatus).toHaveBeenCalledWith(teamId, 'AVAILABLE');
  });

  it.each([
    ['DISPATCHED', 'EN_ROUTE'],
    ['EN_ROUTE', 'ACTIVE'],
    ['ACTIVE', 'COMPLETE'],
  ] as const)('allows the %s -> %s transition', async (current, next) => {
    expect(getNextAssignmentStatus(current, next)).toBe(next);
  });

  it('persists lifecycle updates to both assignment and team and timestamps completion', async () => {
    const { data, service } = setup({
      getAssignment: jest.fn(async () => ({ ...assignment, status: 'ACTIVE' } as unknown as IRescueAssignment)),
    });

    const result = await service.updateAssignmentStatus(assignmentId, 'COMPLETE');

    expect(result.status).toBe('COMPLETE');
    expect(data.updateAssignment).toHaveBeenCalledWith(assignmentId, expect.objectContaining({
      status: 'COMPLETE',
      completedAt: expect.any(Date),
    }));
    expect(data.setTeamStatus).toHaveBeenCalledWith(teamId, 'COMPLETE');
  });

  it('releases a completed team for reuse', async () => {
    const { data, service } = setup({ releaseCompletedTeam: jest.fn(async () => team) });

    await expect(service.releaseCompletedTeam(teamId)).resolves.toBe(team);
    expect(data.releaseCompletedTeam).toHaveBeenCalledWith(teamId);
  });

  it('rejects release for invalid IDs and teams that are not complete', async () => {
    const { data, service } = setup({ releaseCompletedTeam: jest.fn(async () => null) });

    await expect(service.releaseCompletedTeam('bad-id'))
      .rejects.toMatchObject({ code: 'INVALID_TEAM_ID', statusCode: 400 });
    await expect(service.releaseCompletedTeam(teamId))
      .rejects.toMatchObject({ code: 'TEAM_NOT_COMPLETE', statusCode: 409 });
    expect(data.releaseCompletedTeam).toHaveBeenCalledTimes(1);
  });

  it('updates the referenced team when an assignment contains a populated team object', async () => {
    const populatedAssignment = {
      ...assignment,
      status: 'DISPATCHED',
      rescueTeam: { _id: new Types.ObjectId(teamId), name: team.name },
    } as unknown as IRescueAssignment;
    const { data, service } = setup({ getAssignment: jest.fn(async () => populatedAssignment) });

    await service.updateAssignmentStatus(assignmentId, 'EN_ROUTE');

    expect(data.setTeamStatus).toHaveBeenCalledWith(teamId, 'EN_ROUTE');
  });

  it('rejects invalid, skipped, and backward lifecycle transitions', () => {
    for (const [current, next] of [
      ['DISPATCHED', 'ACTIVE'],
      ['EN_ROUTE', 'DISPATCHED'],
      ['COMPLETE', 'AVAILABLE'],
    ] as const) {
      try {
        getNextAssignmentStatus(current, next);
        throw new Error('Expected invalid transition to be rejected');
      } catch (error) {
        expect(error).toBeInstanceOf(RescueServiceError);
        expect(error).toMatchObject({ statusCode: 409, code: 'INVALID_STATUS_TRANSITION' });
      }
    }
  });

  it('returns not found for an unknown assignment', async () => {
    const { service } = setup({ getAssignment: jest.fn(async () => null) });

    await expect(service.getAssignment(assignmentId))
      .rejects.toMatchObject({ code: 'ASSIGNMENT_NOT_FOUND', statusCode: 404 });
  });
});