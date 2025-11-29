require("dotenv").config();
import { Response } from "express";
import { IUser } from "../models/user.model";
import redis from "./redis";

interface ITokenOptions {
  expires: Date;
  maxAge: number;
  httpOnly: boolean;
  sameSite: "lax" | "strict" | "none" | undefined;
  secure?: boolean;
}

// ==============================
// Parse environment variables
// ==============================

// Access token expiry in minutes (default: 5 minutes)
export const accesstokenExpiresIn = parseInt(
  process.env.ACCESS_TOKEN_EXPIRE || "5",
  10
);

// Refresh token expiry in days (default: 7 days)
export const refreshtokenExpiresIn = parseInt(
  process.env.REFRESH_TOKEN_EXPIRE || "7",
  10
);

// ==============================
// Cookie Options
// ==============================
export const accessTokenOptions: ITokenOptions = {
  expires: new Date(Date.now() + accesstokenExpiresIn * 60 * 1000),
  maxAge: accesstokenExpiresIn * 60 * 1000,
  httpOnly: true,
  sameSite: "none",
  secure: false, // ⬅️ for localhost only
};

export const refreshTokenOptions: ITokenOptions = {
  expires: new Date(Date.now() + refreshtokenExpiresIn * 24 * 60 * 60 * 1000),
  maxAge: refreshtokenExpiresIn * 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: "none",
  secure: false, // ⬅️ for localhost only
};


// ==============================
// Send Token Handler
// ==============================
export const sendToken = (user: IUser, statusCode: number, res: Response) => {
  const access_token = user.SignAccessToken();
  const refresh_token = user.SignRefreshToken();

  // Upload session to Redis (cache)
  redis.set(user._id, JSON.stringify(user) as any);

  // Only set secure to true in production
  if (process.env.NODE_ENV === "production") {
    accessTokenOptions.secure = true;
    refreshTokenOptions.secure = true;
  }

  // Set cookies
  res.cookie("access_token", access_token, accessTokenOptions);
  res.cookie("refresh_token", refresh_token, refreshTokenOptions);

  // Send response
  res.status(statusCode).json({
    success: true,
    user,
    access_token,
  });
};
