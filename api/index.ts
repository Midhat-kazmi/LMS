import type { VercelRequest, VercelResponse } from "@vercel/node";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import userRouter from "../../Lms/server/routes/user.routes";
import CourseRouter from "../../Lms/server/routes/course.route";
import orderRouter from "../../Lms/server/routes/order.routes";
import notificationRouter from "../../Lms/server/routes/notification.route";
import analyticsRouter from "../../Lms/server/routes/analytics.route";
import layoutRouter from "../../Lms/server/routes/layout.routes";
import ErrorHandler from "../../Lms/server/utils/ErrorHandler";
import connectDB from "../../Lms/server/utils/db";

dotenv.config();
connectDB(); // Connect to MongoDB

const app = express();

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Cookies
app.use(cookieParser());

// CORS (allow your frontend URL)
app.use(
  cors({
    origin: "https://client-lms-olive.vercel.app",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Routes
app.get("/", (_req: Request, res: Response) => {
  res.send("API is running...");
});
app.use("/api/v1/user", userRouter);
app.use("/api/v1/course", CourseRouter);
app.use("/api/v1/order", orderRouter);
app.use("/api/v1/notification", notificationRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use("/api/v1/layout", layoutRouter);

// Global error handler
app.use(
  (
    err: ErrorHandler,
    _req: Request,
    res: Response,
    _next: NextFunction
  ) => {
    const statusCode = (err as any).statusCode || 500;

    res.status(statusCode).json({
      success: false,
      message: err.message || "Internal Server Error",
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
);

// Export as a Vercel serverless function
export default function handler(req: VercelRequest, res: VercelResponse) {
  app(req as any, res as any);
}
