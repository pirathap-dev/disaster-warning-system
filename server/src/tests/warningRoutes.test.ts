import request from 'supertest';
import mongoose from 'mongoose';
import app from '../app';
import { WarningModel } from '../models/Warning';
import { HazardModel } from '../models/Hazard';
import { NotificationModel } from '../models/Notification';
import { WarningLevel, WarningPriority, WarningStatus, ReportStatus, UserRole } from '../types';

describe('Warning API Routes End-to-End Integration', () => {
  let verifiedHazardId: string;

  beforeAll(async () => {
    await mongoose.connect('mongodb://localhost:27017/disaster_warning_routes_test');
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await WarningModel.deleteMany({});
    await HazardModel.deleteMany({});
    await NotificationModel.deleteMany({});

    const hazard = await HazardModel.create({
      title: 'Monsoon Heavy Inundation Hazard',
      disasterType: 'FLOOD',
      severity: 'HIGH',
      location: { district: 'Ratnapura', address: 'Kalu Ganga Basin' },
      description: 'Major rainfall upstream resulting in flash flooding risk.',
      status: ReportStatus.VERIFIED,
      verifiedBy: 'DMC Officer #07',
    });
    verifiedHazardId = hazard._id.toString();
  });

  const validPayload = () => ({
    hazardId: verifiedHazardId,
    warningLevel: WarningLevel.WATCH,
    priority: WarningPriority.MEDIUM,
    message: 'Advisory: Monsoon river swell detected in Kalu Ganga reach.',
    affectedArea: 'Ratnapura District',
    startTime: new Date(Date.now() + 60000).toISOString(),
    expiryTime: new Date(Date.now() + 3600000 * 5).toISOString(),
    recommendedAction: 'Monitor water gauge reports and prepare family evacuation pack.',
    createdBy: 'Duty Officer Jayawardena',
    status: WarningStatus.DRAFT,
  });

  it('GET /api/warnings/hazards should return verified hazards list', async () => {
    const res = await request(app).get('/api/warnings/hazards');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('POST /api/warnings should validate input and create a draft warning', async () => {
    const res = await request(app)
      .post('/api/warnings')
      .set('x-user-role', UserRole.DMC_OFFICER)
      .send(validPayload());

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.warningId).toBeDefined();
    expect(res.body.data.status).toBe(WarningStatus.DRAFT);
  });

  it('POST /api/warnings should return 400 when required fields are missing', async () => {
    const incomplete = { ...validPayload() };
    delete (incomplete as any).message;

    const res = await request(app)
      .post('/api/warnings')
      .set('x-user-role', UserRole.DMC_OFFICER)
      .send(incomplete);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('POST /api/warnings should return 400 for invalid warning level', async () => {
    const invalid = { ...validPayload(), warningLevel: 'SUPER_CRITICAL' };

    const res = await request(app)
      .post('/api/warnings')
      .set('x-user-role', UserRole.DMC_OFFICER)
      .send(invalid);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/warnings should return list of warnings', async () => {
    await request(app)
      .post('/api/warnings')
      .set('x-user-role', UserRole.DMC_OFFICER)
      .send(validPayload());

    const res = await request(app).get('/api/warnings');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(1);
  });

  it('GET /api/warnings/:id should return single warning with details', async () => {
    const created = await request(app)
      .post('/api/warnings')
      .set('x-user-role', UserRole.DMC_OFFICER)
      .send(validPayload());

    const id = created.body.data._id;
    const res = await request(app).get(`/api/warnings/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.warningId).toBe(created.body.data.warningId);
  });

  it('PATCH /api/warnings/:id should update warning content', async () => {
    const created = await request(app)
      .post('/api/warnings')
      .set('x-user-role', UserRole.DMC_OFFICER)
      .send(validPayload());

    const id = created.body.data._id;
    const res = await request(app)
      .patch(`/api/warnings/${id}`)
      .set('x-user-role', UserRole.DMC_OFFICER)
      .send({
        message: 'Updated safety message: river reached critical gauge reading.',
        warningLevel: WarningLevel.WARNING,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.warningLevel).toBe(WarningLevel.WARNING);
  });

  it('PATCH /api/warnings/:id/status should update lifecycle status', async () => {
    const created = await request(app)
      .post('/api/warnings')
      .set('x-user-role', UserRole.DMC_OFFICER)
      .send(validPayload());

    const id = created.body.data._id;

    // Publish
    const pubRes = await request(app)
      .patch(`/api/warnings/${id}/status`)
      .set('x-user-role', UserRole.DMC_OFFICER)
      .send({ status: WarningStatus.PUBLISHED });

    expect(pubRes.status).toBe(200);
    expect(pubRes.body.data.status).toBe(WarningStatus.PUBLISHED);

    // Activate
    const actRes = await request(app)
      .patch(`/api/warnings/${id}/status`)
      .set('x-user-role', UserRole.DMC_OFFICER)
      .send({ status: WarningStatus.ACTIVE });

    expect(actRes.status).toBe(200);
    expect(actRes.body.data.status).toBe(WarningStatus.ACTIVE);
  });

  it('GET /api/warnings/:id/notifications should return tracking data', async () => {
    const created = await request(app)
      .post('/api/warnings')
      .set('x-user-role', UserRole.DMC_OFFICER)
      .send({ ...validPayload(), status: WarningStatus.PUBLISHED });

    const id = created.body.data._id;
    const res = await request(app).get(`/api/warnings/${id}/notifications`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary).toBeDefined();
    expect(res.body.data.summary.targetCitizens).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data.notifications)).toBe(true);
  });

  it('POST /api/warnings/:id/notifications/simulate should progress pending deliveries', async () => {
    const created = await request(app)
      .post('/api/warnings')
      .set('x-user-role', UserRole.DMC_OFFICER)
      .send({ ...validPayload(), status: WarningStatus.PUBLISHED });

    const id = created.body.data._id;
    const res = await request(app).post(`/api/warnings/${id}/notifications/simulate`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.summary).toBeDefined();
  });

  it('GET /api/warnings/:id should handle service errors and return 404 with error payload', async () => {
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/warnings/${nonExistentId}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('WARNING_NOT_FOUND');
  });
});
