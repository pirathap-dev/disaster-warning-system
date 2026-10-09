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
  SUBMITTED = 'SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  NEEDS_MORE_INFO = 'NEEDS_MORE_INFO',
}

export enum SeverityLevel {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum DisasterType {
  FLOOD = 'FLOOD',
  EARTHQUAKE = 'EARTHQUAKE',
  FIRE = 'FIRE',
  TSUNAMI = 'TSUNAMI',
  CYCLONE = 'CYCLONE',
  OTHER = 'OTHER',
}

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface IGroundReport {
  _id?: string;
  reporterId: string; // Citizen
  disasterType: DisasterType;
  description: string;
  severity: SeverityLevel;
  imageUrl?: string;
  location: Location;
  status: ReportStatus;
  isDuplicate?: boolean;
  duplicateOf?: string;
  reviewerId?: string; // DMC Officer
  verificationRemarks?: string;
  verificationTimestamp?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export enum WarningLevel {
  LOW = 'LOW',
  MODERATE = 'MODERATE',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum ShelterStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
}

export enum ShelterCapacityStatus {
  OPEN = 'OPEN',
  NEAR_FULL = 'NEAR_FULL',
  FULL = 'FULL',
  CLOSED = 'CLOSED',
}

export enum ReliefAllocationStatus {
  REQUESTED = 'REQUESTED',
  ALLOCATED = 'ALLOCATED',
  DISPATCHED = 'DISPATCHED',
  RECEIVED = 'RECEIVED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// ... more types to be added by other devs
