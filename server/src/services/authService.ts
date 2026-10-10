import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { UserModel } from '../models/User';
import { UserRole } from '../types';
import { AuthenticatedUser, signAuthToken } from '../middleware/auth';
import { isTestAccessEnabled } from '../config/testAccess';

const scrypt = promisify(scryptCallback);

export class AuthServiceError extends Error {
  constructor(message: string, public statusCode: number, public code: string) {
    super(message);
  }
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await scrypt(password, salt, 64) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

async function verifyPassword(password: string, stored: string) {
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex || !/^[a-f0-9]{128}$/i.test(hashHex)) return false;
  const actual = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(hashHex, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const testAccounts: Partial<Record<UserRole, string>> = {
  [UserRole.CITIZEN]: 'citizen.test@dwecs.local',
  [UserRole.VOLUNTEER]: 'volunteer.test@dwecs.local',
  [UserRole.DMC_DUTY_OFFICER]: 'dmcofficer.test@dwecs.local',
  [UserRole.DISTRICT_OFFICER]: 'districtofficer.test@dwecs.local',
  [UserRole.RESCUE_TEAM]: 'rescueteam.test@dwecs.local',
  [UserRole.SHELTER_COORDINATOR]: 'sheltercoordinator.test@dwecs.local',
  [UserRole.RESOURCE_ORGANIZATION]: 'resourceorg.test@dwecs.local',
};

function issueSession(
  user: { _id: unknown; name: string; email: string; role: UserRole; district?: string },
  testAccess = false
) {
  const principal: AuthenticatedUser = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    district: user.district,
    ...(testAccess ? { testAccess: true } : {}),
  };
  return { token: signAuthToken(principal), user: principal };
}

export class AuthService {
  static async testLogin(role: unknown) {
    if (!isTestAccessEnabled()) {
      throw new AuthServiceError('Not found', 404, 'NOT_FOUND');
    }
    if (typeof role !== 'string' || !Object.values(UserRole).includes(role as UserRole) || !testAccounts[role as UserRole]) {
      throw new AuthServiceError('Unsupported test role.', 400, 'INVALID_TEST_ROLE');
    }
    const expectedRole = role as UserRole;
    const user = await UserModel.findOne({ email: testAccounts[expectedRole] }).exec();
    if (!user || user.role !== expectedRole) {
      throw new AuthServiceError('Test user is not seeded. Run the demo seed command.', 404, 'TEST_USER_NOT_FOUND');
    }
    return issueSession(user, true);
  }

  static async register(data: { name: string; email: string; password: string; role?: UserRole; district?: string }) {
    if (!data.name?.trim() || !data.email?.trim() || !data.password || data.password.length < 8) {
      throw new AuthServiceError('Name, email, and a password of at least 8 characters are required.', 400, 'INVALID_REGISTRATION');
    }
    const role = data.role || UserRole.CITIZEN;
    const allowedRoles = [
      UserRole.CITIZEN,
      UserRole.VOLUNTEER,
      UserRole.DMC_OFFICER,
      UserRole.SHELTER_COORDINATOR,
      UserRole.RESCUE_TEAM,
      UserRole.DISTRICT_OFFICER,
    ];
    if (!allowedRoles.includes(role)) {
      throw new AuthServiceError(
        'This role is not available for public registration.',
        403,
        'ROLE_ASSIGNMENT_FORBIDDEN'
      );
    }
    const email = data.email.trim().toLowerCase();
    if (await UserModel.exists({ email })) {
      throw new AuthServiceError('An account with this email already exists.', 409, 'EMAIL_EXISTS');
    }
    const user = await UserModel.create({
      name: data.name.trim(),
      email,
      passwordHash: await hashPassword(data.password),
      role,
      district: data.district?.trim(),
    });
    return issueSession(user);
  }

  static async login(email: string, password: string) {
    const user = await UserModel.findOne({ email: email?.trim().toLowerCase() }).exec();
    if (!user || !(await verifyPassword(password || '', user.passwordHash))) {
      throw new AuthServiceError('Email or password is incorrect.', 401, 'INVALID_CREDENTIALS');
    }
    return issueSession(user);
  }
}