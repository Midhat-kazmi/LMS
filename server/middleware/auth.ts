import { Request, Response, NextFunction } from "express";
import jwt, { Secret } from "jsonwebtoken";
import userModel, { IUser } from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import { catchAsyncErrors } from "./catchAsyncErrors";

// =====================
// Authenticate User
// =====================
export const isAuthenticated = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    const { access_token } = req.cookies;

    if (!access_token) {
      return next(new ErrorHandler("Please login to access this resource", 401));
    }

    try {
      const decoded = jwt.verify(
        access_token,
        process.env.ACCESS_TOKEN as Secret
      ) as { id: string };

      const user = await userModel.findById(decoded.id);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      req.user = user; // globally typed
      next();
    } catch (error) {
      return next(new ErrorHandler("Invalid or expired token", 401));
    }
  }
);

// =====================
// Authorize Roles
// =====================
export const isAdmin = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user?.role || "")) {
      return next(
        new ErrorHandler(
          `Role: ${req.user?.role || "unknown"} is not allowed to access this resource`,
          403
        )
      );
    }
    next();
  };
};
