export enum UserRole {
  CITIZEN = 'CITIZEN',
  DMC_OFFICER = 'DMC_OFFICER',
  DISTRICT_OFFICER = 'DISTRICT_OFFICER',
  SHELTER_COORDINATOR = 'SHELTER_COORDINATOR',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  district?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
  };
}

export enum ReportStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

export enum WarningLevel {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// ... more types to be added by other devs
