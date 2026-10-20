import type { INoteUpsert } from "../note/note.interface";
import * as noteService from "../note/note.service";
import type { ITaskUpsert } from "../task/task.interface";
import * as taskService from "../task/task.service";
import type { ISyncPullResult, ISyncPushResponse, ISyncPushResult } from "./sync.interface";
import type { PushBody } from "./sync.validation";

export const TOMBSTONE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Applies a batch of changes with last-write-wins semantics. Deletes are tombstone upserts:
 * the doc carries `deletedAt` and the change's timestamp is the LWW key.
 */
export async function push(userId: string, body: PushBody): Promise<ISyncPushResponse> {
  const taskIdx: number[] = [];
  const noteIdx: number[] = [];
  const taskDocs: ITaskUpsert[] = [];
  const noteDocs: INoteUpsert[] = [];

  body.changes.forEach((change, i) => {
    const updatedAt = change.clientUpdatedAt ?? change.doc.updatedAt;
    const deletedAt = change.op === "delete" ? (change.doc.deletedAt ?? updatedAt) : change.doc.deletedAt;
    if (change.entity === "task") {
      taskIdx.push(i);
      taskDocs.push({ ...change.doc, updatedAt, deletedAt });
    } else {
      noteIdx.push(i);
      noteDocs.push({ ...change.doc, updatedAt, deletedAt });
    }
  });

  const [taskResults, noteResults] = await Promise.all([
    taskService.upsertMany(userId, taskDocs),
    noteService.upsertMany(userId, noteDocs),
  ]);

  const results: ISyncPushResult[] = new Array<ISyncPushResult>(body.changes.length);
  taskResults.forEach((r, k) => {
    results[taskIdx[k]] = { entity: "task", ...r };
  });
  noteResults.forEach((r, k) => {
    results[noteIdx[k]] = { entity: "note", ...r };
  });
  return { results, serverTime: new Date().toISOString() };
}

export async function pull(userId: string, since: string | undefined): Promise<ISyncPullResult> {
  // Capture the time BEFORE reading so a write racing with the read is returned again next pull.
  const serverTime = new Date().toISOString();
  const sinceDate = since ? new Date(since) : null;
  const [tasks, notes] = await Promise.all([
    taskService.pullSince(userId, sinceDate),
    noteService.pullSince(userId, sinceDate),
  ]);
  return { tasks, notes, serverTime };
}

export async function purgeOldTombstones(): Promise<number> {
  const cutoff = new Date(Date.now() - TOMBSTONE_TTL_MS);
  const [t, n] = await Promise.all([taskService.purgeTombstones(cutoff), noteService.purgeTombstones(cutoff)]);
  return t + n;
}
