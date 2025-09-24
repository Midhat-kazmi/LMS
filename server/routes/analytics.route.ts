import express from "express";
import { isAdmin, isAuthenticated } from "../middleware/auth";
import {
  getCourseAnalytics,
  getOrderAnalytics,
  getUserAnalytics,
} from "../controllers/analytics.controller";
import { refreshAccessToken } from "../controllers/user.controller";
const analyticsRouter = express.Router();
analyticsRouter.get(
  "/get-users-analytics",
  refreshAccessToken,
  isAuthenticated,
  isAdmin("admin"),
  getUserAnalytics
);
analyticsRouter.get(
  "/get-course-analytics",
   refreshAccessToken,
  isAuthenticated,
  isAdmin("admin"),
  getCourseAnalytics
);
analyticsRouter.get(
  "/get-order-analytics",
   refreshAccessToken,
  isAuthenticated,
  isAdmin("admin"),
  getOrderAnalytics
);
export default analyticsRouter;