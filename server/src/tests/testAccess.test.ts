import request from 'supertest';
import app from '../app';
import { signAuthToken } from '../middleware/auth';
import { UserModel } from '../models/User';
import { UserRole } from '../types';

jest.mock('../models/User', () => ({ UserModel: { findOne: jest.fn() } }));

const userModel = UserModel as jest.Mocked<typeof UserModel>;
const previousFlag = process.env.ENABLE_TEST_ACCESS;
const previousEnvironment = process.env.NODE_ENV;

afterEach(() => {
  if (previousFlag === undefined) delete process.env.ENABLE_TEST_ACCESS;
  else process.env.ENABLE_TEST_ACCESS = previousFlag;
  process.env.NODE_ENV = previousEnvironment;
  jest.resetAllMocks();
});

describe('demo-only test access', () => {
  it('returns 404 when test access is disabled', async () => {
    delete process.env.ENABLE_TEST_ACCESS;
    process.env.NODE_ENV = 'development';

    const response = await request(app).post('/api/auth/test-login').send({ role: UserRole.CITIZEN });

    expect(response.status).toBe(404);
    expect(userModel.findOne).not.toHaveBeenCalled();
  });

  it('returns 404 in production even when the flag is set', async () => {
    process.env.ENABLE_TEST_ACCESS = 'true';
    process.env.NODE_ENV = 'production';

    const response = await request(app).post('/api/auth/test-login').send({ role: UserRole.CITIZEN });

    expect(response.status).toBe(404);
    expect(userModel.findOne).not.toHaveBeenCalled();
  });

  it('creates a regular signed test session for a seeded role account', async () => {
    process.env.ENABLE_TEST_ACCESS = 'true';
    process.env.NODE_ENV = 'development';
    (userModel.findOne as jest.Mock).mockReturnValue({
      exec: jest.fn().mockResolvedValue({
        _id: '507f1f77bcf86cd799439011',
        name: 'Citizen Test',
        email: 'citizen.test@dwecs.local',
        role: UserRole.CITIZEN,
        district: 'Colombo',
      }),
    });

    const response = await request(app).post('/api/auth/test-login').send({ role: UserRole.CITIZEN });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({ role: UserRole.CITIZEN, testAccess: true });
    const me = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${response.body.data.token}`);
    expect(me.status).toBe(200);
    expect(me.body.data).toMatchObject({ role: UserRole.CITIZEN, testAccess: true });
  });

  it('rejects test tokens after the flag is switched off', async () => {
    process.env.ENABLE_TEST_ACCESS = 'true';
    process.env.NODE_ENV = 'development';
    const token = signAuthToken({
      id: 'test-user',
      name: 'Test User',
      email: 'citizen.test@dwecs.local',
      role: UserRole.CITIZEN,
      testAccess: true,
    });
    delete process.env.ENABLE_TEST_ACCESS;

    const response = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(401);
  });
});