import express from "express";
import { 
  registerUser, 
  activateUser,
  LoginUser,
  LogoutUser, 
  refreshAccessToken,   
  getUserInfo,
  socialAuth,
  updateUserInfo,
  updateUserPassword,

} from "../controllers/user.controller";
import { isAuthenticated } from "../middleware/auth";

const userRouter = express.Router();

userRouter.post("/register", registerUser);
userRouter.post("/activate", activateUser);
userRouter.post("/login", LoginUser);
userRouter.post("/logout", isAuthenticated, LogoutUser);

userRouter.get("/refresh", refreshAccessToken);


userRouter.get("/me", isAuthenticated, getUserInfo);

userRouter.post("/social-auth", socialAuth);
userRouter.put("/update-user-info", isAuthenticated, updateUserInfo);
userRouter.put("/update-user-password", isAuthenticated, updateUserPassword);


export default userRouter;
