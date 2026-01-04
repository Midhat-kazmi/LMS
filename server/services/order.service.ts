import { Response, NextFunction, Request } from "express";
import { catchAsyncErrors } from "../middleware/catchAsyncErrors";
import OrderModel, { IOrder } from "../models/order.model";

/* ======================================================
   CREATE NEW ORDER (SERVICE)
====================================================== */
export const newOrder = catchAsyncErrors(
  async (req: Request, res: Response, next: NextFunction) => {
    const orderData = req.body as IOrder;

    const order = await OrderModel.create(orderData);

    res.status(201).json({
      success: true,
      order,
    });
  }
);

/* ======================================================
   GET ALL ORDERS (ADMIN SERVICE)
====================================================== */
export const getAllOrdersService = async (res: Response) => {
  const orders = await OrderModel.find().sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    orders,
  });
};
