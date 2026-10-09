import mongoose, { Schema, Document } from 'mongoose';
import { DisasterType, ReportStatus, SeverityLevel, IGroundReport } from '../types';

export interface GroundReportDocument extends Omit<IGroundReport, '_id'>, Document {}

const LocationSchema = new Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  address: { type: String }
}, { _id: false });

const GroundReportSchema = new Schema<GroundReportDocument>({
  reporterId: { type: String, required: true, index: true },
  disasterType: { type: String, enum: Object.values(DisasterType), required: true },
  description: { type: String, required: true },
  severity: { type: String, enum: Object.values(SeverityLevel), required: true },
  imageUrl: { type: String },
  location: { type: LocationSchema, required: true },
  status: { type: String, enum: Object.values(ReportStatus), default: ReportStatus.SUBMITTED, index: true },
  isDuplicate: { type: Boolean, default: false },
  duplicateOf: { type: Schema.Types.ObjectId, ref: 'GroundReport' },
  reviewerId: { type: String },
  verificationRemarks: { type: String },
  verificationTimestamp: { type: Date }
}, {
  timestamps: true
});

export const GroundReportModel = mongoose.model<GroundReportDocument>('GroundReport', GroundReportSchema);
