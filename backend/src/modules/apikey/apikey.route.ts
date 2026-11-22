import { Router, type RequestHandler } from "express";
import { authenticate, rejectApiKey } from "../../middleware/auth";
import * as c from "./apikey.controller";

const noStore: RequestHandler = (_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
};

export const apiKeyRouter = Router();
apiKeyRouter.use(authenticate, rejectApiKey, noStore);
apiKeyRouter.get("/", c.list);
apiKeyRouter.post("/", c.create);
apiKeyRouter.patch("/:id", c.patch);
apiKeyRouter.post("/:id/rotate", c.rotate);
apiKeyRouter.delete("/:id", c.remove);
