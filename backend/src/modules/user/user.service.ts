import { randomUUID } from "node:crypto";
import { NoteModel } from "../note/note.model";
import { TaskModel } from "../task/task.model";
import { UploadModel } from "../upload/upload.model";
import type { IUser, IUserPublic, IUserStats, IUserStatsRow } from "./user.interface";
import { UserModel } from "./user.model";

const ACTIVE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function toPublicUser(u: IUser): IUserPublic {
  return {
    id: u._id,
    email: u.email,
    ...(u.name ? { name: u.name } : {}),
    role: u.role,
    createdAt: u.createdAt.toISOString(),
  };
}

export function findById(id: string): Promise<IUser | null> {
  return UserModel.findById(id).lean<IUser>();
}

interface GoogleLoginInput {
  googleId: string;
  email: string;
  name?: string;
  /** True when the email is listed in SUPERADMIN_EMAILS. Promotes only; never demotes. */
  promote: boolean;
}

/** Creates the account on first sign-in; on every sign-in records the login and refreshes email and name. */
export function recordGoogleLogin(input: GoogleLoginInput): Promise<IUser> {
  const set: Record<string, unknown> = { email: input.email.toLowerCase(), lastLoginAt: new Date() };
  if (input.name) set.name = input.name;
  if (input.promote) set.role = "superadmin";
  return UserModel.findOneAndUpdate(
    { googleId: input.googleId },
    { $set: set, $inc: { loginCount: 1 }, $setOnInsert: { _id: randomUUID() } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean<IUser>() as Promise<IUser>;
}

interface CountRow {
  _id: string;
  n: number;
  bytes?: number;
}

function toMap(rows: CountRow[]): Map<string, CountRow> {
  return new Map(rows.map((r) => [r._id, r]));
}

/** Per-user record counts. Soft-deleted tasks and notes are not counted. */
export async function getStats(): Promise<IUserStats> {
  const live = { $match: { deletedAt: null } };
  const byUser = { $group: { _id: "$userId", n: { $sum: 1 } } };
  const [users, tasks, notes, uploads] = await Promise.all([
    UserModel.find().sort({ createdAt: 1 }).lean<IUser[]>(),
    TaskModel.aggregate<CountRow>([live, byUser]),
    NoteModel.aggregate<CountRow>([live, byUser]),
    UploadModel.aggregate<CountRow>([{ $group: { _id: "$userId", n: { $sum: 1 }, bytes: { $sum: "$size" } } }]),
  ]);
  const taskMap = toMap(tasks);
  const noteMap = toMap(notes);
  const uploadMap = toMap(uploads);
  const since = Date.now() - ACTIVE_WINDOW_MS;

  const rows: IUserStatsRow[] = users.map((u) => ({
    id: u._id,
    email: u.email,
    ...(u.name ? { name: u.name } : {}),
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    lastLoginAt: u.lastLoginAt.toISOString(),
    loginCount: u.loginCount,
    tasks: taskMap.get(u._id)?.n ?? 0,
    notes: noteMap.get(u._id)?.n ?? 0,
    images: uploadMap.get(u._id)?.n ?? 0,
    storageBytes: uploadMap.get(u._id)?.bytes ?? 0,
  }));

  return {
    totals: {
      users: rows.length,
      activeLast7d: users.filter((u) => u.lastLoginAt.getTime() >= since).length,
      tasks: rows.reduce((s, r) => s + r.tasks, 0),
      notes: rows.reduce((s, r) => s + r.notes, 0),
      images: rows.reduce((s, r) => s + r.images, 0),
      storageBytes: rows.reduce((s, r) => s + r.storageBytes, 0),
    },
    users: rows,
  };
}
