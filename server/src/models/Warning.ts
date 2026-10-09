import mongoose, { Document, Schema } from 'mongoose';
import { WarningLevel, WarningPriority, WarningStatus, IWarning } from '../types';

export interface IWarningDocument extends Omit<IWarning, '_id' | 'id' | 'hazardId'>, Document {
  hazardId: mongoose.Types.ObjectId | string;
}

const WarningSchema = new Schema<IWarningDocument>(
  {
    warningId: { type: String, required: true, unique: true, index: true },
    hazardId: { type: Schema.Types.ObjectId, ref: 'Hazard', required: true, index: true },
    warningLevel: {
      type: String,
      enum: Object.values(WarningLevel),
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: Object.values(WarningPriority),
      required: true,
      default: WarningPriority.MEDIUM,
      index: true,
    },
    message: { type: String, required: true },
    affectedArea: { type: String, required: true, index: true },
    startTime: { type: Date, required: true },
    expiryTime: { type: Date, required: true },
    recommendedAction: { type: String, required: true },
    createdBy: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(WarningStatus),
      default: WarningStatus.DRAFT,
      index: true,
    },
    publishedTimestamp: { type: Date },
    updatedTimestamp: { type: Date },
    cancelledTimestamp: { type: Date },
    cancellationReason: { type: String },
  },
  { timestamps: true }
);

export const WarningModel = mongoose.model<IWarningDocument>('Warning', WarningSchema);
