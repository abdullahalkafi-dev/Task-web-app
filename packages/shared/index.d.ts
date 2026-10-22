export type TaskStatus = "notStarted" | "started" | "completed";
export type UserRole = "superadmin" | "user";
export type Entity = "task" | "note";
export interface User { id: string; email: string; name?: string; role: UserRole; createdAt?: string }
export interface NoteDoc {
  id: string; userId: string; title: string; descriptionHtml: string; descriptionText: string;
  orderIndex: number; createdAt: string; updatedAt: string; deletedAt: string | null;
}
export interface TaskDoc extends NoteDoc {
  taskDate: string; estimatedMinutes: number; status: TaskStatus; reminderAt?: string | null;
  copiedFromDate: string | null; copiedFromTaskId: string | null;
}
export type Document = TaskDoc | NoteDoc;
export interface Session { token: string; user: User }
export interface OutboxItem { seq?: number; entity: Entity; entityId: string; op: "upsert" | "delete"; createdAt: string }
export type SyncState = "synced" | "syncing" | "offline" | "error";
export interface PushChange { entity: Entity; op: "upsert" | "delete"; doc: Omit<TaskDoc, "userId"> | Omit<NoteDoc, "userId">; clientUpdatedAt: string }
export interface PushResult { entity: Entity; id: string; applied: boolean; winner: Omit<TaskDoc, "userId"> | Omit<NoteDoc, "userId"> | null; error?: string }
export interface PullResponse { tasks: Omit<TaskDoc, "userId">[]; notes: Omit<NoteDoc, "userId">[]; serverTime: string }
export const STATUS_ORDER: TaskStatus[];
export const STATUS_LABEL: Record<TaskStatus, string>;
export const DHAKA_TZ: string;
export function dhakaDateKey(value?: string | number | Date): string;
export function nextStamp(previous?: string, now?: number): string;
export function shouldApplyRemote(local: { updatedAt: string } | undefined, remote: { updatedAt: string }): boolean;
export function orderAtEnd(items: readonly { orderIndex: number }[]): number;
export function displayName(user: Pick<User, "email" | "name"> | null | undefined): string;
export function toReminderInput(iso: string | null | undefined): string;
export function fromReminderInput(value: string): string | null;
export function staleSync(lastPull: string | null, now?: number): boolean;
