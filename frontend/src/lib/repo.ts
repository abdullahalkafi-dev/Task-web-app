import type { DayflowDB } from "./db";
import { htmlToText } from "./html";
import { computeMove, orderAtEnd, type Ordered } from "./order";
import { dhakaDateKey } from "./time";
import type { Entity, NoteDoc, TaskDoc, TaskStatus } from "./types";

export const LOCAL_WRITE_EVENT = "dayflow:local-write";

/** Monotonic timestamp: never earlier than the previous one, so edits always win LWW against older copies. */
export function nextStamp(prev?: string): string {
  const now = Date.now();
  const p = prev ? new Date(prev).getTime() : 0;
  return new Date(Math.max(now, p + 1)).toISOString();
}

function notifyWrite(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(LOCAL_WRITE_EVENT));
}

async function enqueue(db: DayflowDB, entity: Entity, entityId: string, op: "upsert" | "delete"): Promise<void> {
  await db.outbox.add({ entity, entityId, op, createdAt: new Date().toISOString() });
}

/* ---------------------------------- tasks --------------------------------- */

export interface TaskInput {
  /** Pre-generated so images queued before the first save can reference the task. */
  id?: string;
  title: string;
  descriptionHtml: string;
  estimatedMinutes: number;
  status: TaskStatus;
}

export async function createTask(db: DayflowDB, userId: string, input: TaskInput): Promise<TaskDoc> {
  const taskDate = dhakaDateKey(); // computed at the moment of creation, even offline
  const stamp = nextStamp();
  const task = await db.transaction("rw", db.tasks, db.outbox, async () => {
    const siblings = await db.tasks.where("[userId+taskDate]").equals([userId, taskDate]).toArray();
    const doc: TaskDoc = {
      id: input.id ?? crypto.randomUUID(),
      userId,
      taskDate,
      title: input.title.trim(),
      descriptionHtml: input.descriptionHtml,
      descriptionText: htmlToText(input.descriptionHtml),
      estimatedMinutes: input.estimatedMinutes,
      status: input.status,
      orderIndex: orderAtEnd(siblings.map(toOrdered)),
      copiedFromDate: null,
      copiedFromTaskId: null,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    };
    await db.tasks.add(doc);
    await enqueue(db, "task", doc.id, "upsert");
    return doc;
  });
  notifyWrite();
  return task;
}

export async function updateTask(
  db: DayflowDB,
  id: string,
  patch: Partial<Pick<TaskDoc, "title" | "descriptionHtml" | "estimatedMinutes" | "status" | "orderIndex">>,
): Promise<void> {
  await db.transaction("rw", db.tasks, db.outbox, async () => {
    const cur = await db.tasks.get(id);
    if (!cur || cur.deletedAt) return;
    const next: TaskDoc = { ...cur, ...patch, updatedAt: nextStamp(cur.updatedAt) };
    if (patch.title !== undefined) next.title = patch.title.trim();
    if (patch.descriptionHtml !== undefined) next.descriptionText = htmlToText(patch.descriptionHtml);
    await db.tasks.put(next);
    await enqueue(db, "task", id, "upsert");
  });
  notifyWrite();
}

export async function deleteTask(db: DayflowDB, id: string): Promise<void> {
  await db.transaction("rw", db.tasks, db.outbox, async () => {
    const cur = await db.tasks.get(id);
    if (!cur) return;
    const stamp = nextStamp(cur.updatedAt);
    await db.tasks.put({ ...cur, deletedAt: stamp, updatedAt: stamp });
    await enqueue(db, "task", id, "delete");
  });
  notifyWrite();
}

/**
 * Reorder (and optionally change status) with ONE document updated in the normal case.
 * `siblings` is the visible list the item is dropped into (the target column in Board view).
 */
export async function moveTask(
  db: DayflowDB,
  id: string,
  siblings: readonly TaskDoc[],
  toIndex: number,
  status?: TaskStatus,
): Promise<void> {
  const updates = computeMove(siblings.map(toOrdered), id, toIndex);
  await db.transaction("rw", db.tasks, db.outbox, async () => {
    const touched = new Set(updates.map((u) => u.id));
    if (status) touched.add(id);
    for (const tid of touched) {
      const cur = await db.tasks.get(tid);
      if (!cur) continue;
      const u = updates.find((x) => x.id === tid);
      await db.tasks.put({
        ...cur,
        orderIndex: u ? u.orderIndex : cur.orderIndex,
        status: tid === id && status ? status : cur.status,
        updatedAt: nextStamp(cur.updatedAt),
      });
      await enqueue(db, "task", tid, "upsert");
    }
  });
  notifyWrite();
}

/** "Copy to Today": a brand-new task; the original is never modified. */
export async function copyTaskToToday(db: DayflowDB, userId: string, source: TaskDoc): Promise<TaskDoc> {
  const taskDate = dhakaDateKey();
  const stamp = nextStamp();
  const copy = await db.transaction("rw", db.tasks, db.outbox, async () => {
    const siblings = await db.tasks.where("[userId+taskDate]").equals([userId, taskDate]).toArray();
    const doc: TaskDoc = {
      id: crypto.randomUUID(),
      userId,
      taskDate,
      title: source.title,
      descriptionHtml: source.descriptionHtml,
      descriptionText: source.descriptionText,
      estimatedMinutes: source.estimatedMinutes,
      status: "notStarted",
      orderIndex: orderAtEnd(siblings.filter((t) => !t.deletedAt).map(toOrdered)),
      copiedFromDate: source.taskDate,
      copiedFromTaskId: source.id,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    };
    await db.tasks.add(doc);
    await enqueue(db, "task", doc.id, "upsert");
    return doc;
  });
  notifyWrite();
  return copy;
}

/* ---------------------------------- notes --------------------------------- */

export async function createNote(db: DayflowDB, userId: string): Promise<NoteDoc> {
  const stamp = nextStamp();
  const note = await db.transaction("rw", db.notes, db.outbox, async () => {
    const all = (await db.notes.where("userId").equals(userId).toArray()).filter((n) => !n.deletedAt);
    // new notes go to the top of the list
    const first = all.length ? Math.min(...all.map((n) => n.orderIndex)) : 1024;
    const doc: NoteDoc = {
      id: crypto.randomUUID(),
      userId,
      title: "Untitled note",
      descriptionHtml: "",
      descriptionText: "",
      orderIndex: all.length ? first - 1024 : first,
      createdAt: stamp,
      updatedAt: stamp,
      deletedAt: null,
    };
    await db.notes.add(doc);
    await enqueue(db, "note", doc.id, "upsert");
    return doc;
  });
  notifyWrite();
  return note;
}

export async function updateNote(
  db: DayflowDB,
  id: string,
  patch: Partial<Pick<NoteDoc, "title" | "descriptionHtml">>,
): Promise<void> {
  await db.transaction("rw", db.notes, db.outbox, async () => {
    const cur = await db.notes.get(id);
    if (!cur || cur.deletedAt) return;
    const next: NoteDoc = { ...cur, ...patch, updatedAt: nextStamp(cur.updatedAt) };
    if (patch.descriptionHtml !== undefined) next.descriptionText = htmlToText(patch.descriptionHtml);
    await db.notes.put(next);
    await enqueue(db, "note", id, "upsert");
  });
  notifyWrite();
}

export async function deleteNote(db: DayflowDB, id: string): Promise<void> {
  await db.transaction("rw", db.notes, db.outbox, async () => {
    const cur = await db.notes.get(id);
    if (!cur) return;
    const stamp = nextStamp(cur.updatedAt);
    await db.notes.put({ ...cur, deletedAt: stamp, updatedAt: stamp });
    await enqueue(db, "note", id, "delete");
  });
  notifyWrite();
}

export async function moveNote(db: DayflowDB, id: string, siblings: readonly NoteDoc[], toIndex: number): Promise<void> {
  const updates = computeMove(siblings.map(toOrdered), id, toIndex);
  await db.transaction("rw", db.notes, db.outbox, async () => {
    for (const u of updates) {
      const cur = await db.notes.get(u.id);
      if (!cur) continue;
      await db.notes.put({ ...cur, orderIndex: u.orderIndex, updatedAt: nextStamp(cur.updatedAt) });
      await enqueue(db, "note", u.id, "upsert");
    }
  });
  notifyWrite();
}

/* --------------------------------- uploads -------------------------------- */

/** Offline-safe image: keeps the Blob in IndexedDB and returns a temporary blob: URL + local id. */
export async function queueImage(
  db: DayflowDB,
  entity: Entity,
  entityId: string,
  blob: Blob,
): Promise<{ localId: string; blobUrl: string }> {
  const localId = crypto.randomUUID();
  await db.pendingUploads.put({ localId, entity, entityId, blob, createdAt: new Date().toISOString() });
  return { localId, blobUrl: URL.createObjectURL(blob) };
}

function toOrdered(d: { id: string; orderIndex: number }): Ordered {
  return { id: d.id, orderIndex: d.orderIndex };
}
