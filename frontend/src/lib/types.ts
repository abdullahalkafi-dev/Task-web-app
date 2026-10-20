export type TaskStatus = "notStarted" | "started" | "completed";
export type UserRole = "superadmin" | "user";

export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  createdAt?: string;
}

/** What we show for a person: their Google name, falling back to the email. */
export function displayName(user: Pick<User, "email" | "name"> | null | undefined): string {
  return user?.name?.trim() || user?.email || "";
}

export interface TaskDoc {
  id: string;
  userId: string;
  taskDate: string;
  title: string;
  descriptionHtml: string;
  descriptionText: string;
  estimatedMinutes: number;
  status: TaskStatus;
  orderIndex: number;
  copiedFromDate: string | null;
  copiedFromTaskId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface NoteDoc {
  id: string;
  userId: string;
  title: string;
  descriptionHtml: string;
  descriptionText: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export type Entity = "task" | "note";

export interface OutboxItem {
  seq?: number;
  entity: Entity;
  entityId: string;
  op: "upsert" | "delete";
  createdAt: string;
}

export interface PendingUpload {
  localId: string;
  entity: Entity;
  entityId: string;
  blob: Blob;
  createdAt: string;
}

export interface Session {
  token: string;
  user: User;
}

export type SyncState = "synced" | "syncing" | "offline" | "error";

export const STATUS_LABEL: Record<TaskStatus, string> = {
  notStarted: "Not Started",
  started: "Started",
  completed: "Completed",
};

export const STATUS_ORDER: TaskStatus[] = ["notStarted", "started", "completed"];
