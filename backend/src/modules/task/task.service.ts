import { randomUUID } from "node:crypto";
import { AppError } from "../../utils/AppError";
import { dhakaDateKey } from "../../utils/dhaka";
import { htmlToPlainText, sanitizeRichHtml } from "../../utils/sanitize";
import type { ITask, ITaskDTO, ITaskUpsert, ITaskUpsertResult } from "./task.interface";
import { TaskModel } from "./task.model";

export function toTaskDTO(t: ITask): ITaskDTO {
  return {
    id: t._id,
    taskDate: t.taskDate,
    title: t.title,
    descriptionHtml: t.descriptionHtml,
    descriptionText: t.descriptionText,
    estimatedMinutes: t.estimatedMinutes,
    status: t.status,
    orderIndex: t.orderIndex,
    copiedFromDate: t.copiedFromDate,
    copiedFromTaskId: t.copiedFromTaskId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    deletedAt: t.deletedAt ? t.deletedAt.toISOString() : null,
  };
}

export async function getByDate(userId: string, date: string): Promise<ITaskDTO[]> {
  const tasks = await TaskModel.find({ userId, taskDate: date, deletedAt: null })
    .sort({ orderIndex: 1 })
    .lean<ITask[]>();
  return tasks.map(toTaskDTO);
}

export async function getDatesInMonth(userId: string, month: string): Promise<string[]> {
  const dates = await TaskModel.distinct("taskDate", {
    userId,
    deletedAt: null,
    taskDate: { $regex: `^${month}-` },
  });
  return (dates as string[]).sort();
}

async function upsertOne(userId: string, doc: ITaskUpsert): Promise<ITaskUpsertResult> {
  const existing = await TaskModel.findById(doc.id).lean<ITask>();
  if (existing && existing.userId !== userId) {
    return { id: doc.id, applied: false, winner: null, error: "FORBIDDEN" };
  }
  const incomingUpdatedAt = new Date(doc.updatedAt);
  if (existing && existing.updatedAt.getTime() >= incomingUpdatedAt.getTime()) {
    return { id: doc.id, applied: false, winner: toTaskDTO(existing) };
  }
  const html = sanitizeRichHtml(doc.descriptionHtml);
  const saved = await TaskModel.findOneAndUpdate(
    { _id: doc.id, userId },
    {
      $set: {
        taskDate: doc.taskDate,
        title: doc.title,
        descriptionHtml: html,
        descriptionText: htmlToPlainText(html),
        estimatedMinutes: doc.estimatedMinutes,
        status: doc.status,
        orderIndex: doc.orderIndex,
        copiedFromDate: doc.copiedFromDate,
        copiedFromTaskId: doc.copiedFromTaskId,
        updatedAt: incomingUpdatedAt,
        serverUpdatedAt: new Date(),
        deletedAt: doc.deletedAt ? new Date(doc.deletedAt) : null,
      },
      $setOnInsert: { createdAt: new Date(doc.createdAt) },
    },
    { upsert: true, returnDocument: "after" },
  ).lean<ITask>();
  if (!saved) throw new AppError(500, "INTERNAL", "Failed to save task");
  return { id: doc.id, applied: true, winner: toTaskDTO(saved) };
}

/** Last-write-wins merge by `updatedAt`. Results are aligned with the input order. */
export async function upsertMany(userId: string, docs: ITaskUpsert[]): Promise<ITaskUpsertResult[]> {
  const results: ITaskUpsertResult[] = [];
  for (const doc of docs) results.push(await upsertOne(userId, doc));
  return results;
}

export async function copyToToday(userId: string, id: string): Promise<ITaskDTO> {
  const original = await TaskModel.findOne({ _id: id, userId, deletedAt: null }).lean<ITask>();
  if (!original) throw new AppError(404, "NOT_FOUND", "Task not found");
  const today = dhakaDateKey();
  const last = await TaskModel.findOne({ userId, taskDate: today, deletedAt: null })
    .sort({ orderIndex: -1 })
    .lean<ITask>();
  const now = new Date();
  const created = await TaskModel.create({
    _id: randomUUID(),
    userId,
    taskDate: today,
    title: original.title,
    descriptionHtml: original.descriptionHtml,
    descriptionText: original.descriptionText,
    estimatedMinutes: original.estimatedMinutes,
    status: "notStarted",
    orderIndex: last ? last.orderIndex + 1024 : 1024,
    copiedFromDate: original.taskDate,
    copiedFromTaskId: original._id,
    createdAt: now,
    updatedAt: now,
    serverUpdatedAt: now,
    deletedAt: null,
  });
  return toTaskDTO(created.toObject());
}

export async function pullSince(userId: string, since: Date | null): Promise<ITaskDTO[]> {
  const filter = since ? { userId, serverUpdatedAt: { $gt: since } } : { userId };
  const tasks = await TaskModel.find(filter).sort({ serverUpdatedAt: 1 }).lean<ITask[]>();
  return tasks.map(toTaskDTO);
}

export async function purgeTombstones(olderThan: Date): Promise<number> {
  const res = await TaskModel.deleteMany({ deletedAt: { $ne: null, $lt: olderThan } });
  return res.deletedCount;
}
