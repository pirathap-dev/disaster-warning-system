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

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code: string;
    details?: unknown[];
  };
}
