import Dexie, { type EntityTable } from "dexie";
import type { NoteDoc, OutboxItem, PendingUpload, TaskDoc } from "./types";

export interface MetaRow {
  key: string;
  value: unknown;
}

/** One database per user, so data never mixes between accounts on a shared device. */
export class DayflowDB extends Dexie {
  tasks!: EntityTable<TaskDoc, "id">;
  notes!: EntityTable<NoteDoc, "id">;
  outbox!: EntityTable<OutboxItem, "seq">;
  pendingUploads!: EntityTable<PendingUpload, "localId">;
  meta!: EntityTable<MetaRow, "key">;

  constructor(userId: string) {
    super(`dayflow_${userId}`);
    this.version(1).stores({
      tasks: "id, userId, taskDate, [userId+taskDate], orderIndex, updatedAt, deletedAt",
      notes: "id, userId, orderIndex, updatedAt, deletedAt",
      outbox: "++seq, entity, entityId, op, createdAt",
      pendingUploads: "localId, entity, entityId, createdAt",
      meta: "key",
    });
  }
}

/** App-level database: holds the session (JWT + cached profile) and UI prefs. Not user data. */
export class AppDB extends Dexie {
  meta!: EntityTable<MetaRow, "key">;

  constructor() {
    super("dayflow_app");
    this.version(1).stores({ meta: "key" });
  }
}

const dbs = new Map<string, DayflowDB>();

export function getUserDb(userId: string): DayflowDB {
  let db = dbs.get(userId);
  if (!db) {
    db = new DayflowDB(userId);
    dbs.set(userId, db);
  }
  return db;
}

let appDb: AppDB | null = null;
export function getAppDb(): AppDB {
  if (!appDb) appDb = new AppDB();
  return appDb;
}

export async function getMeta<T>(db: { meta: EntityTable<MetaRow, "key"> }, key: string): Promise<T | undefined> {
  const row = await db.meta.get(key);
  return row?.value as T | undefined;
}

export async function setMeta(db: { meta: EntityTable<MetaRow, "key"> }, key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
