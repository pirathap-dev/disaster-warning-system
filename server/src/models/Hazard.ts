import mongoose, { Document, Schema } from 'mongoose';
import { ReportStatus, IHazard } from '../types';

export interface IHazardDocument extends Omit<IHazard, '_id' | 'id'>, Document {}

const HazardSchema = new Schema<IHazardDocument>(
  {
    title: { type: String, required: true },
    disasterType: { type: String, required: true },
    severity: { type: String, required: true },
    location: {
      district: { type: String, required: true },
      address: { type: String },
      latitude: { type: Number },
      longitude: { type: Number },
    },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(ReportStatus),
      default: ReportStatus.VERIFIED,
      index: true,
    },
    verifiedBy: { type: String },
    verifiedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const HazardModel = mongoose.model<IHazardDocument>('Hazard', HazardSchema);
