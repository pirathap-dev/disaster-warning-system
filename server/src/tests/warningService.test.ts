import mongoose from 'mongoose';
import { WarningService, WarningServiceError } from '../services/warningService';
import { WarningModel } from '../models/Warning';
import { HazardModel } from '../models/Hazard';
import { NotificationModel } from '../models/Notification';
import {
  WarningLevel,
  WarningPriority,
  WarningStatus,
  NotificationChannel,
  NotificationDeliveryStatus,
  ReportStatus,
  UserRole,
} from '../types';

describe('WarningService Unit & Domain Tests', () => {
  let verifiedHazardId: string;
  let unverifiedHazardId: string;

  beforeAll(async () => {
    await mongoose.connect('mongodb://localhost:27017/disaster_warning_service_test');
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await WarningModel.deleteMany({});
    await HazardModel.deleteMany({});
    await NotificationModel.deleteMany({});

    // Create a verified hazard
    const verifiedHazard = await HazardModel.create({
      title: 'Kelani River Flash Flood Risk',
      disasterType: 'FLOOD',
      severity: 'HIGH',
      location: {
        district: 'Colombo',
        address: 'Hanwella Bridge',
        latitude: 6.901,
        longitude: 79.912,
      },
      description: 'River water level breached amber threshold.',
      status: ReportStatus.VERIFIED,
      verifiedBy: 'DMC Hydrologist #01',
    });
    verifiedHazardId = verifiedHazard._id.toString();

    // Create an unverified hazard
    const unverifiedHazard = await HazardModel.create({
      title: 'Unverified Smoke Sighting',
      disasterType: 'FIRE',
      severity: 'LOW',
      location: { district: 'Kandy' },
      description: 'Reported by citizen, awaiting DMC verification.',
      status: ReportStatus.PENDING,
    });
    unverifiedHazardId = unverifiedHazard._id.toString();
  });

  const baseWarningPayload = () => ({
    hazardId: verifiedHazardId,
    warningLevel: WarningLevel.WARNING,
    priority: WarningPriority.HIGH,
    message: 'Rapidly rising water levels. Immediate precautionary evacuation required in low-lying sectors.',
    affectedArea: 'Colombo District - Kelani Basin',
    startTime: new Date(Date.now() + 1000 * 60).toISOString(),
    expiryTime: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(),
    recommendedAction: 'Move to elevated ground and designated community shelters.',
    createdBy: 'Officer Perera (DMC-04)',
    status: WarningStatus.DRAFT,
    userRole: UserRole.DMC_OFFICER,
  });

  // 1. Valid warning creation
  it('1. should successfully create a valid draft warning', async () => {
    const payload = baseWarningPayload();
    const result = await WarningService.createWarning(payload);

    expect(result).toBeDefined();
    expect(result.warningId).toMatch(/^WRN-\d{4}-\d+/);
    expect(result.status).toBe(WarningStatus.DRAFT);
    expect(result.warningLevel).toBe(WarningLevel.WARNING);
    expect(result.priority).toBe(WarningPriority.HIGH);
    expect(result.affectedArea).toBe(payload.affectedArea);
    expect(result.deliverySummary.targetCitizens).toBe(0);
  });

  // 2. Missing warning message
  it('2. should reject warning creation when message is missing or too short', async () => {
    const payload = { ...baseWarningPayload(), message: '' };
    await expect(WarningService.createWarning(payload)).rejects.toMatchObject({
      statusCode: 400,
      code: 'MISSING_MESSAGE',
    });

    const shortPayload = { ...baseWarningPayload(), message: 'abc' };
    await expect(WarningService.createWarning(shortPayload)).rejects.toMatchObject({
      statusCode: 400,
      code: 'MISSING_MESSAGE',
    });
  });

  // 3. Missing hazard
  it('3. should reject warning creation when hazard reference is missing or non-existent', async () => {
    const missingPayload = { ...baseWarningPayload(), hazardId: '' };
    await expect(WarningService.createWarning(missingPayload)).rejects.toMatchObject({
      statusCode: 400,
      code: 'MISSING_HAZARD',
    });

    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const notFoundPayload = { ...baseWarningPayload(), hazardId: nonExistentId };
    await expect(WarningService.createWarning(notFoundPayload)).rejects.toMatchObject({
      statusCode: 404,
      code: 'HAZARD_NOT_FOUND',
    });
  });

  // Unverified hazard rejection
  it('should reject warning creation for an unverified hazard', async () => {
    const unverifiedPayload = { ...baseWarningPayload(), hazardId: unverifiedHazardId };
    await expect(WarningService.createWarning(unverifiedPayload)).rejects.toMatchObject({
      statusCode: 400,
      code: 'HAZARD_NOT_VERIFIED',
    });
  });

  // 4. Invalid warning level
  it('4. should reject warning creation with invalid warning level', async () => {
    const payload = { ...baseWarningPayload(), warningLevel: 'EXTREME' as any };
    await expect(WarningService.createWarning(payload)).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_WARNING_LEVEL',
    });
  });

  // 5. Invalid geographic target
  it('5. should reject warning creation with missing affected geographic area', async () => {
    const payload = { ...baseWarningPayload(), affectedArea: '   ' };
    await expect(WarningService.createWarning(payload)).rejects.toMatchObject({
      statusCode: 400,
      code: 'MISSING_AFFECTED_AREA',
    });
  });

  // 6. Invalid start/expiry time
  it('6. should reject invalid date strings', async () => {
    const payload = { ...baseWarningPayload(), startTime: 'not-a-date' };
    await expect(WarningService.createWarning(payload)).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_DATE_FORMAT',
    });
  });

  // 7. Expiry before start
  it('7. should reject warning when expiry time is before or equal to start time', async () => {
    const now = Date.now();
    const payload = {
      ...baseWarningPayload(),
      startTime: new Date(now + 1000 * 60 * 60).toISOString(),
      expiryTime: new Date(now + 1000 * 60 * 30).toISOString(), // 30 mins after now, but before start
    };

    await expect(WarningService.createWarning(payload)).rejects.toMatchObject({
      statusCode: 400,
      code: 'EXPIRY_BEFORE_START',
    });
  });

  // 8. Valid publication
  it('8. should support valid publication lifecycle (DRAFT -> PUBLISHED -> ACTIVE)', async () => {
    const created = await WarningService.createWarning(baseWarningPayload());
    expect(created.status).toBe(WarningStatus.DRAFT);

    // DRAFT -> PUBLISHED
    const published = await WarningService.updateStatus(created._id.toString(), WarningStatus.PUBLISHED);
    expect(published.status).toBe(WarningStatus.PUBLISHED);
    expect(published.publishedTimestamp).toBeDefined();

    // PUBLISHED -> ACTIVE
    const active = await WarningService.updateStatus(created._id.toString(), WarningStatus.ACTIVE);
    expect(active.status).toBe(WarningStatus.ACTIVE);
  });

  // Direct create as PUBLISHED
  it('should support creating warning directly as PUBLISHED and trigger notifications', async () => {
    const payload = { ...baseWarningPayload(), status: WarningStatus.PUBLISHED };
    const published = await WarningService.createWarning(payload);

    expect(published.status).toBe(WarningStatus.PUBLISHED);
    expect(published.publishedTimestamp).toBeDefined();
    expect(published.deliverySummary.targetCitizens).toBeGreaterThan(0);
  });

  // 9. Invalid status transition
  it('9. should reject invalid status transitions', async () => {
    const created = await WarningService.createWarning(baseWarningPayload());

    // DRAFT -> ACTIVE is invalid (must go through PUBLISHED)
    await expect(
      WarningService.updateStatus(created._id.toString(), WarningStatus.ACTIVE)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_STATUS_TRANSITION',
    });

    // DRAFT -> EXPIRED is invalid
    await expect(
      WarningService.updateStatus(created._id.toString(), WarningStatus.EXPIRED)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_STATUS_TRANSITION',
    });

    // Publish it
    await WarningService.updateStatus(created._id.toString(), WarningStatus.PUBLISHED);
    await WarningService.updateStatus(created._id.toString(), WarningStatus.ACTIVE);

    // Cancel from ACTIVE
    await WarningService.updateStatus(created._id.toString(), WarningStatus.CANCELLED, {
      cancellationReason: 'False alarm cleared by weather satellite update',
    });

    // CANCELLED -> ACTIVE must be rejected (terminal state)
    await expect(
      WarningService.updateStatus(created._id.toString(), WarningStatus.ACTIVE)
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_STATUS_TRANSITION',
    });
  });

  // 10. Warning update
  it('10. should allow updating warning details and transition ACTIVE -> UPDATED', async () => {
    const created = await WarningService.createWarning(baseWarningPayload());
    await WarningService.updateStatus(created._id.toString(), WarningStatus.PUBLISHED);
    await WarningService.updateStatus(created._id.toString(), WarningStatus.ACTIVE);

    const updated = await WarningService.updateWarning(created._id.toString(), {
      message: 'Updated evacuation guidance: All zones downstream must proceed immediately.',
      warningLevel: WarningLevel.EVACUATE,
    });

    expect(updated.status).toBe(WarningStatus.UPDATED);
    expect(updated.warningLevel).toBe(WarningLevel.EVACUATE);
    expect(updated.message).toContain('Updated evacuation guidance');
  });

  // Terminal state modification rejection
  it('should reject content modifications on cancelled or expired warnings', async () => {
    const created = await WarningService.createWarning(baseWarningPayload());
    await WarningService.updateStatus(created._id.toString(), WarningStatus.CANCELLED);

    await expect(
      WarningService.updateWarning(created._id.toString(), { message: 'Should not update' })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'CANNOT_MODIFY_TERMINAL_WARNING',
    });
  });

  // 11. Warning cancellation
  it('11. should allow warning cancellation with a valid reason and timestamp', async () => {
    const created = await WarningService.createWarning(baseWarningPayload());
    await WarningService.updateStatus(created._id.toString(), WarningStatus.PUBLISHED);
    await WarningService.updateStatus(created._id.toString(), WarningStatus.ACTIVE);

    const cancelled = await WarningService.updateStatus(created._id.toString(), WarningStatus.CANCELLED, {
      cancellationReason: 'Water levels receded below critical risk threshold.',
    });

    expect(cancelled.status).toBe(WarningStatus.CANCELLED);
    expect(cancelled.cancelledTimestamp).toBeDefined();
    expect(cancelled.cancellationReason).toBe('Water levels receded below critical risk threshold.');
  });

  // 12. Warning expiry
  it('12. should handle manual and automatic warning expiry', async () => {
    const created = await WarningService.createWarning(baseWarningPayload());
    await WarningService.updateStatus(created._id.toString(), WarningStatus.PUBLISHED);
    await WarningService.updateStatus(created._id.toString(), WarningStatus.ACTIVE);

    // Manual transition
    const expired = await WarningService.updateStatus(created._id.toString(), WarningStatus.EXPIRED);
    expect(expired.status).toBe(WarningStatus.EXPIRED);

    // Automatic expiry test when current time > expiryTime
    const pastWarningDoc = await WarningModel.create({
      warningId: 'WRN-PAST-001',
      hazardId: verifiedHazardId,
      warningLevel: WarningLevel.WATCH,
      priority: WarningPriority.LOW,
      message: 'Old warning message',
      affectedArea: 'Kandy',
      startTime: new Date(Date.now() - 3600000 * 4),
      expiryTime: new Date(Date.now() - 3600000 * 2), // expired 2 hours ago
      recommendedAction: 'Stay alert',
      createdBy: 'Officer',
      status: WarningStatus.ACTIVE,
    });

    const fetched = await WarningService.getWarningById(pastWarningDoc._id.toString());
    expect(fetched.status).toBe(WarningStatus.EXPIRED);
  });

  // 13. Notification records created after publishing
  it('13. should generate notification records across PUSH, SMS, and AUDIBLE channels on publish', async () => {
    const created = await WarningService.createWarning(baseWarningPayload());
    await WarningService.updateStatus(created._id.toString(), WarningStatus.PUBLISHED);

    const notifs = await NotificationModel.find({ warningId: created._id });
    expect(notifs.length).toBeGreaterThan(0);

    const channels = new Set(notifs.map((n) => n.channel));
    expect(channels.has(NotificationChannel.PUSH)).toBe(true);
    expect(channels.has(NotificationChannel.SMS)).toBe(true);
    expect(channels.has(NotificationChannel.AUDIBLE)).toBe(true);
  });

  // 14. Notification delivery statistics
  it('14. should calculate accurate notification delivery statistics from persisted documents', async () => {
    const created = await WarningService.createWarning(baseWarningPayload());
    await WarningService.updateStatus(created._id.toString(), WarningStatus.PUBLISHED);

    const { summary, notifications } = await WarningService.getWarningNotifications(created._id.toString());

    expect(summary.targetCitizens).toBe(notifications.length);
    expect(summary.delivered + summary.failed + summary.pending).toBe(summary.targetCitizens);
    expect(summary.channelBreakdown).toBeDefined();
    expect(summary.channelBreakdown![NotificationChannel.PUSH]).toBeDefined();
    expect(summary.channelBreakdown![NotificationChannel.SMS]).toBeDefined();
    expect(summary.channelBreakdown![NotificationChannel.AUDIBLE]).toBeDefined();
  });

  // Delivery simulation progression
  it('should simulate delivery updates by converting pending notifications to delivered/failed', async () => {
    const created = await WarningService.createWarning(baseWarningPayload());
    await WarningService.updateStatus(created._id.toString(), WarningStatus.PUBLISHED);

    const initial = await WarningService.getWarningNotifications(created._id.toString());
    const initialPending = initial.summary.pending;

    const simulation = await WarningService.simulateDeliveryProgression(created._id.toString());
    expect(simulation.updatedCount).toBe(initialPending);
    expect(simulation.summary.pending).toBe(0);
    expect(simulation.summary.delivered + simulation.summary.failed).toBe(simulation.summary.targetCitizens);
  });

  // 15. Error handling
  it('15. should throw 404 for non-existent warning queries', async () => {
    await expect(WarningService.getWarningById(new mongoose.Types.ObjectId().toString())).rejects.toMatchObject({
      statusCode: 404,
      code: 'WARNING_NOT_FOUND',
    });
  });

  // 16. Unauthorized role access
  it('16. should reject access when userRole is not DMC_OFFICER', async () => {
    const citizenPayload = {
      ...baseWarningPayload(),
      userRole: UserRole.CITIZEN,
    };

    await expect(WarningService.createWarning(citizenPayload)).rejects.toMatchObject({
      statusCode: 403,
      code: 'UNAUTHORIZED_ROLE',
    });
  });

  // Hazard dashboard & seeding
  it('should list verified hazards and seed initial hazards if empty', async () => {
    await HazardModel.deleteMany({});
    const hazards = await WarningService.getVerifiedHazards();
    expect(hazards.length).toBeGreaterThan(0);
    expect(hazards.every((h) => h.status === ReportStatus.VERIFIED)).toBe(true);
  });

  // Filter testing
  it('should filter warnings by status, warningLevel, and hazardId', async () => {
    const created1 = await WarningService.createWarning(baseWarningPayload());
    const created2 = await WarningService.createWarning({
      ...baseWarningPayload(),
      warningLevel: WarningLevel.EVACUATE,
      status: WarningStatus.PUBLISHED,
    });

    const statusFiltered = await WarningService.getWarnings({ status: WarningStatus.DRAFT });
    expect(statusFiltered.length).toBe(1);
    expect(statusFiltered[0].warningId).toBe(created1.warningId);

    const levelFiltered = await WarningService.getWarnings({ warningLevel: WarningLevel.EVACUATE });
    expect(levelFiltered.length).toBe(1);
    expect(levelFiltered[0].warningId).toBe(created2.warningId);

    const hazardFiltered = await WarningService.getWarnings({ hazardId: verifiedHazardId });
    expect(hazardFiltered.length).toBe(2);
  });

  // Querying by warningId string
  it('should query warning by custom warningId string (e.g. WRN-2026-...)', async () => {
    const created = await WarningService.createWarning(baseWarningPayload());
    const fetched = await WarningService.getWarningById(created.warningId);
    expect(fetched.warningId).toBe(created.warningId);
  });

  // Update validations
  it('should validate all update fields properly', async () => {
    const created = await WarningService.createWarning(baseWarningPayload());
    const id = created._id.toString();

    // Rejects empty message
    await expect(WarningService.updateWarning(id, { message: ' ' })).rejects.toMatchObject({
      code: 'MISSING_MESSAGE',
    });

    // Rejects empty affected area
    await expect(WarningService.updateWarning(id, { affectedArea: '' })).rejects.toMatchObject({
      code: 'MISSING_AFFECTED_AREA',
    });

    // Rejects empty recommended action
    await expect(WarningService.updateWarning(id, { recommendedAction: '' })).rejects.toMatchObject({
      code: 'MISSING_RECOMMENDED_ACTION',
    });

    // Rejects invalid date
    await expect(
      WarningService.updateWarning(id, {
        startTime: new Date(Date.now() + 50000).toISOString(),
        expiryTime: new Date(Date.now() + 10000).toISOString(),
      })
    ).rejects.toMatchObject({
      code: 'EXPIRY_BEFORE_START',
    });

    // Rejects unverified hazard update
    await expect(WarningService.updateWarning(id, { hazardId: unverifiedHazardId })).rejects.toMatchObject({
      code: 'HAZARD_NOT_VERIFIED',
    });

    // Rejects unauthorized role on update
    await expect(
      WarningService.updateWarning(id, { message: 'Updated note' }, UserRole.CITIZEN)
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED_ROLE',
    });

    // Rejects unauthorized role on status update
    await expect(
      WarningService.updateStatus(id, WarningStatus.PUBLISHED, { userRole: UserRole.CITIZEN })
    ).rejects.toMatchObject({
      code: 'UNAUTHORIZED_ROLE',
    });
  });

  // Not found on operations
  it('should throw NOT_FOUND on update and status operations for non-existent warning', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    await expect(WarningService.updateWarning(fakeId, { message: 'test' })).rejects.toMatchObject({
      code: 'WARNING_NOT_FOUND',
    });
    await expect(WarningService.updateStatus(fakeId, WarningStatus.PUBLISHED)).rejects.toMatchObject({
      code: 'WARNING_NOT_FOUND',
    });
    await expect(WarningService.getWarningNotifications(fakeId)).rejects.toMatchObject({
      code: 'WARNING_NOT_FOUND',
    });
    await expect(WarningService.simulateDeliveryProgression(fakeId)).rejects.toMatchObject({
      code: 'WARNING_NOT_FOUND',
    });
  });
});
