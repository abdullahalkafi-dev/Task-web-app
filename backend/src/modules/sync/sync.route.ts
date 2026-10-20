import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as controller from "./sync.controller";
import { pullQuerySchema, pushSchema } from "./sync.validation";

export const syncRouter = Router();

syncRouter.use(authenticate);
syncRouter.post("/push", validate({ body: pushSchema }), controller.push);
syncRouter.get("/pull", validate({ query: pullQuerySchema }), controller.pull);
