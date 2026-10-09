import { GroundReportModel, GroundReportDocument } from '../models/GroundReport';
import { HazardModel } from '../models/Hazard';
import { IGroundReport, ReportStatus, DisasterType, Location, SeverityLevel } from '../types';

// Haversine formula to calculate distance between two points in kilometers
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

// Statuses that a citizen can still edit/delete
const EDITABLE_STATUSES: ReportStatus[] = [ReportStatus.UNDER_REVIEW, ReportStatus.NEEDS_MORE_INFO];

export class GroundReportService {

  static async checkDuplicate(disasterType: DisasterType, location: Location, excludeId?: string): Promise<GroundReportDocument | null> {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const query: any = { disasterType, createdAt: { $gte: twoHoursAgo } };
    if (excludeId) query._id = { $ne: excludeId };

    const recentReports = await GroundReportModel.find(query).exec();

    for (const report of recentReports) {
      const distance = getDistanceFromLatLonInKm(
        location.latitude, location.longitude,
        report.location.latitude, report.location.longitude
      );
      if (distance <= 1.0) return report;
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

    reportData.status = ReportStatus.PENDING;
    const report = new GroundReportModel(reportData);
    return await report.save();
  }

  static async getReports(filters: Record<string, unknown> = {}): Promise<GroundReportDocument[]> {
    return await GroundReportModel.find(filters).sort({ createdAt: -1 }).exec();
  }

  static async getReportById(id: string): Promise<GroundReportDocument | null> {
    return await GroundReportModel.findById(id).exec();
  }

  /**
   * Edit a report — only allowed while it is in an editable status.
   * Runs duplicate check again excluding this report itself.
   */
  static async editReport(
    id: string,
    reporterId: string,
    updates: Partial<Pick<IGroundReport, 'disasterType' | 'description' | 'severity' | 'imageUrl' | 'location'>>
  ): Promise<GroundReportDocument> {
    const report = await GroundReportModel.findById(id).exec();
    if (!report) throw { statusCode: 404, message: 'Report not found', code: 'NOT_FOUND' };
    if (report.reporterId !== reporterId) throw { statusCode: 403, message: 'You can only edit your own reports', code: 'FORBIDDEN' };
    if (!EDITABLE_STATUSES.includes(report.status as ReportStatus)) {
      throw { statusCode: 400, message: `Cannot edit a report with status: ${report.status}`, code: 'EDIT_NOT_ALLOWED' };
    }

    // Re-check duplicate after location/type change
    const locationToCheck = updates.location ?? report.location;
    const typeToCheck = (updates.disasterType ?? report.disasterType) as DisasterType;
    const duplicate = await this.checkDuplicate(typeToCheck, locationToCheck, id);

    if (updates.disasterType) report.disasterType = updates.disasterType;
    if (updates.description) report.description = updates.description;
    if (updates.severity) report.severity = updates.severity;
    if (updates.imageUrl !== undefined) report.imageUrl = updates.imageUrl;
    if (updates.location) report.location = updates.location;

    report.isDuplicate = !!duplicate;
    report.duplicateOf = duplicate?._id?.toString();

    return await report.save();
  }

  /**
   * Delete a report — only allowed while it is in an editable status.
   */
  static async deleteReport(id: string, reporterId: string): Promise<void> {
    const report = await GroundReportModel.findById(id).exec();
    if (!report) throw { statusCode: 404, message: 'Report not found', code: 'NOT_FOUND' };
    if (report.reporterId !== reporterId) throw { statusCode: 403, message: 'You can only delete your own reports', code: 'FORBIDDEN' };
    if (!EDITABLE_STATUSES.includes(report.status as ReportStatus)) {
      throw { statusCode: 400, message: `Cannot delete a report with status: ${report.status}`, code: 'DELETE_NOT_ALLOWED' };
    }
    await GroundReportModel.findByIdAndDelete(id).exec();
  }

  static isValidTransition(currentStatus: ReportStatus, newStatus: ReportStatus): boolean {
    const validTransitions: Record<ReportStatus, ReportStatus[]> = {
      [ReportStatus.SUBMITTED]: [ReportStatus.UNDER_REVIEW], // kept for backward compat
      [ReportStatus.PENDING]: [ReportStatus.VERIFIED, ReportStatus.REJECTED, ReportStatus.NEEDS_MORE_INFO],
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
    if (!report) throw { statusCode: 404, message: 'Report not found', code: 'NOT_FOUND' };

    if (!this.isValidTransition(report.status as ReportStatus, newStatus)) {
      throw { statusCode: 400, message: `Invalid status transition from ${report.status} to ${newStatus}`, code: 'INVALID_TRANSITION' };
    }

    report.status = newStatus;
    report.reviewerId = reviewerId;
    if (remarks) report.verificationRemarks = remarks;

    if ([ReportStatus.VERIFIED, ReportStatus.REJECTED, ReportStatus.NEEDS_MORE_INFO].includes(newStatus)) {
      report.verificationTimestamp = new Date();
    }

    const savedReport = await report.save();

    if (newStatus === ReportStatus.VERIFIED) {
      const locationLabel = report.location.address?.trim() ||
        `${report.location.latitude.toFixed(5)}, ${report.location.longitude.toFixed(5)}`;
      await HazardModel.findOneAndUpdate(
        { sourceReportId: report._id },
        {
          $set: {
            title: `${report.disasterType} Ground Report`,
            disasterType: report.disasterType,
            severity: report.severity,
            location: {
              district: locationLabel,
              address: report.location.address,
              latitude: report.location.latitude,
              longitude: report.location.longitude,
            },
            description: report.description,
            status: report.status,
            sourceReportId: report._id,
            verifiedBy: reviewerId,
            verifiedAt: report.verificationTimestamp,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).exec();
    }

    return savedReport;
  }
}
