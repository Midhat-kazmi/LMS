import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { catchAsyncErrors } from "../middleware/catchAsyncErrors";
import ErrorHandler from "../utils/ErrorHandler";
import OrderModel from "../models/order.model";
import userModel from "../models/user.model";
import CourseModel, { ICourse } from "../models/course.model";
import sendEmail from "../utils/sendMail";
import NotificationModel from "../models/notification.model";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

/* ---------------------------------------------------
   SEND STRIPE PUBLISHABLE KEY
--------------------------------------------------- */
export const sendStripePublishableKey = catchAsyncErrors(
  async (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    });
  }
);

/* ---------------------------------------------------
   CREATE PAYMENT INTENT
--------------------------------------------------- */
export const newPayment = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    const { amount } = req.body;

    if (!amount) return next(new ErrorHandler("Amount is required", 400));

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      automatic_payment_methods: { enabled: true },
      metadata: { company: "ELearning" },
    });

    res.status(201).json({
      success: true,
      clientSecret: paymentIntent.client_secret,
    });
  }
);

/* ---------------------------------------------------
   CREATE ORDER (VERIFY STRIPE PAYMENT)
--------------------------------------------------- */
export const createOrder = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    const { courseId, payment_info } = req.body as {
      courseId: string;
      payment_info: { id: string };
    };

    if (!payment_info?.id)
      return next(new ErrorHandler("Payment info missing", 400));

    // Verify Stripe payment
    const paymentIntent = await stripe.paymentIntents.retrieve(payment_info.id);
    if (paymentIntent.status !== "succeeded")
      return next(new ErrorHandler("Payment not successful", 400));

    // Get user
    const user = await userModel.findById(req.user?._id);
    if (!user) return next(new ErrorHandler("User not found", 404));

    // Check already purchased
    const alreadyPurchased = user.courses.some(
      (c) => c.toString() === courseId
    );
    if (alreadyPurchased)
      return next(new ErrorHandler("Course already purchased", 400));

    // Get course
    const course = (await CourseModel.findById(courseId).exec()) as ICourse | null;
    if (!course) return next(new ErrorHandler("Course not found", 404));

    // Save order
    await OrderModel.create({
      courseId: course._id,
      userId: user._id,
      payment_info,
    });

    // Update user courses
    user.courses.push(course._id as mongoose.Types.ObjectId);
    await user.save();

    // Update course purchased
    course.purchased = (course.purchased || 0) + 1;
    await course.save();

    // Notification
    await NotificationModel.create({
      user: user._id,
      title: "New Order",
      message: `You purchased ${course.name}`,
    });

    // Email
    await sendEmail({
      email: user.email,
      subject: "Order Confirmation",
      template: "order-confirmation.ejs",
      data: {
        order: {
          name: course.name,
          price: course.price,
          date: new Date().toLocaleDateString(),
        },
      },
    });

    res.status(201).json({ success: true, message: "Course purchased successfully" });
  }
);

/* ---------------------------------------------------
   GET ALL ORDERS (ADMIN)
--------------------------------------------------- */
export const getAllOrders = catchAsyncErrors(
  async (_req: Request, res: Response) => {
    const orders = await OrderModel.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, orders });
  }
);
