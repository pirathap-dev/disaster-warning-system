import mongoose, { Document, Schema } from 'mongoose';
import { Coordinates } from '../services/rescueSuitability';

export interface IRescueIncident extends Document {
  title: string;
  locationName: string;
  location: Coordinates;
  requiredCapabilities: string[];
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'ACTIVE' | 'RESOLVED';
}

const rescueIncidentSchema = new Schema<IRescueIncident>(
  {
    title: { type: String, required: true, trim: true },
    locationName: { type: String, required: true, trim: true },
    location: {
      latitude: { type: Number, required: true, min: -90, max: 90 },
      longitude: { type: Number, required: true, min: -180, max: 180 },
    },
    requiredCapabilities: {
      type: [String],
      required: true,
      validate: (items: string[]) => items.length > 0,
    },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true },
    status: { type: String, enum: ['ACTIVE', 'RESOLVED'], default: 'ACTIVE', required: true },
  },
  { timestamps: true }
);

export const RescueIncidentModel = mongoose.model<IRescueIncident>(
  'RescueIncident',
  rescueIncidentSchema
);