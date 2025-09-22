require("dotenv").config();
import { Request, Response, NextFunction } from "express";
import userModel, { IUser } from "../models/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import { catchAsyncErrors } from "../middleware/catchAsyncErrors";
import jwt, { Secret } from "jsonwebtoken";
import sendEmail from "../utils/sendMail";
import { accessTokenOptions, sendToken } from "../utils/jwt";
import redis from "../utils/redis";
import {
  getAllUsersService,
  getUserById,
  updateUserRoleService,
} from "../services/user.services";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import { JwtPayload } from "jsonwebtoken";


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

// =====================
// Register User
// =====================
export const registerUser = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name, email, password, avatar } = req.body;

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
    } catch (error: any) {
      next(new ErrorHandler(error.message, 400));
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
    try {
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
    } catch (error: any) {
      next(new ErrorHandler(error.message, 400));
    }
  }
);

// =====================
// Login User
// =====================
interface ILoginRequest {
  email: string;
  password: string;
}
export const LoginUser = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body as ILoginRequest;
      if (!email || !password) {
        return next(new ErrorHandler("Please enter email and password", 400));
      }
      const user = await userModel.findOne({ email }).select("+password");
      if (!user) {
        return next(new ErrorHandler("Invalid email or password", 401));
      }
      const isPasswordMatch = await user.comparePassword(password);
      if (!isPasswordMatch) {
        return next(new ErrorHandler("Invalid email or password", 401));
      }
      sendToken(user, 200, res);
    } catch (error: any) {
      next(new ErrorHandler(error.message, 400));
    }
  }
);

// =====================
// Logout User
// =====================
interface AuthenticatedRequest extends Request {
  user?: IUser;
}

export const LogoutUser = catchAsyncErrors(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      res.cookie("access_token", "", { maxAge: 1 });
      res.cookie("refresh_token", "", { maxAge: 1 });
      const userId = req.user?._id || "";
      redis.del(userId);
      res.status(200).json({
        success: true,
        message: "User logged out successfully.",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// =====================
// Get Current User (from access_token)
// =====================
export const getUser = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    const { access_token } = req.cookies;

    if (!access_token) {
      return next(new ErrorHandler("Not authenticated", 401));
    }

    try {
      const decoded = jwt.verify(
        access_token,
        process.env.ACCESS_TOKEN as Secret
      ) as { id: string };

      const user = await userModel.findById(decoded.id).select("-password");
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      res.status(200).json({
        success: true,
        user,
      });
    } catch (error) {
      return next(new ErrorHandler("Invalid or expired token", 401));
    }
  }
);

// =====================
// Refresh Access Token
// =====================

export const refreshAccessToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const refresh_token = req.cookies.refresh_token as string;

    if (!refresh_token) {
      return next(new ErrorHandler("No refresh token provided", 401));
    }

    const decoded = jwt.verify(
      refresh_token,
      process.env.REFRESH_TOKEN as string
    ) as JwtPayload;

    if (!decoded) {
      return next(new ErrorHandler("Invalid refresh token", 401));
    }

    // Generate new access token
    const access_token = jwt.sign(
      { id: decoded.id },
      process.env.ACCESS_TOKEN as string,
      { expiresIn: "15m" }
    );

    //  Save it for later use
    res.locals.access_token = access_token;

    next(); // continue to actual controller
  } catch (error: any) {
    return next(new ErrorHandler(error.message, 500));
  }
};
// =====================
// Get User Info (from req.user via middleware)
// =====================
//get user Info
export const getUserInfo = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?._id || "";
      getUserById(userId, res);
    } catch (error:any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


// =====================
// Social Auth
// =====================
interface ISocialAuthBody {
  email: string;
  name: string;
  avatar: string;
}
export const socialAuth = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, name, avatar } = req.body as ISocialAuthBody;
      const user = await userModel.findOne({ email });
      if (!user) {
        const newUser = await userModel.create({ email, name, avatar });
        sendToken(newUser, 200, res);
      } else {
        sendToken(user, 200, res);
      }
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// =====================
// Update User Info
// =====================
interface IUpdateUserBody {
  name?: string;
  email?: string;
}

export const updateUserInfo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log("updateUserInfo hit ");

    const { name, email } = req.body as IUpdateUserBody;
    const userId = (req as any).user?._id;

    console.log("req.user:", (req as any).user);

    if (!userId) {
      return next(new ErrorHandler("User ID is undefined", 400));
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    if (name) user.name = name;
    if (email) user.email = email;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      user,
    });
  } catch (error: any) {
    console.error("updateUserInfo error:", error);
    return next(new ErrorHandler(error.message, 500));
  }
};
// =====================
// Update User Password
// =====================
interface IUpdatePassword {
  oldPassword: string;
  newPassword: string;
}

// =====================
export const updateUserPassword = catchAsyncErrors(
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { oldPassword, newPassword } = req.body as IUpdatePassword;

    if (!oldPassword || !newPassword) {
      return next(new ErrorHandler("Please enter old and new password", 400));
    }

    const user = await userModel.findById(req.user?._id).select("+password");
    if (!user || !user.password) {
      return next(new ErrorHandler("User not found", 404));
    }

    console.log("entered oldPassword:", oldPassword);
    console.log("stored hashed password:", user.password);

    const isPasswordMatch = await user.comparePassword(oldPassword);
    if (!isPasswordMatch) {
      return next(new ErrorHandler("Old password is incorrect", 401));
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  }
);

//Profile Picture Update


export const updateUserProfilePicture = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    const file = (req as any).file; // multer stores uploaded file here
    const userId = req.user?._id;

    if (!userId) return next(new ErrorHandler("User not authenticated", 401));
    if (!file) return next(new ErrorHandler("Please provide a profile picture", 400));

    const user = await userModel.findById(userId);
    if (!user) return next(new ErrorHandler("User not found", 404));

    // Delete old avatar from Cloudinary if exists
    if (user.avatar?.public_id) {
      await cloudinary.uploader.destroy(user.avatar.public_id);
    }

    // Upload new avatar to Cloudinary
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

    user.avatar = {
      public_id: result.public_id,
      url: result.secure_url,
    };

    await user.save();

    // Update Redis cache (optional)
    await redis.set(userId, JSON.stringify(user));

    res.status(200).json({
      success: true,
      user,
    });
  }
);

// Admin: Delete User
// =====================
export const deleteUser = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await userModel.findById(id);
      if (!user) {
        return next(new ErrorHandler("User not found", 400));
      }
      await user.deleteOne({ id });
      await redis.del(id); 
      res.status(201).json({
        success: true,
        message: "User deleted successfully.",
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


export const getAllUsers = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
    getAllUsersService(res);
    } catch (error:any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);