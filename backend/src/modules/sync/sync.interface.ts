import type { INoteDTO, INoteUpsert } from "../note/note.interface";
import type { ITaskDTO, ITaskUpsert } from "../task/task.interface";

export type SyncOp = "upsert" | "delete";

export type ISyncChange =
  | { entity: "task"; op: SyncOp; doc: ITaskUpsert; clientUpdatedAt: string }
  | { entity: "note"; op: SyncOp; doc: INoteUpsert; clientUpdatedAt: string };

export interface ISyncPushBody {
  changes: ISyncChange[];
}

export interface ISyncPushResult {
  entity: "task" | "note";
  id: string;
  applied: boolean;
  winner: ITaskDTO | INoteDTO | null;
  error?: "FORBIDDEN";
}

export interface ISyncPushResponse {
  results: ISyncPushResult[];
  serverTime: string;
}

export interface ISyncPullResult {
  tasks: ITaskDTO[];
  notes: INoteDTO[];
  serverTime: string;
}
