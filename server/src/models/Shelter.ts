import { Document, Schema, model } from 'mongoose';
import { ShelterStatus } from '../types';

export interface IShelter extends Document {
  coordinatorUserId?: string;
  coordinatorRequestUserId?: string;
  coordinatorRequestByUserId?: string;
  coordinatorRequestStatus?: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  coordinatorRequestMessage?: string;
  name: string;
  location: string;
  capacity: number;
  currentOccupancy: number;
  status: ShelterStatus;
  createdAt: Date;
  updatedAt: Date;
}

const shelterSchema = new Schema<IShelter>(
  {
    coordinatorUserId: { type: String, index: true, sparse: true },
    coordinatorRequestUserId: { type: String, index: true },
    coordinatorRequestByUserId: { type: String },
    coordinatorRequestStatus: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'DECLINED'],
    },
    coordinatorRequestMessage: { type: String, trim: true, maxlength: 500 },
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    currentOccupancy: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
    status: {
      type: String,
      enum: Object.values(ShelterStatus),
      default: ShelterStatus.OPEN,
      required: true,
    },
  },
  { timestamps: true }
);

shelterSchema.path('currentOccupancy').validate(function (occupancy: number) {
  return occupancy <= this.capacity;
}, 'Current occupancy cannot exceed shelter capacity');

export const ShelterModel = model<IShelter>('Shelter', shelterSchema);
