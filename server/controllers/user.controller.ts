require("dotenv").config();
import { Request, Response, NextFunction } from "express";
import userModel, { IUser } from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import { catchAsyncErrors } from "../middleware/catchAsyncErrors";
import jwt, { Secret, JwtPayload } from "jsonwebtoken";
import sendEmail from "../utils/sendMail";
import { sendToken } from "../utils/jwt";
import redis from "../utils/redis";
import {
  getAllUsersService,
  getUserById,
  updateUserRoleService,
} from "../services/user.services";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import { CookieOptions } from "express";

// =====================
// Interfaces
// =====================
interface IRegistrationBody {
  name: string;
  email: string;
  password: string;
  avatar?: string;
}

interface IActivationToken {
  token: string;
  activationCode: string;
}

interface IActivationRequest {
  activationToken: string;
  activationCode: string;
}

interface ILoginRequest {
  email: string;
  password: string;
}

interface AuthenticatedRequest extends Request {
  user?: IUser;
}

interface ISocialAuthBody {
  email: string;
  name: string;
  avatar: string;
}

interface IUpdateUserBody {
  name?: string;
  email?: string;
}

interface IUpdatePassword {
  oldPassword: string;
  newPassword: string;
}

// =====================
// Register User
// =====================
export const registerUser = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    const { name, email, password, avatar } = req.body as IRegistrationBody;

    const isEmailExist = await userModel.findOne({ email });
    if (isEmailExist) {
      return next(new ErrorHandler("Email already exists!", 400));
    }

    const user: IRegistrationBody = { name, email, password, avatar };
    const activationToken = createActivationToken(user);
    const activationCode = activationToken.activationCode;
    const data = { user: { name: user.name }, activationCode };

    try {
      await sendEmail({
        email: user.email,
        subject: "Activate your account",
        template: "activation-mail.ejs",
        data,
      });

      res.status(201).json({
        success: true,
        message: `Please check your email ${user.email} to activate your account`,
        activationToken: activationToken.token,
        activationCode,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// =====================
// Create Activation Token
// =====================
export const createActivationToken = (
  user: IRegistrationBody
): IActivationToken => {
  const activationCode = Math.floor(100000 + Math.random() * 900000).toString();

  const token = jwt.sign(
    { user, activationCode },
    process.env.ACTIVATION_SECRET as Secret,
    { expiresIn: "5m" }
  );

  return { token, activationCode };
};

// =====================
// Activate User
// =====================
export const activateUser = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    const { activationToken, activationCode } =
      req.body as IActivationRequest;

    if (!activationToken || !activationCode) {
      return next(
        new ErrorHandler("Activation token and code are required", 400)
      );
    }

    let decoded: { user: IUser; activationCode: string };

    try {
      decoded = jwt.verify(
        activationToken,
        process.env.ACTIVATION_SECRET as Secret
      ) as { user: IUser; activationCode: string };
    } catch (err) {
      return next(new ErrorHandler("Invalid or expired token", 400));
    }

    if (decoded.activationCode !== activationCode) {
      return next(new ErrorHandler("Invalid activation code", 400));
    }

    const { name, email, password } = decoded.user;
    const existUser = await userModel.findOne({ email });
    if (existUser) {
      return next(new ErrorHandler("Email already exists", 400));
    }

    await userModel.create({ name, email, password });

    res.status(201).json({
      success: true,
      message: "User activated successfully",
    });
  }
);

// =====================
// Login User
// =====================
export const LoginUser = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body as ILoginRequest;

    if (!email || !password) {
      return next(new ErrorHandler("Please enter email and password", 400));
    }

    const user = await userModel.findOne({ email }).select("+password");
    if (!user) return next(new ErrorHandler("Invalid email or password", 401));

    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) return next(new ErrorHandler("Invalid email or password", 401));

    sendToken(user, 200, res);
  }
);

// =====================
// Logout User
// =====================
export const LogoutUser = catchAsyncErrors(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    res.cookie("access_token", "", { maxAge: 1 });
    res.cookie("refresh_token", "", { maxAge: 1 });

    const userId = req.user?._id;
    if (userId) await redis.del(userId.toString());

    res.status(200).json({
      success: true,
      message: "User logged out successfully.",
    });
  }
);

// =====================
// Get Current User
// =====================
export const getUser = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    const { access_token } = req.cookies;

    if (!access_token) return next(new ErrorHandler("Not authenticated", 401));

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(access_token, process.env.ACCESS_TOKEN as Secret) as JwtPayload;
    } catch {
      return next(new ErrorHandler("Invalid or expired token", 401));
    }

    const user = await userModel.findById(decoded.id).select("-password");
    if (!user) return next(new ErrorHandler("User not found", 404));

    res.status(200).json({ success: true, user });
  }
);

// =====================
// Refresh Access Token
// =====================
export const refreshAccessToken = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    const refresh_token = req.cookies.refresh_token;
    if (!refresh_token) return next(new ErrorHandler("No refresh token provided", 401));

    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(refresh_token, process.env.REFRESH_TOKEN as Secret) as JwtPayload;
    } catch {
      return next(new ErrorHandler("Invalid or expired refresh token", 401));
    }

    if (!decoded?.id) return next(new ErrorHandler("Invalid refresh token payload", 401));

    const access_token = jwt.sign(
      { id: decoded.id },
      process.env.ACCESS_TOKEN as Secret,
      { expiresIn: "15m" }
    );

    const cookieOptions: CookieOptions = {
      httpOnly: true,
      maxAge: 15 * 60 * 1000,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    };

    res.cookie("access_token", access_token, cookieOptions);

    res.status(200).json({ success: true, access_token });
  }
);

// =====================
// Get User Info
// =====================
export const getUserInfo = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    // 1. Get token from cookies OR Authorization header
    let access_token = req.cookies?.access_token;
    if (!access_token && req.headers.authorization?.startsWith("Bearer ")) {
      access_token = req.headers.authorization.split(" ")[1];
    }

    if (!access_token) {
      return res.status(401).json({ success: false, message: "Not authenticated" });
    }

    // 2. Verify token
    let decoded: JwtPayload;
    try {
      decoded = jwt.verify(access_token, process.env.ACCESS_TOKEN as Secret) as JwtPayload;
    } catch (err) {
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }

    // 3. Fetch user from database
    const user = await userModel.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // 4. Return user
    res.status(200).json({ success: true, user });
  }
);


// =====================
// Social Auth
// =====================
export const socialAuth = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, name, avatar } = req.body as ISocialAuthBody;

    let user = await userModel.findOne({ email });
    if (!user) {
      user = await userModel.create({ email, name, avatar });
    }

    sendToken(user, 200, res);
  }
);

// =====================
// Update User Info
// =====================
export const updateUserInfo = catchAsyncErrors(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?._id;
    if (!userId) return next(new ErrorHandler("User not authenticated", 401));

    const { name, email } = req.body as IUpdateUserBody;

    const user = await userModel.findById(userId);
    if (!user) return next(new ErrorHandler("User not found", 404));

    if (name) user.name = name;
    if (email) user.email = email;

    await user.save();

    res.status(200).json({ success: true, message: "User updated successfully", user });
  }
);

// =====================
// Update User Password
// =====================
export const updateUserPassword = catchAsyncErrors(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { oldPassword, newPassword } = req.body as IUpdatePassword;

    const userId = req.user?._id;
    if (!userId) return next(new ErrorHandler("User not authenticated", 401));

    const user = await userModel.findById(userId).select("+password");
    if (!user || !user.password) return next(new ErrorHandler("User not found", 404));

    const isPasswordMatch = await user.comparePassword(oldPassword);
    if (!isPasswordMatch) return next(new ErrorHandler("Old password is incorrect", 401));

    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: "Password updated successfully" });
  }
);

// =====================
// Update Profile Picture
// =====================
export const updateUserProfilePicture = catchAsyncErrors(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const file = (req as any).file;
    const userId = req.user?._id;
    if (!userId) return next(new ErrorHandler("User not authenticated", 401));
    if (!file) return next(new ErrorHandler("Please provide a profile picture", 400));

    const user = await userModel.findById(userId);
    if (!user) return next(new ErrorHandler("User not found", 404));

    if (user.avatar?.public_id) await cloudinary.uploader.destroy(user.avatar.public_id);

    const uploadFromBuffer = (fileBuffer: Buffer) =>
      new Promise<any>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "avatars", width: 150, crop: "scale" },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        streamifier.createReadStream(fileBuffer).pipe(stream);
      });

    const result = await uploadFromBuffer(file.buffer);

    user.avatar = { public_id: result.public_id, url: result.secure_url };
    await user.save();
    await redis.set(userId.toString(), JSON.stringify(user));

    res.status(200).json({ success: true, user });
  }
);

// =====================
// Admin: Delete User
// =====================
export const deleteUser = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const user = await userModel.findById(id);
    if (!user) return next(new ErrorHandler("User not found", 400));

    await user.deleteOne();
    await redis.del(id);

    res.status(201).json({ success: true, message: "User deleted successfully." });
  }
);

// =====================
// Get All Users
// =====================
export const getAllUsers = catchAsyncErrors(
  async (_req: Request, res: Response, next: NextFunction) => {
    getAllUsersService(res);
  }
);

// =====================
// Update User Role
// =====================
export const updateUserRole = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    const { id, role } = req.body;
    updateUserRoleService(res, id, role);
  }
);

