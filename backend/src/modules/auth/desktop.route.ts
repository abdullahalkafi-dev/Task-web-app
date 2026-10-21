import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../../config/env";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import { catchAsync } from "../../utils/catchAsync";
import * as service from "./desktop.service";

export const desktopAuthRouter = Router();
const requestId = z.string().regex(/^[a-f0-9]{48}$/);
const limiter = (limit: number) => rateLimit({ windowMs: 60_000, limit, standardHeaders: true, legacyHeaders: false, skip: () => config.NODE_ENV === "test" });
desktopAuthRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
desktopAuthRouter.post("/start", limiter(10), validate({ body: z.object({ challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }) }), catchAsync(async (req, res) => {
  const body = req.body as { challenge: string };
  res.status(201).json(await service.start(body.challenge));
}));
desktopAuthRouter.get("/request/:requestId", limiter(40), authenticate, validate({ params: z.object({ requestId }) }), catchAsync(async (req, res) => {
  res.json(await service.details(String(req.params.requestId)));
}));
desktopAuthRouter.post("/approve", limiter(10), authenticate, validate({ body: z.object({ requestId, code: z.string().regex(/^\d{6}$/) }) }), catchAsync(async (req, res) => {
  const body = req.body as { requestId: string; code: string };
  await service.approve(body.requestId, body.code, req.user.id);
  res.json({ ok: true });
}));
desktopAuthRouter.post("/exchange", limiter(180), validate({ body: z.object({ requestId, verifier: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }) }), catchAsync(async (req, res) => {
  const body = req.body as { requestId: string; verifier: string };
  const session = await service.exchange(body.requestId, body.verifier);
  if (!session) { res.status(202).json({ pending: true }); return; }
  res.json(session);
}));
