import express from "express";
import {isAuthenticated} from "../middleware/auth"
import {createOrder, getAllOrders} from "../controllers/order.controller"
import { isAdmin } from "../middleware/auth";

const orderRouter =express.Router();


orderRouter.post("/create-order", isAuthenticated,createOrder)
orderRouter.post("/get-orders", isAdmin("admin") ,isAuthenticated,getAllOrders)



export default orderRouter;