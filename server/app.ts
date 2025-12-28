import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRouter from "./routes/user.routes";
import ErrorHandler from "./utils/ErrorHandler";
import CourseRouter from "./routes/course.route";
import orderRouter from "./routes/order.routes";
import notificationRouter from "./routes/notification.route";
import analyticsRouter from "./routes/analytics.route";
import layoutRouter from "./routes/layout.routes";

export const app: Application = express();

// =====================
// Middleware
// =====================

//  Body parsers with large limits for base64 images
app.use(express.json({ limit: "10mb" })); 
app.use(express.urlencoded({ limit: "10mb", extended: true }));

//  Cookie parser
app.use(cookieParser());

//  CORS (must be before routes)
app.use(
  cors({
    origin: "http://localhost:3000", // your frontend
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// =====================
// Routes
// =====================
app.get("/", (req: Request, res: Response) => {
  res.send("API is running...");
});

app.use("/api/v1/user", userRouter);
app.use("/api/v1/course", CourseRouter);
app.use("/api/v1/order", orderRouter);
app.use("/api/v1/notification", notificationRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use("/api/v1/layout", layoutRouter);

// =====================
// Global Error Handling Middleware
// =====================
app.use(
  (err: ErrorHandler, req: Request, res: Response, next: NextFunction) => {
    const statusCode = (err as any).statusCode || 500;

    return res.status(statusCode).json({
      success: false,
      message: err.message || "Internal Server Error",
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
);

