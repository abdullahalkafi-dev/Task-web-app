import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { UserModel } from "../user/user.model";
import { ApiKeyModel } from "../apikey/apikey.model";
import { AppError } from "../../utils/AppError";
import { catchAsync } from "../../utils/catchAsync";
import { AGENT_DOCS } from "./agent.docs";
import { TaskModel } from "../task/task.model";
import { NoteModel } from "../note/note.model";
import { toTaskDTO } from "../task/task.service";
import { toNoteDTO } from "../note/note.service";
import { dhakaDateKey } from "../../utils/dhaka";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const escapeRe = (v: string): string => v.replace(/[.*+?^${}()|[\]\\]/g, (m) => "\\" + m);
function since(v: unknown): Date | undefined {
  const s = str(v);
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new AppError(400, "VALIDATION_ERROR", "updatedSince must be an ISO date-time");
  return d;
}
function day(v: unknown, name: string): string | undefined {
  const s = str(v);
  if (s && !DAY.test(s)) throw new AppError(400, "VALIDATION_ERROR", `${name} must be YYYY-MM-DD`);
  return s;
}

export const agentRouter = Router();

agentRouter.get("/docs", (_req, res) => {
  res.type("text/markdown; charset=utf-8").send(AGENT_DOCS);
});

agentRouter.get(
  "/me",
  authenticate,
  catchAsync(async (req, res) => {
    const user = await UserModel.findById(req.user.id).lean();
    if (!user) throw new AppError(401, "UNAUTHORIZED", "Authentication required");
    let auth: { type: "api_key" | "session"; keyName?: string; mode: "read" | "write" } = {
      type: "session",
      mode: "write",
    };
    if (req.apiKey) {
      const key = await ApiKeyModel.findById(req.apiKey.id).lean();
      auth = { type: "api_key", keyName: key?.name, mode: req.apiKey.write ? "write" : "read" };
    }
    res.set("Cache-Control", "private, no-store");
    res.json({
      user: { id: user._id, email: user.email, name: user.name ?? "" },
      auth,
      serverTime: new Date().toISOString(),
    });
  }),
);

/** Filtered read of the caller's personal tasks (never deleted ones). */
agentRouter.get(
  "/tasks",
  authenticate,
  catchAsync(async (req, res) => {
    const q = req.query as Record<string, unknown>;
    const filter: Record<string, unknown> = { userId: req.user.id, deletedAt: null };
    const from = day(q.from, "from");
    const to = day(q.to, "to");
    if (from || to) filter.taskDate = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    const status = str(q.status);
    if (status) {
      if (!["notStarted", "started", "completed"].includes(status)) throw new AppError(400, "VALIDATION_ERROR", "Invalid status");
      filter.status = status;
    }
    if (q.overdue === "true") {
      filter.status = { $ne: "completed" };
      const before = dhakaDateKey();
      const existing = (filter.taskDate ?? {}) as Record<string, string>;
      filter.taskDate = { ...existing, $lt: existing.$lte && existing.$lte < before ? existing.$lte : before };
    }
    const updated = since(q.updatedSince);
    if (updated) filter.serverUpdatedAt = { $gt: updated };
    const text = str(q.q);
    if (text) {
      const re = new RegExp(escapeRe(text.slice(0, 100)), "i");
      filter.$or = [{ title: re }, { descriptionText: re }];
    }
    const docs = await TaskModel.find(filter).sort({ taskDate: 1, orderIndex: 1 }).limit(500).lean();
    res.set("Cache-Control", "private, no-store");
    res.json({ tasks: docs.map(toTaskDTO), today: dhakaDateKey() });
  }),
);

/** Filtered read of the caller's personal notes (never deleted ones). */
agentRouter.get(
  "/notes",
  authenticate,
  catchAsync(async (req, res) => {
    const q = req.query as Record<string, unknown>;
    const filter: Record<string, unknown> = { userId: req.user.id, deletedAt: null };
    const updated = since(q.updatedSince);
    if (updated) filter.serverUpdatedAt = { $gt: updated };
    const text = str(q.q);
    if (text) {
      const re = new RegExp(escapeRe(text.slice(0, 100)), "i");
      filter.$or = [{ title: re }, { descriptionText: re }];
    }
    const docs = await NoteModel.find(filter).sort({ orderIndex: 1 }).limit(500).lean();
    res.set("Cache-Control", "private, no-store");
    res.json({ notes: docs.map(toNoteDTO) });
  }),
);
