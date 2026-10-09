import request from 'supertest';
import app from '../app';
import { GroundReportService } from '../services/groundReportService';
import { DisasterType, SeverityLevel, ReportStatus } from '../types';

jest.mock('../services/groundReportService');

describe('GroundReportRoutes Validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const validPayload = {
    reporterId: 'user1',
    disasterType: DisasterType.FLOOD,
    description: 'Help needed',
    severity: SeverityLevel.MODERATE,
    location: { latitude: 10, longitude: 20 }
  };

  it('should validate correctly and call service on POST /api/reports', async () => {
    (GroundReportService.createReport as jest.Mock).mockResolvedValue({ _id: '1', ...validPayload });

    const res = await request(app)
      .post('/api/reports')
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(GroundReportService.createReport).toHaveBeenCalled();
  });

  it('should fail validation when disaster type is missing', async () => {
    const payload = { ...validPayload };
    delete (payload as any).disasterType;

    const res = await request(app)
      .post('/api/reports')
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ msg: 'Invalid disaster type', path: 'disasterType' })
      ])
    );
  });

  it('should fail validation when location coordinates are invalid', async () => {
    const payload = { ...validPayload, location: { latitude: 200, longitude: 20 } }; // lat > 90

    const res = await request(app)
      .post('/api/reports')
      .send(payload);

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ msg: 'Valid latitude is required', path: 'location.latitude' })
      ])
    );
  });

  it('should validate status updates', async () => {
    (GroundReportService.updateStatus as jest.Mock).mockResolvedValue({ _id: '1', status: ReportStatus.VERIFIED });

    const res = await request(app)
      .patch('/api/reports/1/status')
      .send({ status: ReportStatus.VERIFIED, reviewerId: 'officer1' });

    expect(res.status).toBe(200);
    expect(GroundReportService.updateStatus).toHaveBeenCalledWith('1', ReportStatus.VERIFIED, 'officer1', undefined);
  });

  it('should fail status update if reviewer is missing', async () => {
    const res = await request(app)
      .patch('/api/reports/1/status')
      .send({ status: ReportStatus.VERIFIED });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ msg: 'Reviewer ID is required', path: 'reviewerId' })
      ])
    );
  });
});
