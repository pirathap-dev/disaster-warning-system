import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { GroundReportModel } from './models/GroundReport';
import { HazardModel } from './models/Hazard';
import { NotificationModel } from './models/Notification';
import { ReliefAllocationModel } from './models/ReliefAllocation';
import { ReliefResourceModel } from './models/ReliefResource';
import { RescueAssignmentModel } from './models/RescueAssignment';
import { RescueIncidentModel } from './models/RescueIncident';
import { RescueTeamModel } from './models/RescueTeam';
import { ShelterModel } from './models/Shelter';
import { UserModel } from './models/User';
import { WarningModel } from './models/Warning';
import {
  DisasterType,
  NotificationChannel,
  NotificationDeliveryStatus,
  ReliefAllocationStatus,
  ReportStatus,
  SeverityLevel,
  ShelterStatus,
  UserRole,
  WarningLevel,
  WarningPriority,
  WarningStatus,
} from './types';

dotenv.config();

const testUsers = {
  citizen: { email: 'citizen.test@dwecs.local', name: 'Citizen Test', role: UserRole.CITIZEN },
  volunteer: { email: 'volunteer.test@dwecs.local', name: 'Volunteer Test', role: UserRole.VOLUNTEER },
  dmc: { email: 'dmcofficer.test@dwecs.local', name: 'DMC Duty Officer Test', role: UserRole.DMC_DUTY_OFFICER },
  district: { email: 'districtofficer.test@dwecs.local', name: 'District Officer Test', role: UserRole.DISTRICT_OFFICER },
  rescue: { email: 'rescueteam.test@dwecs.local', name: 'Rescue Team Test', role: UserRole.RESCUE_TEAM },
  shelter: { email: 'sheltercoordinator.test@dwecs.local', name: 'Shelter Coordinator Test', role: UserRole.SHELTER_COORDINATOR },
  organization: { email: 'resourceorg.test@dwecs.local', name: 'Resource Organization Test', role: UserRole.RESOURCE_ORGANIZATION },
} as const;

async function seedTestAccessData() {
  const users = {} as Record<keyof typeof testUsers, { _id: mongoose.Types.ObjectId; name: string }>;
  for (const [key, account] of Object.entries(testUsers) as [keyof typeof testUsers, typeof testUsers[keyof typeof testUsers]][]) {
    const user = await UserModel.findOneAndUpdate(
      { email: account.email },
      {
        $set: {
          name: account.name,
          email: account.email,
          role: account.role,
          district: 'Colombo',
          passwordHash: 'test-access-only-no-password-login',
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).exec();
    users[key] = user;
  }

  const report = await GroundReportModel.findOneAndUpdate(
    { reporterId: String(users.citizen._id), description: 'TEST MODE: rising water near the Kelani River.' },
    {
      $set: {
        disasterType: DisasterType.FLOOD,
        severity: SeverityLevel.HIGH,
        location: { latitude: 6.9271, longitude: 79.8612, address: 'Hanwella reach' },
        status: ReportStatus.VERIFIED,
        reviewerId: String(users.dmc._id),
        verificationRemarks: 'Seeded demo report for the verified hazard flow.',
        verificationTimestamp: new Date(),
      },
      $setOnInsert: { isDuplicate: false },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).exec();
  await GroundReportModel.findOneAndUpdate(
    { reporterId: String(users.citizen._id), description: 'TEST MODE: residents request evacuation assistance.' },
    {
      $set: {
        disasterType: DisasterType.FLOOD,
        severity: SeverityLevel.MODERATE,
        location: { latitude: 6.9300, longitude: 79.8600, address: 'Hanwella South' },
        status: ReportStatus.PENDING,
      },
      $setOnInsert: { isDuplicate: false },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).exec();
  await GroundReportModel.findOneAndUpdate(
    { reporterId: String(users.volunteer._id), description: 'TEST MODE: blocked access road reported.' },
    {
      $set: {
        disasterType: DisasterType.FLOOD,
        severity: SeverityLevel.HIGH,
        location: { latitude: 6.9400, longitude: 79.8500, address: 'Low-level access road' },
        status: ReportStatus.PENDING,
      },
      $setOnInsert: { isDuplicate: false },
    },
    { upsert: true, setDefaultsOnInsert: true }
  ).exec();

  const hazard = await HazardModel.findOneAndUpdate(
    { sourceReportId: report._id },
    {
      $set: {
        title: 'TEST MODE: Kelani River Flood Risk',
        disasterType: DisasterType.FLOOD,
        severity: SeverityLevel.HIGH,
        location: { district: 'Colombo', address: 'Hanwella reach', latitude: 6.9271, longitude: 79.8612 },
        description: report.description,
        status: ReportStatus.VERIFIED,
        verifiedBy: String(users.dmc._id),
        verifiedAt: new Date(),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).exec();

  const warning = await WarningModel.findOneAndUpdate(
    { warningId: 'WRN-DEMO-0001' },
    {
      $set: {
        hazardId: hazard._id,
        warningLevel: WarningLevel.EVACUATE,
        priority: WarningPriority.CRITICAL,
        message: 'TEST MODE: rising river levels require immediate evacuation.',
        affectedArea: 'Colombo District',
        startTime: new Date(Date.now() - 5 * 60 * 1000),
        expiryTime: new Date(Date.now() + 6 * 60 * 60 * 1000),
        recommendedAction: 'Proceed to the nearest open shelter.',
        createdBy: users.dmc.name,
        status: WarningStatus.ACTIVE,
        publishedTimestamp: new Date(),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).exec();
  const incident = await RescueIncidentModel.findOneAndUpdate(
    { sourceWarningId: String(warning._id) },
    {
      $set: {
        title: 'TEST MODE: Kelani flood evacuation',
        locationName: 'Colombo District, Hanwella reach',
        location: { latitude: 6.9271, longitude: 79.8612 },
        requiredCapabilities: ['water rescue'],
        priority: 'CRITICAL',
        status: 'ACTIVE',
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).exec();

  const team = await RescueTeamModel.findOneAndUpdate(
    { userId: String(users.rescue._id) },
    {
      $set: {
        name: 'TEST MODE: Colombo River Rescue',
        userId: String(users.rescue._id),
        capabilities: ['water rescue', 'evacuation'],
        status: 'DISPATCHED',
        location: { latitude: 6.9200, longitude: 79.8700 },
        contact: 'Demo rescue team',
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).exec();
  await RescueTeamModel.findOneAndUpdate(
    { name: 'TEST MODE: Colombo Support Rescue' },
    {
      $set: {
        name: 'TEST MODE: Colombo Support Rescue',
        capabilities: ['water rescue', 'evacuation', 'fire suppression', 'urban search and rescue'],
        status: 'AVAILABLE',
        location: { latitude: 6.9250, longitude: 79.8650 },
        contact: 'Demo support team',
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).exec();
  await RescueAssignmentModel.findOneAndUpdate(
    { incident: incident!._id, rescueTeam: team._id },
    {
      $set: {
        incident: incident!._id,
        rescueTeam: team._id,
        priority: 'CRITICAL',
        location: { latitude: 6.9271, longitude: 79.8612 },
        createdBy: users.district.name,
        status: 'DISPATCHED',
        decision: 'PENDING',
        assignedAt: new Date(),
        etaMinutes: 25,
        notes: 'TEST MODE: accept this dispatch to progress the lifecycle.',
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  ).exec();

  const shelter = await ShelterModel.findOneAndUpdate(
    { coordinatorUserId: String(users.shelter._id) },
    {
      $set: {
        coordinatorUserId: String(users.shelter._id),
        name: 'TEST MODE: Hanwella Community Shelter',
        location: 'Hanwella Community Centre, Colombo District',
        capacity: 250,
        currentOccupancy: 84,
        status: ShelterStatus.OPEN,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).exec();
  const resource = await ReliefResourceModel.findOneAndUpdate(
    { ownerUserId: String(users.organization._id), name: 'TEST MODE: Emergency Water' },
    {
      $set: {
        ownerUserId: String(users.organization._id),
        name: 'TEST MODE: Emergency Water',
        category: 'Water',
        availableQuantity: 800,
        unit: 'litres',
        source: 'Test relief organization',
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).exec();
  await ReliefAllocationModel.findOneAndUpdate(
    { shelter: shelter._id, resource: resource._id },
    {
      $set: {
        shelter: shelter._id,
        resource: resource._id,
        requestedQuantity: 40,
        allocatedQuantity: 40,
        deliveredQuantity: 0,
        status: ReliefAllocationStatus.DISPATCHED,
        createdBy: users.district.name,
        notes: 'TEST MODE: sample delivery awaiting shelter receipt.',
        allocatedAt: new Date(),
        dispatchedAt: new Date(),
      },
    },
    { upsert: true, setDefaultsOnInsert: true }
  ).exec();

  if (await NotificationModel.countDocuments({ warningId: warning._id }).exec() === 0) {
    await NotificationModel.insertMany([
      { warningId: warning._id, channel: NotificationChannel.PUSH, recipientIdentifier: 'citizen.test', targetArea: warning.affectedArea, status: NotificationDeliveryStatus.DELIVERED, sentAt: new Date(), deliveredAt: new Date() },
      { warningId: warning._id, channel: NotificationChannel.SMS, recipientIdentifier: '+94770000001', targetArea: warning.affectedArea, status: NotificationDeliveryStatus.DELIVERED, sentAt: new Date(), deliveredAt: new Date() },
      { warningId: warning._id, channel: NotificationChannel.AUDIBLE, recipientIdentifier: 'DEMO-SIREN-COLOMBO', targetArea: warning.affectedArea, status: NotificationDeliveryStatus.PENDING, sentAt: new Date() },
    ]);
  }
  console.log('Flag-gated test accounts and linked disaster demo records are ready.');
}

async function seedDemoData() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/disaster_management_dev';
  await mongoose.connect(uri);
  try {
    await ShelterModel.updateOne(
      { name: 'Central Community Shelter' },
      {
        $setOnInsert: {
          name: 'Central Community Shelter',
          location: 'District Centre',
          capacity: 500,
          currentOccupancy: 420,
          status: ShelterStatus.OPEN,
        },
      },
      { upsert: true }
    );
    await ShelterModel.updateOne(
      { name: 'Riverside Relief Centre' },
      {
        $setOnInsert: {
          name: 'Riverside Relief Centre',
          location: 'Riverside Ward',
          capacity: 300,
          currentOccupancy: 126,
          status: ShelterStatus.OPEN,
        },
      },
      { upsert: true }
    );
    await ReliefResourceModel.updateOne(
      { name: 'Drinking Water' },
      {
        $setOnInsert: {
          name: 'Drinking Water',
          category: 'Water',
          availableQuantity: 1000,
          unit: 'litres',
          source: 'District Emergency Store',
        },
      },
      { upsert: true }
    );
    await ReliefResourceModel.updateOne(
      { name: 'Food Packs' },
      {
        $setOnInsert: {
          name: 'Food Packs',
          category: 'Food',
          availableQuantity: 600,
          unit: 'packs',
          source: 'District Emergency Store',
        },
      },
      { upsert: true }
    );
    await ReliefResourceModel.updateOne(
      { name: 'Blankets' },
      {
        $setOnInsert: {
          name: 'Blankets',
          category: 'Shelter',
          availableQuantity: 250,
          unit: 'units',
          source: 'District Emergency Store',
        },
      },
      { upsert: true }
    );
    if (process.env.ENABLE_TEST_ACCESS === 'true' && process.env.NODE_ENV !== 'production') {
      await seedTestAccessData();
    }
    console.log('Demo shelters and relief resources are ready.');
  } finally {
    await mongoose.disconnect();
  }
}

void seedDemoData().catch((error: unknown) => {
  console.error('Could not seed demo relief data:', error);
  process.exitCode = 1;
});
