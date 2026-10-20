import { Router } from "express";
import rateLimit from "express-rate-limit";
import { config } from "../../config/env";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as controller from "./auth.controller";
import { googleLoginSchema } from "./auth.validation";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.NODE_ENV === "test",
  handler: (_req, res) => {
    res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many attempts, try again in a minute" } });
  },
});

authRouter.get("/config", controller.publicConfig);
authRouter.post("/google", loginLimiter, validate({ body: googleLoginSchema }), controller.googleLogin);
authRouter.post("/logout", controller.logout);
authRouter.get("/me", authenticate, controller.me);
