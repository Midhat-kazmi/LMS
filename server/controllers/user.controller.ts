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
export const refreshAccessToken = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    const { refresh_token } = req.cookies;

    if (!refresh_token) {
      return next(new ErrorHandler("No refresh token provided", 401));
    }

    try {
      const decoded = jwt.verify(
        refresh_token,
        process.env.REFRESH_TOKEN as Secret
      ) as { id: string };

      const user = await userModel.findById(decoded.id);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      // Issue new access token
      const newAccessToken = jwt.sign(
        { id: user._id },
        process.env.ACCESS_TOKEN as Secret,
        { expiresIn: "15m" }
      );

      res.cookie("access_token", newAccessToken, accessTokenOptions);

      res.status(200).json({
        success: true,
        access_token: newAccessToken,
      });
    } catch (error) {
      return next(new ErrorHandler("Invalid or expired refresh token", 401));
    }
  }
);

// =====================
// Get User Info (from req.user via middleware)
// =====================
export const getUserInfo = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?._id || "";
      await getUserById(userId, res);
    } catch (error: any) {
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
interface IUpdatUserBody {
  name?: string;
  email?: string;
}
export const updateUserInfo = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.body as IUpdatUserBody;
      const userId = req.user?._id;
      if (!userId) {
        return next(new Error("User ID is undefined"));
      }
      const user = await userModel.findById(userId);

      if (name && user) {
        user.name = name;
      }

      await user?.save();
      await redis?.set(userId, JSON.stringify(user));
      res.status(201).json({
        success: true,
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// =====================
// Update User Password
// =====================
interface IUpdatePassword {
  oldPassword: string;
  newPassword: string;
}
export const updateUserPassword = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { oldPassword, newPassword } = req.body as IUpdatePassword;
      if (!oldPassword || !newPassword) {
        return next(new ErrorHandler("Please enter old and new password", 400));
      }
      const user = await userModel.findById(req.user?._id).select("+password");
      if (user?.password === undefined) {
        return next(new ErrorHandler("User not found", 404));
      }
      const isPasswordMatch = await user.comparePassword(oldPassword);
      if (!isPasswordMatch) {
        return next(new ErrorHandler("Old password is incorrect", 401));
      }
      user.password = newPassword;
      await user.save();
      const userId = req.user?._id || "";
      await redis?.set(userId, JSON.stringify(user));
      res.status(200).json({
        success: true,
        message: "Password updated successfully",
        user,
      });
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// =====================
// Admin: Get All Users
// =====================
export const getAllUsers = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await getAllUsersService(res);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);


// =====================
// Admin: Update User Role
// =====================
export const updateUserRole = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, role } = req.body;
      await updateUserRoleService(res, id, role);
    } catch (error: any) {
      return next(new ErrorHandler(error.message, 400));
    }
  }
);

// =====================
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
