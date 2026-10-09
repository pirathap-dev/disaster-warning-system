import mongoose, { Document, Schema, Types } from 'mongoose';
import { Coordinates, RescueTeamStatus } from '../services/rescueSuitability';

export type AssignmentPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AssignmentStatus = RescueTeamStatus | 'DECLINED';

export interface IRescueAssignment extends Document {
  incident: Types.ObjectId;
  rescueTeam: Types.ObjectId;
  priority: AssignmentPriority;
  location: Coordinates;
  createdBy: string;
  status: AssignmentStatus;
  decision: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  assignedAt: Date;
  etaMinutes?: number;
  notes?: string;
  completedAt?: Date;
}

const rescueAssignmentSchema = new Schema<IRescueAssignment>(
  {
    incident: { type: Schema.Types.ObjectId, ref: 'RescueIncident', required: true, index: true },
    rescueTeam: { type: Schema.Types.ObjectId, ref: 'RescueTeam', required: true, index: true },
    priority: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true },
    location: {
      latitude: { type: Number, required: true, min: -90, max: 90 },
      longitude: { type: Number, required: true, min: -180, max: 180 },
    },
    createdBy: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['AVAILABLE', 'DISPATCHED', 'EN_ROUTE', 'ACTIVE', 'COMPLETE', 'DECLINED'],
      default: 'DISPATCHED',
      required: true,
    },
    decision: { type: String, enum: ['PENDING', 'ACCEPTED', 'DECLINED'], default: 'PENDING', required: true },
    assignedAt: { type: Date, required: true, default: Date.now },
    etaMinutes: { type: Number, min: 1 },
    notes: { type: String, trim: true, maxlength: 1000 },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

export const RescueAssignmentModel = mongoose.model<IRescueAssignment>(
  'RescueAssignment',
  rescueAssignmentSchema
);