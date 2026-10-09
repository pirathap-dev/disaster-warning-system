import mongoose, { Document, Schema } from 'mongoose';
import { NotificationChannel, NotificationDeliveryStatus, INotificationRecord } from '../types';

export interface INotificationDocument extends Omit<INotificationRecord, '_id' | 'id' | 'warningId'>, Document {
  warningId: mongoose.Types.ObjectId | string;
}

const NotificationSchema = new Schema<INotificationDocument>(
  {
    warningId: { type: Schema.Types.ObjectId, ref: 'Warning', required: true, index: true },
    channel: {
      type: String,
      enum: Object.values(NotificationChannel),
      required: true,
      index: true,
    },
    recipientIdentifier: { type: String, required: true },
    targetArea: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(NotificationDeliveryStatus),
      default: NotificationDeliveryStatus.PENDING,
      index: true,
    },
    sentAt: { type: Date, default: Date.now },
    deliveredAt: { type: Date },
    failureReason: { type: String },
  },
  { timestamps: true }
);

export const NotificationModel = mongoose.model<INotificationDocument>('Notification', NotificationSchema);
