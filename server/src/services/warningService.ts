import { HazardModel } from '../models/Hazard';
import { GroundReportModel } from '../models/GroundReport';
import { WarningModel, IWarningDocument } from '../models/Warning';
import { NotificationModel } from '../models/Notification';
import { RescueIncidentModel } from '../models/RescueIncident';
import {
  WarningLevel,
  WarningPriority,
  WarningStatus,
  NotificationChannel,
  NotificationDeliveryStatus,
  ReportStatus,
  UserRole,
  IWarningDeliverySummary,
} from '../types';

export class WarningServiceError extends Error {
  statusCode: number;
  code: string;
  details?: any;

  constructor(message: string, statusCode = 400, code = 'WARNING_ERROR', details?: any) {
    super(message);
    this.name = 'WarningServiceError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export const VALID_STATUS_TRANSITIONS: Record<WarningStatus, WarningStatus[]> = {
  [WarningStatus.DRAFT]: [WarningStatus.PUBLISHED, WarningStatus.CANCELLED],
  [WarningStatus.PUBLISHED]: [WarningStatus.ACTIVE, WarningStatus.CANCELLED],
  [WarningStatus.ACTIVE]: [WarningStatus.UPDATED, WarningStatus.EXPIRED, WarningStatus.CANCELLED],
  [WarningStatus.UPDATED]: [WarningStatus.ACTIVE, WarningStatus.EXPIRED, WarningStatus.CANCELLED],
  [WarningStatus.EXPIRED]: [],
  [WarningStatus.CANCELLED]: [],
};

export class WarningService {
  /**
   * Validate user role. DMC Duty Officer is the primary actor.
   */
  static validateOfficerRole(role?: string): void {
    if (role && role !== UserRole.DMC_DUTY_OFFICER && role !== UserRole.DMC_OFFICER) {
      throw new WarningServiceError(
        'Access denied. Only DMC Duty Officers are authorized to manage public warnings.',
        403,
        'UNAUTHORIZED_ROLE'
      );
    }
  }

  /**
   * Validate start and expiry dates.
   */
  static validateDates(startTime: Date | string, expiryTime: Date | string): { start: Date; expiry: Date } {
    if (!startTime || !expiryTime) {
      throw new WarningServiceError('Both start time and expiry time are required.', 400, 'MISSING_DATE_FIELDS');
    }

    const start = new Date(startTime);
    const expiry = new Date(expiryTime);

    if (isNaN(start.getTime()) || isNaN(expiry.getTime())) {
      throw new WarningServiceError('Start time and expiry time must be valid ISO date strings.', 400, 'INVALID_DATE_FORMAT');
    }

    if (expiry.getTime() <= start.getTime()) {
      throw new WarningServiceError('Expiry time must be strictly after start time.', 400, 'EXPIRY_BEFORE_START');
    }

    return { start, expiry };
  }

  /**
   * Validate warning level according to approved levels: WATCH, WARNING, EVACUATE.
   */
  static validateWarningLevel(level: string): WarningLevel {
    if (!level || !Object.values(WarningLevel).includes(level as WarningLevel)) {
      throw new WarningServiceError(
        `Invalid warning level '${level}'. Approved levels are: WATCH, WARNING, EVACUATE.`,
        400,
        'INVALID_WARNING_LEVEL'
      );
    }
    return level as WarningLevel;
  }

  /**
   * Validate warning priority.
   */
  static validatePriority(priority: string): WarningPriority {
    if (!priority || !Object.values(WarningPriority).includes(priority as WarningPriority)) {
      throw new WarningServiceError(
        `Invalid priority '${priority}'. Approved priorities are: LOW, MEDIUM, HIGH, CRITICAL.`,
        400,
        'INVALID_PRIORITY'
      );
    }
    return priority as WarningPriority;
  }

  /**
   * Validate status transition.
   */
  static validateStatusTransition(currentStatus: WarningStatus, newStatus: WarningStatus): void {
    if (currentStatus === newStatus) return;

    const allowed = VALID_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(newStatus)) {
      throw new WarningServiceError(
        `Invalid status transition from '${currentStatus}' to '${newStatus}'.`,
        400,
        'INVALID_STATUS_TRANSITION',
        { currentStatus, newStatus, allowedTransitions: allowed }
      );
    }
  }

  /**
   * Check hazard existence and verified status.
   */
  static async validateHazardReference(hazardId: string) {
    if (!hazardId || hazardId.trim() === '') {
      throw new WarningServiceError('A valid related hazard reference is required.', 400, 'MISSING_HAZARD');
    }

    let hazard;
    try {
      hazard = await HazardModel.findById(hazardId).exec();
    } catch {
      throw new WarningServiceError('Invalid hazard identifier format.', 400, 'INVALID_HAZARD_ID');
    }

    if (!hazard) {
      throw new WarningServiceError(`Verified hazard with ID '${hazardId}' does not exist.`, 404, 'HAZARD_NOT_FOUND');
    }

    if (hazard.status !== ReportStatus.VERIFIED) {
      throw new WarningServiceError(
        `Hazard '${hazardId}' has status '${hazard.status}'. Public warnings can only be issued for VERIFIED hazards.`,
        400,
        'HAZARD_NOT_VERIFIED'
      );
    }

    return hazard;
  }

  /**
   * Create a new warning.
   */
  static async createWarning(data: {
    hazardId: string;
    warningLevel: string;
    priority?: string;
    message: string;
    affectedArea: string;
    startTime: string | Date;
    expiryTime: string | Date;
    recommendedAction: string;
    createdBy: string;
    status?: WarningStatus;
    userRole?: string;
  }) {
    this.validateOfficerRole(data.userRole);

    if (!data.message || data.message.trim().length < 5) {
      throw new WarningServiceError('Warning message is required and must be at least 5 characters.', 400, 'MISSING_MESSAGE');
    }

    if (!data.affectedArea || data.affectedArea.trim().length === 0) {
      throw new WarningServiceError('Affected geographic area is required.', 400, 'MISSING_AFFECTED_AREA');
    }

    if (!data.recommendedAction || data.recommendedAction.trim().length === 0) {
      throw new WarningServiceError('Recommended action is required.', 400, 'MISSING_RECOMMENDED_ACTION');
    }

    if (!data.createdBy || data.createdBy.trim().length === 0) {
      throw new WarningServiceError('Created by officer identifier is required.', 400, 'MISSING_CREATED_BY');
    }

    const { start, expiry } = this.validateDates(data.startTime, data.expiryTime);
    const warningLevel = this.validateWarningLevel(data.warningLevel);
    const priority = this.validatePriority(data.priority || WarningPriority.MEDIUM);

    await this.validateHazardReference(data.hazardId);

    const initialStatus = data.status || WarningStatus.DRAFT;
    if (initialStatus !== WarningStatus.DRAFT && initialStatus !== WarningStatus.PUBLISHED) {
      throw new WarningServiceError(
        `Initial warning status must be either DRAFT or PUBLISHED, received '${initialStatus}'.`,
        400,
        'INVALID_INITIAL_STATUS'
      );
    }

    const timestampCode = Date.now().toString().slice(-6);
    const warningId = `WRN-${new Date().getFullYear()}-${timestampCode}`;

    const warningData: any = {
      warningId,
      hazardId: data.hazardId,
      warningLevel,
      priority,
      message: data.message.trim(),
      affectedArea: data.affectedArea.trim(),
      startTime: start,
      expiryTime: expiry,
      recommendedAction: data.recommendedAction.trim(),
      createdBy: data.createdBy.trim(),
      status: initialStatus,
    };

    if (initialStatus === WarningStatus.PUBLISHED) {
      warningData.publishedTimestamp = new Date();
    }

    const warning = new WarningModel(warningData);
    const savedWarning = await warning.save();

    // If created as PUBLISHED, generate notification delivery records
    if (initialStatus === WarningStatus.PUBLISHED) {
      await this.generateNotificationRecords(savedWarning._id.toString(), savedWarning.affectedArea, savedWarning.warningLevel);
    }

    return this.enrichWarningWithSummary(savedWarning);
  }

  /**
   * Get all warnings with optional filters.
   */
  static async getWarnings(filters: { status?: string; warningLevel?: string; hazardId?: string } = {}) {
    const query: any = {};
    if (filters.status) query.status = filters.status;
    if (filters.warningLevel) query.warningLevel = filters.warningLevel;
    if (filters.hazardId) query.hazardId = filters.hazardId;

    const warnings = await WarningModel.find(query)
      .populate('hazardId')
      .sort({ createdAt: -1 })
      .exec();

    // Process auto-expiry for active/updated warnings past expiryTime
    const now = new Date();
    const enrichedList = await Promise.all(
      warnings.map(async (doc) => {
        if (
          (doc.status === WarningStatus.ACTIVE || doc.status === WarningStatus.UPDATED) &&
          now > new Date(doc.expiryTime)
        ) {
          doc.status = WarningStatus.EXPIRED;
          doc.updatedTimestamp = now;
          await doc.save();
        }
        return this.enrichWarningWithSummary(doc);
      })
    );

    return enrichedList;
  }

  /**
   * Get single warning by id or warningId.
   */
  static async getWarningById(id: string) {
    let warning;
    try {
      warning = await WarningModel.findById(id).populate('hazardId').exec();
    } catch {
      // not a mongo id, try warningId
    }

    if (!warning) {
      warning = await WarningModel.findOne({ warningId: id }).populate('hazardId').exec();
    }

    if (!warning) {
      throw new WarningServiceError(`Warning not found for identifier '${id}'.`, 404, 'WARNING_NOT_FOUND');
    }

    const now = new Date();
    if (
      (warning.status === WarningStatus.ACTIVE || warning.status === WarningStatus.UPDATED) &&
      now > new Date(warning.expiryTime)
    ) {
      warning.status = WarningStatus.EXPIRED;
      warning.updatedTimestamp = now;
      await warning.save();
    }

    return this.enrichWarningWithSummary(warning);
  }

  /**
   * Update warning content/details.
   */
  static async updateWarning(
    id: string,
    updateData: {
      message?: string;
      warningLevel?: string;
      priority?: string;
      affectedArea?: string;
      startTime?: string | Date;
      expiryTime?: string | Date;
      recommendedAction?: string;
      hazardId?: string;
    },
    userRole?: string
  ) {
    this.validateOfficerRole(userRole);

    let warning = await WarningModel.findById(id).exec();
    if (!warning) {
      warning = await WarningModel.findOne({ warningId: id }).exec();
    }

    if (!warning) {
      throw new WarningServiceError(`Warning not found for identifier '${id}'.`, 404, 'WARNING_NOT_FOUND');
    }

    if (warning.status === WarningStatus.EXPIRED || warning.status === WarningStatus.CANCELLED) {
      throw new WarningServiceError(
        `Cannot modify a warning in terminal '${warning.status}' status.`,
        400,
        'CANNOT_MODIFY_TERMINAL_WARNING'
      );
    }

    if (updateData.hazardId && updateData.hazardId !== warning.hazardId.toString()) {
      await this.validateHazardReference(updateData.hazardId);
      warning.hazardId = updateData.hazardId as any;
    }

    if (updateData.warningLevel) {
      warning.warningLevel = this.validateWarningLevel(updateData.warningLevel);
    }

    if (updateData.priority) {
      warning.priority = this.validatePriority(updateData.priority);
    }

    if (updateData.message !== undefined) {
      if (updateData.message.trim().length < 5) {
        throw new WarningServiceError('Warning message must be at least 5 characters.', 400, 'MISSING_MESSAGE');
      }
      warning.message = updateData.message.trim();
    }

    if (updateData.affectedArea !== undefined) {
      if (updateData.affectedArea.trim().length === 0) {
        throw new WarningServiceError('Affected area cannot be empty.', 400, 'MISSING_AFFECTED_AREA');
      }
      warning.affectedArea = updateData.affectedArea.trim();
    }

    if (updateData.recommendedAction !== undefined) {
      if (updateData.recommendedAction.trim().length === 0) {
        throw new WarningServiceError('Recommended action cannot be empty.', 400, 'MISSING_RECOMMENDED_ACTION');
      }
      warning.recommendedAction = updateData.recommendedAction.trim();
    }

    const newStart = updateData.startTime ? new Date(updateData.startTime) : warning.startTime;
    const newExpiry = updateData.expiryTime ? new Date(updateData.expiryTime) : warning.expiryTime;

    if (updateData.startTime || updateData.expiryTime) {
      const { start, expiry } = this.validateDates(newStart, newExpiry);
      warning.startTime = start;
      warning.expiryTime = expiry;
    }

    // Lifecycle behavior: if ACTIVE or PUBLISHED, updating marks status as UPDATED
    if (warning.status === WarningStatus.ACTIVE || warning.status === WarningStatus.PUBLISHED) {
      warning.status = WarningStatus.UPDATED;
    }

    warning.updatedTimestamp = new Date();
    const saved = await warning.save();
    return this.enrichWarningWithSummary(saved);
  }

  /**
   * Update warning status according to lifecycle transition rules.
   */
  static async updateStatus(
    id: string,
    newStatus: WarningStatus,
    options: { cancellationReason?: string; userRole?: string } = {}
  ) {
    this.validateOfficerRole(options.userRole);

    let warning = await WarningModel.findById(id).exec();
    if (!warning) {
      warning = await WarningModel.findOne({ warningId: id }).exec();
    }

    if (!warning) {
      throw new WarningServiceError(`Warning not found for identifier '${id}'.`, 404, 'WARNING_NOT_FOUND');
    }

    this.validateStatusTransition(warning.status, newStatus);

    const now = new Date();
    warning.status = newStatus;
    warning.updatedTimestamp = now;

    if (newStatus === WarningStatus.PUBLISHED) {
      warning.publishedTimestamp = now;
      // Check if notifications exist; if not, create them
      const notifCount = await NotificationModel.countDocuments({ warningId: warning._id }).exec();
      if (notifCount === 0) {
        await this.generateNotificationRecords(warning._id.toString(), warning.affectedArea, warning.warningLevel);
      }
    } else if (newStatus === WarningStatus.CANCELLED) {
      warning.cancelledTimestamp = now;
      warning.cancellationReason = options.cancellationReason || 'Cancelled by DMC Duty Officer';
    }

    const saved = await warning.save();
    if (newStatus === WarningStatus.ACTIVE) {
      const hazard = await this.validateHazardReference(String(saved.hazardId));
      const capabilitiesByHazard: Record<string, string[]> = {
        FLOOD: ['water rescue'],
        TSUNAMI: ['water rescue', 'evacuation'],
        FIRE: ['fire suppression'],
        EARTHQUAKE: ['urban search and rescue'],
        CYCLONE: ['evacuation'],
      };
      await RescueIncidentModel.findOneAndUpdate(
        { sourceWarningId: saved._id.toString() },
        {
          $setOnInsert: {
            sourceWarningId: saved._id.toString(),
            title: `${hazard.disasterType} warning response`,
            locationName: hazard.location.district,
            location: {
              latitude: hazard.location.latitude,
              longitude: hazard.location.longitude,
            },
            requiredCapabilities: capabilitiesByHazard[hazard.disasterType] || ['emergency response'],
            priority: saved.priority,
            status: 'ACTIVE',
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      ).exec();
    }
    return this.enrichWarningWithSummary(saved);
  }

  /**
   * Generate realistic notification delivery records for a published warning across channels.
   */
  static async generateNotificationRecords(
    warningId: string,
    affectedArea: string,
    warningLevel: WarningLevel,
    targetCount = 100
  ) {
    // Proportional breakdown based on severity:
    // PUSH: 45%, SMS: 45%, AUDIBLE sirens/loudspeakers: 10%
    const pushCount = Math.round(targetCount * 0.45);
    const smsCount = Math.round(targetCount * 0.45);
    const audibleCount = targetCount - pushCount - smsCount;

    const records: any[] = [];

    // Helper to generate status with realistic distribution: ~80% delivered, ~10% pending, ~10% failed
    const assignInitialStatus = (index: number) => {
      const mod = index % 10;
      if (mod < 8) return NotificationDeliveryStatus.DELIVERED;
      if (mod === 8) return NotificationDeliveryStatus.PENDING;
      return NotificationDeliveryStatus.FAILED;
    };

    // PUSH channel
    for (let i = 1; i <= pushCount; i++) {
      const status = assignInitialStatus(i);
      records.push({
        warningId,
        channel: NotificationChannel.PUSH,
        recipientIdentifier: `APP-USER-${affectedArea.slice(0, 3).toUpperCase()}-${1000 + i}`,
        targetArea: affectedArea,
        status,
        sentAt: new Date(),
        deliveredAt: status === NotificationDeliveryStatus.DELIVERED ? new Date() : undefined,
        failureReason: status === NotificationDeliveryStatus.FAILED ? 'Device unreachable / push token expired' : undefined,
      });
    }

    // SMS channel
    for (let i = 1; i <= smsCount; i++) {
      const status = assignInitialStatus(i + 2);
      records.push({
        warningId,
        channel: NotificationChannel.SMS,
        recipientIdentifier: `+9477${String(1000000 + i).slice(-7)}`,
        targetArea: affectedArea,
        status,
        sentAt: new Date(),
        deliveredAt: status === NotificationDeliveryStatus.DELIVERED ? new Date() : undefined,
        failureReason: status === NotificationDeliveryStatus.FAILED ? 'Cell tower congestion / carrier timeout' : undefined,
      });
    }

    // AUDIBLE sirens and broadcast units
    for (let i = 1; i <= audibleCount; i++) {
      const status = assignInitialStatus(i + 4);
      records.push({
        warningId,
        channel: NotificationChannel.AUDIBLE,
        recipientIdentifier: `SIREN-TOWER-${affectedArea.slice(0, 3).toUpperCase()}-0${i}`,
        targetArea: affectedArea,
        status,
        sentAt: new Date(),
        deliveredAt: status === NotificationDeliveryStatus.DELIVERED ? new Date() : undefined,
        failureReason: status === NotificationDeliveryStatus.FAILED ? 'Acoustic broadcast unit power fault' : undefined,
      });
    }

    await NotificationModel.insertMany(records);
    return records;
  }

  /**
   * Get aggregated notification delivery stats and records for a warning.
   */
  static async getWarningNotifications(id: string) {
    let warning = await WarningModel.findById(id).exec();
    if (!warning) {
      warning = await WarningModel.findOne({ warningId: id }).exec();
    }

    if (!warning) {
      throw new WarningServiceError(`Warning not found for identifier '${id}'.`, 404, 'WARNING_NOT_FOUND');
    }

    const notifications = await NotificationModel.find({ warningId: warning._id })
      .sort({ createdAt: -1 })
      .exec();

    const summary = await this.calculateDeliverySummary(warning._id.toString());

    return {
      warningId: warning.warningId,
      summary,
      totalRecords: notifications.length,
      notifications,
    };
  }

  /**
   * Calculate live delivery statistics from persisted Notification records.
   */
  static async calculateDeliverySummary(warningObjectId: string): Promise<IWarningDeliverySummary> {
    const total = await NotificationModel.countDocuments({ warningId: warningObjectId }).exec();
    const delivered = await NotificationModel.countDocuments({
      warningId: warningObjectId,
      status: NotificationDeliveryStatus.DELIVERED,
    }).exec();
    const failed = await NotificationModel.countDocuments({
      warningId: warningObjectId,
      status: NotificationDeliveryStatus.FAILED,
    }).exec();
    const pending = await NotificationModel.countDocuments({
      warningId: warningObjectId,
      status: NotificationDeliveryStatus.PENDING,
    }).exec();

    // Per-channel breakdown
    const channels = Object.values(NotificationChannel);
    const channelBreakdown: Record<string, any> = {};

    for (const channel of channels) {
      const chTotal = await NotificationModel.countDocuments({ warningId: warningObjectId, channel }).exec();
      const chDelivered = await NotificationModel.countDocuments({
        warningId: warningObjectId,
        channel,
        status: NotificationDeliveryStatus.DELIVERED,
      }).exec();
      const chFailed = await NotificationModel.countDocuments({
        warningId: warningObjectId,
        channel,
        status: NotificationDeliveryStatus.FAILED,
      }).exec();
      const chPending = await NotificationModel.countDocuments({
        warningId: warningObjectId,
        channel,
        status: NotificationDeliveryStatus.PENDING,
      }).exec();

      channelBreakdown[channel] = {
        target: chTotal,
        delivered: chDelivered,
        failed: chFailed,
        pending: chPending,
      };
    }

    return {
      targetCitizens: total,
      delivered,
      failed,
      pending,
      channelBreakdown,
    };
  }

  /**
   * Simulate delivery progression (transitions pending notifications to delivered or failed).
   */
  static async simulateDeliveryProgression(id: string) {
    let warning = await WarningModel.findById(id).exec();
    if (!warning) {
      warning = await WarningModel.findOne({ warningId: id }).exec();
    }

    if (!warning) {
      throw new WarningServiceError(`Warning not found for identifier '${id}'.`, 404, 'WARNING_NOT_FOUND');
    }

    const pendingNotifs = await NotificationModel.find({
      warningId: warning._id,
      status: NotificationDeliveryStatus.PENDING,
    }).exec();

    let transitionedCount = 0;
    const now = new Date();
    for (const notif of pendingNotifs) {
      // 85% success transition, 15% fail
      if (Math.random() < 0.85) {
        notif.status = NotificationDeliveryStatus.DELIVERED;
        notif.deliveredAt = now;
      } else {
        notif.status = NotificationDeliveryStatus.FAILED;
        notif.failureReason = 'Delivery retry limit exceeded';
      }
      await notif.save();
      transitionedCount++;
    }

    const summary = await this.calculateDeliverySummary(warning._id.toString());
    return {
      updatedCount: transitionedCount,
      summary,
    };
  }

  /**
   * Helper: Enrich warning document with delivery summary.
   */
  private static async enrichWarningWithSummary(doc: any) {
    const plain = doc.toObject ? doc.toObject() : { ...doc };
    if (plain.status !== WarningStatus.DRAFT) {
      plain.deliverySummary = await this.calculateDeliverySummary(plain._id.toString());
    } else {
      plain.deliverySummary = {
        targetCitizens: 0,
        delivered: 0,
        failed: 0,
        pending: 0,
      };
    }
    return plain;
  }

  /**
   * List verified hazards for assessment by DMC Officer.
   */
  static async getVerifiedHazards() {
    const reports = await GroundReportModel.find({ status: ReportStatus.VERIFIED }).sort({ verificationTimestamp: -1 }).exec();
    const hazards = await Promise.all(reports.map((report) => {
      const locationLabel = report.location.address?.trim() ||
        `${report.location.latitude.toFixed(5)}, ${report.location.longitude.toFixed(5)}`;

      return HazardModel.findOneAndUpdate(
        { sourceReportId: report._id },
        {
          $set: {
            title: `${report.disasterType} Ground Report`,
            disasterType: report.disasterType,
            severity: report.severity,
            location: {
              district: locationLabel,
              latitude: report.location.latitude,
              longitude: report.location.longitude,
            },
            description: report.description,
            status: report.status,
            sourceReportId: report._id,
            verifiedBy: report.reviewerId,
            verifiedAt: report.verificationTimestamp,
          },
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      ).exec();
    }));

    return hazards;
  }
}
