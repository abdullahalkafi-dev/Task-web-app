import { Router, type RequestHandler } from "express";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { authenticate } from "../../middleware/auth";
import { uploadMiddleware } from "../upload/upload.service";
import { requireMember } from "./team.service";
import { catchAsync } from "../../utils/catchAsync";
import * as c from "./team.controller";
const limit = (max: number) =>
  rateLimit({
    windowMs: 60_000,
    limit: max,
    keyGenerator: (req) => req.user.id,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: () => process.env.NODE_ENV === "test",
    message: {
      error: {
        code: "RATE_LIMIT",
        message: "Please wait a moment and try again.",
      },
    },
  });
const noStore: RequestHandler = (_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  res.vary("Authorization");
  res.vary("Cookie");
  next();
};
export const teamRouter = Router();
teamRouter.use(noStore);
teamRouter.use(authenticate);
for (const name of ["id", "taskId", "userId", "inviteId"])
  teamRouter.param(name, (_req, _res, next, value: string) => {
    const result = z.uuid().safeParse(value);
    next(result.success ? undefined : result.error);
  });
teamRouter.get("/", c.list);
teamRouter.post("/", limit(10), c.create);
teamRouter.get("/invites", c.invites);
teamRouter.post("/invites/:id/accept", c.accept);
teamRouter.post("/invites/:id/decline", c.decline);
teamRouter.get("/:id", c.detail);
teamRouter.delete("/:id", c.remove);
teamRouter.post("/:id/invites", limit(5), c.invite);
teamRouter.delete("/:id/invites/:inviteId", c.cancelInvite);
teamRouter.post("/:id/leave", c.leave);
teamRouter.delete("/:id/members/:userId", c.removeMember);
teamRouter.get("/:id/history", c.history);
teamRouter.get("/:id/tasks", c.tasks);
teamRouter.post("/:id/tasks", limit(60), c.createTask);
teamRouter.get("/:id/tasks/:taskId", c.task);
teamRouter.patch("/:id/tasks/:taskId", limit(180), c.patchTask);
teamRouter.delete("/:id/tasks/:taskId", c.removeTask);
teamRouter.post("/:id/tasks/:taskId/restore", c.restore);
teamRouter.get("/:id/tasks/:taskId/events", c.events);
teamRouter.get("/:id/tasks/:taskId/messages", c.messages);
teamRouter.post("/:id/tasks/:taskId/messages", limit(30), c.sendMessage);
teamRouter.post("/:id/tasks/:taskId/read", c.read);
teamRouter.post(
  "/:id/uploads",
  limit(15),
  catchAsync(async (req, _res, next) => {
    await requireMember(req.params.id, req.user.id);
    next();
  }),
  uploadMiddleware,
  c.upload,
);
export const teamFileRouter = Router();
teamFileRouter.use(noStore);
teamFileRouter.get("/:id/:file", authenticate, c.serveImage);
