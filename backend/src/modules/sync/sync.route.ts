import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as controller from "./sync.controller";
import { streamChanges } from "./sync.events";
import { pullQuerySchema, pushSchema } from "./sync.validation";

export const syncRouter = Router();

syncRouter.use(authenticate);
syncRouter.get("/events", streamChanges);
syncRouter.post("/push", validate({ body: pushSchema }), controller.push);
syncRouter.get("/pull", validate({ query: pullQuerySchema }), controller.pull);
