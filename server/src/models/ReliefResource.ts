import { Document, Schema, model } from 'mongoose';

export interface IReliefResource extends Document {
  name: string;
  category: string;
  availableQuantity: number;
  unit: string;
  source?: string;
  createdAt: Date;
  updatedAt: Date;
}

const reliefResourceSchema = new Schema<IReliefResource>(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    availableQuantity: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isInteger,
    },
    unit: { type: String, required: true, trim: true },
    source: { type: String, trim: true },
  },
  { timestamps: true }
);

export const ReliefResourceModel = model<IReliefResource>(
  'ReliefResource',
  reliefResourceSchema
);
