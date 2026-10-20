export type TaskStatus = "notStarted" | "started" | "completed";

export interface ITask {
  _id: string;
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
  createdAt: Date;
  updatedAt: Date;
  /** Set by the server on every write; drives sync pull so late offline pushes are never missed. */
  serverUpdatedAt: Date;
  deletedAt: Date | null;
}

/** Wire format (API + Dexie). Dates are ISO strings. */
export interface ITaskDTO {
  id: string;
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

export interface ITaskUpsert {
  id: string;
  taskDate: string;
  title: string;
  descriptionHtml: string;
  descriptionText?: string;
  estimatedMinutes: number;
  status: TaskStatus;
  orderIndex: number;
  copiedFromDate: string | null;
  copiedFromTaskId: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ITaskUpsertResult {
  id: string;
  applied: boolean;
  winner: ITaskDTO | null;
  error?: "FORBIDDEN";
}
