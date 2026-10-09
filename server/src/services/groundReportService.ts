import { GroundReportModel, GroundReportDocument } from '../models/GroundReport';
import { IGroundReport, ReportStatus, DisasterType, Location } from '../types';

// Haversine formula to calculate distance between two points in kilometers
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export class GroundReportService {
  
  static async checkDuplicate(disasterType: DisasterType, location: Location): Promise<GroundReportDocument | null> {
    // A report is a potential duplicate if created within the last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    
    const recentReports = await GroundReportModel.find({
      disasterType,
      createdAt: { $gte: twoHoursAgo }
    }).exec();

    // Check distance (threshold 1 km)
    for (const report of recentReports) {
      const distance = getDistanceFromLatLonInKm(
        location.latitude, location.longitude,
        report.location.latitude, report.location.longitude
      );
      if (distance <= 1.0) {
        return report;
      }
    }
    return null;
  }

  static async createReport(data: Partial<IGroundReport>): Promise<GroundReportDocument> {
    const duplicate = await this.checkDuplicate(data.disasterType!, data.location!);
    
    const reportData = { ...data };
    if (duplicate) {
      reportData.isDuplicate = true;
      reportData.duplicateOf = duplicate._id?.toString();
    }
    
    reportData.status = ReportStatus.SUBMITTED;
    const report = new GroundReportModel(reportData);
    return await report.save();
  }

  static async getReports(filters: any = {}): Promise<GroundReportDocument[]> {
    return await GroundReportModel.find(filters).sort({ createdAt: -1 }).exec();
  }

  static async getReportById(id: string): Promise<GroundReportDocument | null> {
    return await GroundReportModel.findById(id).exec();
  }

  static isValidTransition(currentStatus: ReportStatus, newStatus: ReportStatus): boolean {
    const validTransitions: Record<ReportStatus, ReportStatus[]> = {
      [ReportStatus.SUBMITTED]: [ReportStatus.UNDER_REVIEW],
      [ReportStatus.UNDER_REVIEW]: [ReportStatus.VERIFIED, ReportStatus.REJECTED, ReportStatus.NEEDS_MORE_INFO],
      [ReportStatus.NEEDS_MORE_INFO]: [ReportStatus.UNDER_REVIEW],
      [ReportStatus.VERIFIED]: [],
      [ReportStatus.REJECTED]: [],
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  static async updateStatus(
    id: string, 
    newStatus: ReportStatus, 
    reviewerId: string, 
    remarks?: string
  ): Promise<GroundReportDocument> {
    const report = await GroundReportModel.findById(id).exec();
    if (!report) {
      throw { statusCode: 404, message: 'Report not found', code: 'NOT_FOUND' };
    }

    if (!this.isValidTransition(report.status as ReportStatus, newStatus)) {
      throw { statusCode: 400, message: `Invalid status transition from ${report.status} to ${newStatus}`, code: 'INVALID_TRANSITION' };
    }

    report.status = newStatus;
    
    // If it's a final review or transition back to review, log the reviewer
    report.reviewerId = reviewerId;
    
    if (remarks) {
      report.verificationRemarks = remarks;
    }

    if ([ReportStatus.VERIFIED, ReportStatus.REJECTED, ReportStatus.NEEDS_MORE_INFO].includes(newStatus)) {
      report.verificationTimestamp = new Date();
    }

    return await report.save();
  }
}
