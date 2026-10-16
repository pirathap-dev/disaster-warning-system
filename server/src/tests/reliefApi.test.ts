import supertest from 'supertest';
import app from '../app';
import { signAuthToken } from '../middleware/auth';
import {
  confirmReliefReceipt,
  createReliefAllocation,
  createReliefAllocations,
  createShelter,
  getCoordinatorShelterRequests,
  getReliefAllocationById,
  getReliefAllocations,
  getReliefResources,
  getShelterById,
  getShelters,
  requestShelterCoordinator,
  respondToCoordinatorShelterRequest,
  updateReliefAllocationStatus,
} from '../services/reliefService';
import { ReliefAllocationStatus, UserRole } from '../types';

const officerToken = signAuthToken({
  id: 'district-officer',
  name: 'District Officer',
  email: 'officer@example.test',
  role: UserRole.DISTRICT_OFFICER,
});
const request = (application: typeof app) => ({
  get: (path: string) => supertest(application).get(path).set('Authorization', `Bearer ${officerToken}`),
  post: (path: string) => supertest(application).post(path).set('Authorization', `Bearer ${officerToken}`),
  patch: (path: string) => supertest(application).patch(path).set('Authorization', `Bearer ${officerToken}`),
});

const coordinatorPatch = (application: typeof app, path: string) => {
  const token = signAuthToken({
    id: 'shelter-coordinator',
    name: 'Shelter Coordinator',
    email: 'coordinator@example.test',
    role: UserRole.SHELTER_COORDINATOR,
  });
  return supertest(application)
    .patch(path)
    .set('Authorization', 'Bearer ' + token);
};
const coordinatorRequestGet = (application: typeof app, path: string) => {
  const token = signAuthToken({
    id: 'shelter-coordinator',
    name: 'Shelter Coordinator',
    email: 'coordinator@example.test',
    role: UserRole.SHELTER_COORDINATOR,
  });
  return supertest(application).get(path).set('Authorization', 'Bearer ' + token);
};

jest.mock('../services/reliefService', () => ({
  confirmReliefReceipt: jest.fn(),
  createReliefAllocation: jest.fn(),
  createReliefAllocations: jest.fn(),
  createShelter: jest.fn(),
  getCoordinatorShelterRequests: jest.fn(),
  getReliefAllocationById: jest.fn(),
  getReliefAllocations: jest.fn(),
  getReliefResources: jest.fn(),
  getShelterById: jest.fn(),
  getShelters: jest.fn(),
  requestShelterCoordinator: jest.fn(),
  respondToCoordinatorShelterRequest: jest.fn(),
  updateReliefAllocationStatus: jest.fn(),
}));

const services = {
  confirmReceipt: confirmReliefReceipt as jest.Mock,
  createAllocation: createReliefAllocation as jest.Mock,
  createAllocations: createReliefAllocations as jest.Mock,
  createShelter: createShelter as jest.Mock,
  getCoordinatorRequests: getCoordinatorShelterRequests as jest.Mock,
  getAllocation: getReliefAllocationById as jest.Mock,
  getAllocations: getReliefAllocations as jest.Mock,
  getResources: getReliefResources as jest.Mock,
  getShelter: getShelterById as jest.Mock,
  getShelters: getShelters as jest.Mock,
  requestCoordinator: requestShelterCoordinator as jest.Mock,
  respondToCoordinatorRequest: respondToCoordinatorShelterRequest as jest.Mock,
  updateStatus: updateReliefAllocationStatus as jest.Mock,
};

const validId = '507f1f77bcf86cd799439011';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('shelter and resource endpoints', () => {
  it('validates shelter creation and creates valid shelters', async () => {
    const missing = await request(app).post('/api/shelters').send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe('INVALID_CAPACITY');

    services.createShelter.mockResolvedValue({
      _id: validId,
      name: 'Riverside Shelter',
      currentOccupancy: 0,
      capacity: 250,
    });
    const response = await request(app).post('/api/shelters').send({
      name: ' Riverside Shelter ',
      location: ' Riverside Ward ',
      capacity: 250,
    });
    expect(response.status).toBe(201);
    expect(response.body.data.name).toBe('Riverside Shelter');
    expect(services.createShelter).toHaveBeenCalledWith({
      name: 'Riverside Shelter',
      location: 'Riverside Ward',
      capacity: 250,
    });
  });

  it('creates a coordinator approval request with an optional message', async () => {
    services.requestCoordinator.mockResolvedValue({
      _id: validId,
      coordinatorRequestStatus: 'PENDING',
    });
    const response = await request(app)
      .post(`/api/shelters/${validId}/coordinator-request`)
      .send({ message: 'Please manage this school shelter' });

    expect(response.status).toBe(201);
    expect(services.requestCoordinator).toHaveBeenCalledWith(validId, {
      requestedByUserId: 'district-officer',
      message: 'Please manage this school shelter',
    });
  });

  it('rejects invalid coordinator request IDs', async () => {
    const invalidId = await request(app).post('/api/shelters/nope/coordinator-request').send({
    });
    expect(invalidId.status).toBe(400);
    expect(services.requestCoordinator).not.toHaveBeenCalled();
  });

  it('lists requests and lets the addressed coordinator accept or decline', async () => {
    services.getCoordinatorRequests.mockResolvedValue([{ _id: validId, name: 'School Shelter' }]);
    const requests = await coordinatorRequestGet(app, '/api/shelters/coordinator-requests');
    expect(requests.status).toBe(200);
    expect(services.getCoordinatorRequests).toHaveBeenCalledWith('shelter-coordinator');

    services.respondToCoordinatorRequest.mockResolvedValue({
      _id: validId,
      coordinatorRequestStatus: 'ACCEPTED',
      coordinatorUserId: 'shelter-coordinator',
    });
    const accepted = await coordinatorPatch(app, `/api/shelters/${validId}/coordinator-request`)
      .send({ decision: 'ACCEPTED' });
    expect(accepted.status).toBe(200);
    expect(services.respondToCoordinatorRequest).toHaveBeenCalledWith(
      validId,
      'shelter-coordinator',
      'ACCEPTED'
    );
  });

  it('rejects invalid coordinator decisions', async () => {
    const response = await coordinatorPatch(app, `/api/shelters/${validId}/coordinator-request`)
      .send({ decision: 'MAYBE' });
    expect(response.status).toBe(400);
    expect(services.respondToCoordinatorRequest).not.toHaveBeenCalled();
  });

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

  it('creates allocations for multiple selected resources', async () => {
    services.createAllocations.mockResolvedValue([
      { _id: validId, requestedQuantity: 20 },
      { _id: '507f1f77bcf86cd799439012', requestedQuantity: 8 },
    ]);
    const response = await request(app).post('/api/relief-allocations').send({
      shelterId: validId,
      allocations: [
        { resourceId: validId, requestedQuantity: 20 },
        { resourceId: '507f1f77bcf86cd799439012', requestedQuantity: 8 },
      ],
      createdBy: 'District Officer',
    });
    expect(response.status).toBe(201);
    expect(response.body.data).toHaveLength(2);
    expect(services.createAllocations).toHaveBeenCalledWith({
      shelterId: validId,
      allocations: [
        { resourceId: validId, requestedQuantity: 20 },
        { resourceId: '507f1f77bcf86cd799439012', requestedQuantity: 8 },
      ],
      createdBy: 'District Officer',
      notes: undefined,
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
    expect(services.getAllocation).toHaveBeenCalledWith(validId, undefined);
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
    expect(services.updateStatus).toHaveBeenCalledWith(validId, ReliefAllocationStatus.DISPATCHED, undefined);
  });

  it('validates and confirms receipt quantities', async () => {
    const invalid = await coordinatorPatch(app, `/api/relief-allocations/${validId}/receipt`)
      .send({ receivedQuantity: 'many' });
    expect(invalid.status).toBe(400);
    expect(services.confirmReceipt).not.toHaveBeenCalled();

    services.confirmReceipt.mockResolvedValue({ _id: validId, status: 'RECEIVED' });
    const response = await coordinatorPatch(app, `/api/relief-allocations/${validId}/receipt`)
      .send({ receivedQuantity: 18, notes: 'Received in good condition' });
    expect(response.status).toBe(200);
    expect(services.confirmReceipt).toHaveBeenCalledWith(
      validId,
      18,
      'Received in good condition',
      'shelter-coordinator'
    );
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
