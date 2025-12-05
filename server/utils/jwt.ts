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
  domain?: string;
  path?: string;
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

// ======================================================
// BASE COOKIE OPTIONS (DEV DEFAULTS)
// ======================================================
export const baseAccessTokenOptions: ITokenOptions = {
  expires: new Date(Date.now() + accesstokenExpiresIn * 60 * 1000),
  maxAge: accesstokenExpiresIn * 60 * 1000,
  httpOnly: true,
  sameSite: "lax",
  secure: false,
  domain: "localhost",
  path: "/",
};

export const baseRefreshTokenOptions: ITokenOptions = {
  expires: new Date(Date.now() + refreshtokenExpiresIn * 24 * 60 * 60 * 1000),
  maxAge: refreshtokenExpiresIn * 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: "lax",
  secure: false,
  domain: "localhost",
  path: "/",
};

// ======================================================
// Send Token to Client
// ======================================================
export const sendToken = (user: IUser, statusCode: number, res: Response) => {
  const access_token = user.SignAccessToken();
  const refresh_token = user.SignRefreshToken();

  // Save user session in Redis
  redis.set(user._id, JSON.stringify(user));

  // Clone base options so we don't mutate them globally
  const accessTokenOptions: ITokenOptions = { ...baseAccessTokenOptions };
  const refreshTokenOptions: ITokenOptions = { ...baseRefreshTokenOptions };

  // ====================================================
  // PRODUCTION MODE OVERRIDES
  // ====================================================
  if (process.env.NODE_ENV === "production") {
    accessTokenOptions.secure = true;
    refreshTokenOptions.secure = true;

    accessTokenOptions.sameSite = "none";
    refreshTokenOptions.sameSite = "none";

    accessTokenOptions.domain =
      process.env.COOKIE_DOMAIN || baseAccessTokenOptions.domain;
    refreshTokenOptions.domain =
      process.env.COOKIE_DOMAIN || baseRefreshTokenOptions.domain;

    accessTokenOptions.path = "/";
    refreshTokenOptions.path = "/";
  }

  // ====================================================
  // SET COOKIES
  // ====================================================
  res.cookie("access_token", access_token, accessTokenOptions);
  res.cookie("refresh_token", refresh_token, refreshTokenOptions);

  // ====================================================
  // SEND RESPONSE
  // ====================================================
  res.status(statusCode).json({
    success: true,
    user,
    access_token,
  });
};
