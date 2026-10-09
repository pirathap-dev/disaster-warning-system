export enum UserRole {
  CITIZEN = 'CITIZEN',
  VOLUNTEER = 'VOLUNTEER',
  DMC_DUTY_OFFICER = 'DMC_DUTY_OFFICER',
  DMC_OFFICER = 'DMC_OFFICER',
  DISTRICT_OFFICER = 'DISTRICT_OFFICER',
  RESCUE_TEAM = 'RESCUE_TEAM',
  SHELTER_COORDINATOR = 'SHELTER_COORDINATOR',
  RESOURCE_ORGANIZATION = 'RESOURCE_ORGANIZATION',
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  district?: string;
  testAccess?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum ReportStatus {
  SUBMITTED = 'SUBMITTED',
  PENDING = 'PENDING',
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
  _id: string;
  reporterId: string;
  disasterType: DisasterType;
  description: string;
  severity: SeverityLevel;
  imageUrl?: string;
  location: Location;
  status: ReportStatus;
  isDuplicate?: boolean;
  duplicateOf?: string;
  reviewerId?: string;
  verificationRemarks?: string;
  verificationTimestamp?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: unknown;
  };
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
  verifiedAt?: Date | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
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
  startTime: string | Date;
  expiryTime: string | Date;
  recommendedAction: string;
  createdBy: string;
  status: WarningStatus;
  publishedTimestamp?: string | Date;
  updatedTimestamp?: string | Date;
  cancelledTimestamp?: string | Date;
  cancellationReason?: string;
  deliverySummary?: IWarningDeliverySummary;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface INotificationRecord {
  _id?: string;
  id?: string;
  warningId: string;
  channel: NotificationChannel;
  recipientIdentifier: string;
  targetArea: string;
  status: NotificationDeliveryStatus;
  sentAt?: string | Date;
  deliveredAt?: string | Date;
  failureReason?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}
