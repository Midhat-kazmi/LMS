import mongoose, { Schema, Document } from "mongoose";


export interface INotification extends Document {
  user: mongoose.Types.ObjectId;
  title: string;
  message: string;
  read?: boolean;
  createdAt?: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const NotificationModel = mongoose.model<INotification>(
  "Notification",
  notificationSchema
);

export default NotificationModel;
