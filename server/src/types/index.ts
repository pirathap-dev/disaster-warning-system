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
    details?: any;
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
  WATCH = 'WATCH',
  WARNING = 'WARNING',
  EVACUATE = 'EVACUATE',
}

export enum WarningStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ACTIVE = 'ACTIVE',
  UPDATED = 'UPDATED',
  EXPIRED = 'EXPIRED',
  CANCELLED = 'CANCELLED',
}

export enum WarningPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
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

export enum NotificationChannel {
  PUSH = 'PUSH',
  SMS = 'SMS',
  AUDIBLE = 'AUDIBLE',
}

export enum NotificationDeliveryStatus {
  PENDING = 'PENDING',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
}

export interface IHazard {
  _id?: string;
  id?: string;
  title: string;
  disasterType: string;
  severity: string;
  location: {
    district: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  description: string;
  status: ReportStatus;
  verifiedBy?: string;
  verifiedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IWarningDeliverySummary {
  targetCitizens: number;
  delivered: number;
  failed: number;
  pending: number;
  channelBreakdown?: Record<string, {
    target: number;
    delivered: number;
    failed: number;
    pending: number;
  }>;
}

export interface IWarning {
  _id?: string;
  id?: string;
  warningId: string;
  hazardId: string;
  hazard?: IHazard;
  warningLevel: WarningLevel;
  priority: WarningPriority;
  message: string;
  affectedArea: string;
  startTime: Date;
  expiryTime: Date;
  recommendedAction: string;
  createdBy: string;
  status: WarningStatus;
  publishedTimestamp?: Date;
  updatedTimestamp?: Date;
  cancelledTimestamp?: Date;
  cancellationReason?: string;
  deliverySummary?: IWarningDeliverySummary;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface INotificationRecord {
  _id?: string;
  id?: string;
  warningId: string;
  channel: NotificationChannel;
  recipientIdentifier: string;
  targetArea: string;
  status: NotificationDeliveryStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
