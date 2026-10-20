import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { requireRole } from "../../middleware/requireRole";
import * as controller from "./user.controller";

export const userRouter = Router();

userRouter.use(authenticate, requireRole("superadmin"));
userRouter.get("/stats", controller.stats);
