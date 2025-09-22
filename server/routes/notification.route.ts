import express from "express";
const notificationRouter = express.Router();
import { isAdmin, isAuthenticated } from "../middleware/auth";
import {
  getNotifications,
  updateNotificationStatus,
} from "../controllers/notification.controller";
import { refreshAccessToken } from "../controllers/user.controller";



notificationRouter.get(
  "/get-all-notifications",
  refreshAccessToken,
  isAuthenticated,
  isAdmin("admin"),
  getNotifications
);

notificationRouter.put(
  "/update-notification/:id",
refreshAccessToken,
  isAuthenticated,
  isAdmin("admin"),
  updateNotificationStatus
);
export default notificationRouter;