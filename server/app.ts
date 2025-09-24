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
app.use(express.json()); // parse JSON bodies
app.use(express.urlencoded({ extended: true })); // parse URL-encoded data
app.use(cookieParser());
app.use(cors({ origin: "*", credentials: true })); // adjust "origin" for your frontend

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

    res.status(statusCode).json({
      success: false,
      message: err.message || "Internal Server Error",
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined, // optional
    });
  }
);
