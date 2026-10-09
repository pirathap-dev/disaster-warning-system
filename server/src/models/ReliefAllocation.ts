import { Document, Schema, model, Types } from 'mongoose';
import { ReliefAllocationStatus } from '../types';

export interface IReliefAllocation extends Document {
  shelter: Types.ObjectId;
  resource: Types.ObjectId;
  requestedQuantity: number;
  allocatedQuantity: number;
  deliveredQuantity: number;
  status: ReliefAllocationStatus;
  createdBy: string;
  notes?: string;
  allocatedAt?: Date;
  dispatchedAt?: Date;
  receivedAt?: Date;
  completedAt?: Date;
  cancelledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reliefAllocationSchema = new Schema<IReliefAllocation>(
  {
    shelter: {
      type: Schema.Types.ObjectId,
      ref: 'Shelter',
      required: true,
      index: true,
    },
    resource: {
      type: Schema.Types.ObjectId,
      ref: 'ReliefResource',
      required: true,
      index: true,
    },
    requestedQuantity: {
      type: Number,
      required: true,
      min: 1,
      validate: Number.isInteger,
    },
    allocatedQuantity: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
    deliveredQuantity: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
    status: {
      type: String,
      enum: Object.values(ReliefAllocationStatus),
      required: true,
      index: true,
    },
    createdBy: { type: String, required: true, trim: true },
    notes: { type: String, trim: true, maxlength: 1000 },
    allocatedAt: Date,
    dispatchedAt: Date,
    receivedAt: Date,
    completedAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true }
);

export const ReliefAllocationModel = model<IReliefAllocation>(
  'ReliefAllocation',
  reliefAllocationSchema
);
