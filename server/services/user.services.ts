import { Response } from "express";
import redis from "../utils/redis";
import userModel from "../models/user.model";

export const getUserById = async (id: string, res: Response) => {
  // 1. Try Redis cache
  const userJson = await redis.get(id);
  if (userJson) {
    const user = JSON.parse(userJson);
    return res.status(200).json({
      success: true,
      user,
      source: "cache",
    });
  }

  // 2. Fallback: Fetch from DB
  const user = await userModel.findById(id).select("-password");
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  // 3. Save to Redis
  await redis.set(id, JSON.stringify(user));

  res.status(200).json({
    success: true,
    user,
    source: "db",
  });
};

// Get all users
export const getAllUsersService = async (res: Response) => {
  const users = await userModel.find().sort({ createdAt: -1 });
  res.status(200).json({
    success: true,
    users,
  });
};

// Update user role service
export const updateUserRoleService = async (
  res: Response,
  id: string,
  role: string
) => {
  const user = await userModel.findByIdAndUpdate(
    id,
    { role },
    { new: true }
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found",
    });
  }

  res.status(200).json({
    success: true,
    message: "User role updated successfully",
    user,
  });
};
