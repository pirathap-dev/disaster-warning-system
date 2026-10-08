import request from 'supertest';
import app from '../app';
import {
  confirmReliefReceipt,
  createReliefAllocation,
  getReliefAllocationById,
  getReliefAllocations,
  getReliefResources,
  getShelterById,
  getShelters,
  updateReliefAllocationStatus,
} from '../services/reliefService';
import { ReliefAllocationStatus } from '../types';

jest.mock('../services/reliefService', () => ({
  confirmReliefReceipt: jest.fn(),
  createReliefAllocation: jest.fn(),
  getReliefAllocationById: jest.fn(),
  getReliefAllocations: jest.fn(),
  getReliefResources: jest.fn(),
  getShelterById: jest.fn(),
  getShelters: jest.fn(),
  updateReliefAllocationStatus: jest.fn(),
}));

const services = {
  confirmReceipt: confirmReliefReceipt as jest.Mock,
  createAllocation: createReliefAllocation as jest.Mock,
  getAllocation: getReliefAllocationById as jest.Mock,
  getAllocations: getReliefAllocations as jest.Mock,
  getResources: getReliefResources as jest.Mock,
  getShelter: getShelterById as jest.Mock,
  getShelters: getShelters as jest.Mock,
  updateStatus: updateReliefAllocationStatus as jest.Mock,
};

const validId = '507f1f77bcf86cd799439011';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('shelter and resource endpoints', () => {
  it('returns the shelter list in the API response shape', async () => {
    services.getShelters.mockResolvedValue([{ _id: validId, name: 'Central Shelter' }]);
    const response = await request(app).get('/api/shelters');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      success: true,
      data: [{ _id: validId, name: 'Central Shelter' }],
    });
  });

  it('validates shelter IDs before retrieval', async () => {
    const response = await request(app).get('/api/shelters/not-an-id');
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_ID');
    expect(services.getShelter).not.toHaveBeenCalled();
  });

  it('returns a shelter by ID', async () => {
    services.getShelter.mockResolvedValue({ _id: validId, availableCapacity: 80 });
    const response = await request(app).get(`/api/shelters/${validId}`);
    expect(response.status).toBe(200);
    expect(services.getShelter).toHaveBeenCalledWith(validId);
  });

  it('returns resource inventory', async () => {
    services.getResources.mockResolvedValue([{ name: 'Water', availableQuantity: 1000 }]);
    const response = await request(app).get('/api/relief-resources');
    expect(response.status).toBe(200);
    expect(response.body.data[0].availableQuantity).toBe(1000);
  });
});

describe('relief allocation endpoints', () => {
  it('validates required allocation fields and IDs', async () => {
    const missing = await request(app).post('/api/relief-allocations').send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('VALIDATION_ERROR');

    const invalidIds = await request(app).post('/api/relief-allocations').send({
      shelterId: 'bad',
      resourceId: 'bad',
      requestedQuantity: 10,
      createdBy: 'Officer',
    });
    expect(invalidIds.status).toBe(400);
    expect(invalidIds.body.error.code).toBe('INVALID_ID');
    expect(services.createAllocation).not.toHaveBeenCalled();

    const nonObjectBody = await request(app)
      .post('/api/relief-allocations')
      .set('Content-Type', 'application/json')
      .send('null');
    expect(nonObjectBody.status).toBe(400);
  });

  it('creates a valid allocation', async () => {
    services.createAllocation.mockResolvedValue({
      _id: validId,
      status: ReliefAllocationStatus.ALLOCATED,
    });
    const response = await request(app).post('/api/relief-allocations').send({
      shelterId: validId,
      resourceId: validId,
      requestedQuantity: 20,
      createdBy: 'District Officer',
      notes: 'Priority delivery',
    });
    expect(response.status).toBe(201);
    expect(response.body.data.status).toBe('ALLOCATED');
    expect(services.createAllocation).toHaveBeenCalledWith({
      shelterId: validId,
      resourceId: validId,
      requestedQuantity: 20,
      createdBy: 'District Officer',
      notes: 'Priority delivery',
    });
  });

  it('rejects invalid list filters and passes valid filters to service', async () => {
    const invalid = await request(app).get('/api/relief-allocations?status=UNKNOWN');
    expect(invalid.status).toBe(400);

    services.getAllocations.mockResolvedValue([]);
    const response = await request(app)
      .get(`/api/relief-allocations?shelterId=${validId}&status=DISPATCHED`);
    expect(response.status).toBe(200);
    expect(services.getAllocations).toHaveBeenCalledWith({
      shelterId: validId,
      resourceId: undefined,
      status: ReliefAllocationStatus.DISPATCHED,
    });
  });

  it('returns allocation details after validating its ID', async () => {
    const invalid = await request(app).get('/api/relief-allocations/nope');
    expect(invalid.status).toBe(400);

    services.getAllocation.mockResolvedValue({ _id: validId });
    const response = await request(app).get(`/api/relief-allocations/${validId}`);
    expect(response.status).toBe(200);
    expect(services.getAllocation).toHaveBeenCalledWith(validId);
  });

  it('validates and applies allocation status updates', async () => {
    const invalid = await request(app)
      .patch(`/api/relief-allocations/${validId}/status`)
      .send({ status: 'UNKNOWN' });
    expect(invalid.status).toBe(400);

    services.updateStatus.mockResolvedValue({ _id: validId, status: 'DISPATCHED' });
    const response = await request(app)
      .patch(`/api/relief-allocations/${validId}/status`)
      .send({ status: 'DISPATCHED' });
    expect(response.status).toBe(200);
    expect(services.updateStatus).toHaveBeenCalledWith(validId, ReliefAllocationStatus.DISPATCHED);
  });

  it('validates and confirms receipt quantities', async () => {
    const invalid = await request(app)
      .patch(`/api/relief-allocations/${validId}/receipt`)
      .send({ receivedQuantity: 'many' });
    expect(invalid.status).toBe(400);
    expect(services.confirmReceipt).not.toHaveBeenCalled();

    services.confirmReceipt.mockResolvedValue({ _id: validId, status: 'RECEIVED' });
    const response = await request(app)
      .patch(`/api/relief-allocations/${validId}/receipt`)
      .send({ receivedQuantity: 18, notes: 'Received in good condition' });
    expect(response.status).toBe(200);
    expect(services.confirmReceipt).toHaveBeenCalledWith(validId, 18, 'Received in good condition');
  });

  it('returns service errors through the shared error handler', async () => {
    services.getShelters.mockRejectedValue({
      message: 'Database unavailable',
      statusCode: 503,
      code: 'DATABASE_UNAVAILABLE',
      stack: 'test stack',
    });
    const response = await request(app).get('/api/shelters');
    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      success: false,
      error: { message: 'Database unavailable', code: 'DATABASE_UNAVAILABLE' },
    });
  });
});
