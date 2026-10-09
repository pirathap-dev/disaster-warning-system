import request from 'supertest';
import app from '../app';
import { signAuthToken } from '../middleware/auth';
import { UserRole } from '../types';

function authorization(role: UserRole, id = 'user-1') {
  return `Bearer ${signAuthToken({ id, name: 'Test User', email: `${id}@example.test`, role })}`;
}

describe('backend role-based access control', () => {
  it('requires a valid login token', async () => {
    const response = await request(app).get('/api/reports');
    expect(response.status).toBe(401);
  });

  it('blocks roles outside the report read and submit permissions', async () => {
    const response = await request(app)
      .get('/api/reports')
      .set('Authorization', authorization(UserRole.DISTRICT_OFFICER));
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('blocks citizen writes to officer and organization operations', async () => {
    const token = authorization(UserRole.CITIZEN);
    const [assignment, allocation, stock, occupancy] = await Promise.all([
      request(app).post('/api/rescue/assignments').set('Authorization', token).send({}),
      request(app).post('/api/relief-allocations').set('Authorization', token).send({}),
      request(app).post('/api/relief-resources').set('Authorization', token).send({}),
      request(app).patch('/api/shelters/507f1f77bcf86cd799439011/occupancy').set('Authorization', token).send({ currentOccupancy: 10 }),
    ]);
    expect([assignment, allocation, stock, occupancy].map((response) => response.status)).toEqual([403, 403, 403, 403]);
    expect([assignment, allocation, stock, occupancy].every((response) => response.body.error.code === 'FORBIDDEN')).toBe(true);
  });

  it('allows only resource organizations to manage stock records', async () => {
    const response = await request(app)
      .patch('/api/relief-resources/507f1f77bcf86cd799439011')
      .set('Authorization', authorization(UserRole.DISTRICT_OFFICER))
      .send({ availableQuantity: 20 });
    expect(response.status).toBe(403);
  });
});