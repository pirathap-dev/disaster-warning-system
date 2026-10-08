import mongoose, { Document, Schema } from 'mongoose';
import { Coordinates, RescueTeamStatus } from '../services/rescueSuitability';

export interface IRescueTeam extends Document {
  name: string;
  capabilities: string[];
  status: RescueTeamStatus;
  location: Coordinates;
  contact?: string;
}

const rescueTeamSchema = new Schema<IRescueTeam>(
  {
    name: { type: String, required: true, trim: true },
    capabilities: { type: [String], required: true, validate: (items: string[]) => items.length > 0 },
    status: {
      type: String,
      enum: ['AVAILABLE', 'DISPATCHED', 'EN_ROUTE', 'ACTIVE', 'COMPLETE'],
      default: 'AVAILABLE',
      required: true,
    },
    location: {
      latitude: { type: Number, required: true, min: -90, max: 90 },
      longitude: { type: Number, required: true, min: -180, max: 180 },
    },
    contact: { type: String, trim: true },
  },
  { timestamps: true }
);

export const RescueTeamModel = mongoose.model<IRescueTeam>('RescueTeam', rescueTeamSchema);