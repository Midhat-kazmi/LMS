import mongoose, { Document, Model, Schema } from "mongoose";

export interface IOrder extends Document {
  courseId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  payment_info?: { id: string; [key: string]: any };
}

const orderSchema = new Schema<IOrder>(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    payment_info: { type: Object },
  },
  { timestamps: true }
);

const OrderModel: Model<IOrder> = mongoose.model<IOrder>("Order", orderSchema);
export default OrderModel;
