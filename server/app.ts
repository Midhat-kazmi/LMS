import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

import userRouter from "./routes/user.routes";
import CourseRouter from "./routes/course.route";
import orderRouter from "./routes/order.routes";
import notificationRouter from "./routes/notification.route";
import analyticsRouter from "./routes/analytics.route";
import layoutRouter from "./routes/layout.routes";
import ErrorHandler from "./utils/ErrorHandler";

const app: Application = express();

/* =====================
   Middleware
===================== */

// Body parsers
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Cookies
app.use(cookieParser());

// CORS (IMPORTANT for Vercel)
app.use(
  cors({
    origin: "https://client-lms-olive.vercel.app",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/* =====================
   Routes
===================== */

app.get("/", (_req: Request, res: Response) => {
  res.send("API is running...");
});

app.use("/api/v1/user", userRouter);
app.use("/api/v1/course", CourseRouter);
app.use("/api/v1/order", orderRouter);
app.use("/api/v1/notification", notificationRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use("/api/v1/layout", layoutRouter);

/* =====================
   Global Error Handler
===================== */

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

export default app;
