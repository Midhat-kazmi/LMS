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
  updateUserProfilePicture,
  getAllUsers,
  updateUserRole,
  deleteUser

} from "../controllers/user.controller";
import { isAuthenticated } from "../middleware/auth";
import upload  from "../middleware/multer"; 
import { isAdmin } from "../middleware/auth";

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
userRouter.put(
  "/update-profile-picture",
  isAuthenticated,
  upload.single("avatar"), 
  updateUserProfilePicture
);

userRouter.get("/get-users", isAuthenticated, isAdmin("admin"), getAllUsers)

userRouter.get("/update-user", isAuthenticated, isAdmin("admin"), updateUserRole)



userRouter.delete("/delete-user/:id", isAuthenticated, isAdmin("admin"), deleteUser)




export default userRouter;
