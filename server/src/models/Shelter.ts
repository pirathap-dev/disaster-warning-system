import { Document, Schema, model } from 'mongoose';
import { ShelterStatus } from '../types';

export interface IShelter extends Document {
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
