import request from 'supertest';
import app from '../app';
import { rescueService } from '../services/rescueService';

const validIncidentId = '65a000000000000000000001';
const validTeamId = '65a000000000000000000002';
const validAssignmentId = '65a000000000000000000003';

describe('rescue API validation and error responses', () => {
  afterEach(() => jest.restoreAllMocks());

  it('returns a standard validation error for invalid assignment references', async () => {
    const response = await request(app)
      .post('/api/rescue/assignments')
      .send({ incidentId: 'invalid', teamId: 'invalid', createdBy: '' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(response.body.error.message).toContain('Invalid value');
  });

  it('rejects unsupported assignment status values before service access', async () => {
    const response = await request(app)
      .patch('/api/rescue/assignments/65a000000000000000000003/status')
      .send({ status: 'AVAILABLE' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects malformed assignment references', async () => {
    const response = await request(app)
      .get('/api/rescue/assignments/not-an-id');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns successful envelopes for rescue controller operations', async () => {
    jest.spyOn(rescueService, 'listIncidents').mockResolvedValue([]);
    jest.spyOn(rescueService, 'createIncident').mockResolvedValue({ _id: validIncidentId } as never);
    jest.spyOn(rescueService, 'listTeams').mockResolvedValue([]);
    jest.spyOn(rescueService, 'createTeam').mockResolvedValue({ _id: validTeamId } as never);
    jest.spyOn(rescueService, 'releaseCompletedTeam').mockResolvedValue({ _id: validTeamId, status: 'AVAILABLE' } as never);
    jest.spyOn(rescueService, 'suitableTeams').mockResolvedValue([]);
    jest.spyOn(rescueService, 'listAssignments').mockResolvedValue([]);
    jest.spyOn(rescueService, 'createAssignment').mockResolvedValue({ _id: validAssignmentId } as never);
    jest.spyOn(rescueService, 'getAssignment').mockResolvedValue({ _id: validAssignmentId } as never);
    jest.spyOn(rescueService, 'updateAssignmentStatus').mockResolvedValue({ status: 'EN_ROUTE' } as never);

    const incidentBody = {
      title: 'River flooding',
      locationName: 'North District',
      location: { latitude: 6.9271, longitude: 79.8612 },
      requiredCapabilities: ['water rescue'],
      priority: 'HIGH',
    };
    const teamBody = {
      name: 'River Response',
      capabilities: ['water rescue'],
      location: incidentBody.location,
      contact: '555-0144',
    };
    const assignmentBody = {
      incidentId: validIncidentId,
      teamId: validTeamId,
      createdBy: 'District Officer',
      etaMinutes: 35,
      notes: 'East access road',
    };

    const responses = await Promise.all([
      request(app).get('/api/rescue/incidents'),
      request(app).post('/api/rescue/incidents').send(incidentBody),
      request(app).get('/api/rescue/teams'),
      request(app).post('/api/rescue/teams').send(teamBody),
      request(app).patch(`/api/rescue/teams/${validTeamId}/availability`).send({ status: 'AVAILABLE' }),
      request(app).get(`/api/rescue/teams/suitable?incidentId=${validIncidentId}`),
      request(app).get('/api/rescue/assignments'),
      request(app).post('/api/rescue/assignments').send(assignmentBody),
      request(app).get(`/api/rescue/assignments/${validAssignmentId}`),
      request(app).patch(`/api/rescue/assignments/${validAssignmentId}/status`).send({ status: 'EN_ROUTE' }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      200, 201, 200, 201, 200, 200, 200, 201, 200, 200,
    ]);
    expect(responses.every((response) => response.body.success)).toBe(true);
    expect(responses[1].body.data._id).toBe(validIncidentId);
    expect(responses[7].body.data._id).toBe(validAssignmentId);
    expect(responses[9].body.data.status).toBe('EN_ROUTE');
  });

  it('validates team availability release requests', async () => {
    const response = await request(app)
      .patch(`/api/rescue/teams/${validTeamId}/availability`)
      .send({ status: 'DISPATCHED' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('passes controller service errors to the existing error response middleware', async () => {
    jest.spyOn(rescueService, 'listIncidents').mockRejectedValue(new Error('database unavailable'));

    const response = await request(app).get('/api/rescue/incidents');

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      error: { message: 'database unavailable', code: 'INTERNAL_SERVER_ERROR' },
    });
  });
});