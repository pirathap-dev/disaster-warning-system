import request from 'supertest';
import app from '../app';
import { AuthService } from '../services/authService';
import { UserRole } from '../types';

jest.mock('../services/authService', () => ({
  AuthService: {
    register: jest.fn(),
    login: jest.fn(),
    testLogin: jest.fn(),
  },
}));

const registerMock = jest.mocked(AuthService.register);

describe('registration role validation', () => {
  beforeEach(() => {
    registerMock.mockResolvedValue({
      token: 'registration-token',
      user: {
        id: 'demo-user',
        name: 'Demo User',
        email: 'demo@example.com',
        role: UserRole.CITIZEN,
      },
    } as never);
  });

  it.each([
    UserRole.DMC_OFFICER,
    UserRole.SHELTER_COORDINATOR,
    UserRole.RESCUE_TEAM,
    UserRole.DISTRICT_OFFICER,
  ])('accepts %s as a registration role', async (role) => {
    const response = await request(app).post('/api/auth/register').send({
      name: 'Demo User',
      email: 'demo@example.com',
      password: 'demo-password',
      role,
    });

    expect(response.status).toBe(201);
    expect(registerMock).toHaveBeenCalledWith(expect.objectContaining({ role }));
  });
});
