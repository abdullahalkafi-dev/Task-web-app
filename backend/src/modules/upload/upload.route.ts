import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as controller from "./upload.controller";
import { uploadMiddleware } from "./upload.service";
import { fileParamsSchema } from "./upload.validation";

/** POST /api/uploads — Bearer header required (state-changing). */
export const uploadApiRouter = Router();
uploadApiRouter.post("/", authenticate, uploadMiddleware, controller.upload);

/** GET /uploads/:userId/:file — plain <img src>, authenticated by the httpOnly cookie. */
export const uploadFileRouter = Router();
uploadFileRouter.get("/:userId/:file", authenticate, validate({ params: fileParamsSchema }), controller.serve);
