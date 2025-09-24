import express from "express";
import { isAdmin, isAuthenticated } from "../middleware/auth";
import { createLayout, editLayout, getLayoutByType } from "../controllers/layout.controller";
import { refreshAccessToken } from "../controllers/user.controller";
const layoutRouter = express.Router();
layoutRouter.post("/create-layout",
       refreshAccessToken,
    isAuthenticated,
    isAdmin("admin"),
    createLayout
);
layoutRouter.put("/edit-layout",
       refreshAccessToken,
    isAuthenticated,
    isAdmin("admin"),
    editLayout
);
layoutRouter.get("/get-layout/:type",
    getLayoutByType
);
export default layoutRouter;