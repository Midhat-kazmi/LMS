import express from "express";
import { isAuthenticated, isAdmin } from "../middleware/auth";
import {
  createOrder,
  getAllOrders,
  newPayment,
  sendStripePublishableKey,
} from "../controllers/order.controller";

const router = express.Router();

router.post("/create-order", isAuthenticated, createOrder);
router.get("/get-orders", isAuthenticated, isAdmin("admin"), getAllOrders);
router.get("/stripe-key", isAuthenticated, sendStripePublishableKey);
router.post("/payment-intent", isAuthenticated, newPayment);

export default router;
