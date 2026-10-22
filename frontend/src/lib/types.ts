export type { TaskStatus, UserRole, User, TaskDoc, NoteDoc, Entity, OutboxItem, Session, SyncState } from "@dayflow/shared";
export { displayName, STATUS_LABEL, STATUS_ORDER } from "@dayflow/shared";
import type { Entity } from "@dayflow/shared";

export interface PendingUpload {
  localId: string;
  entity: Entity;
  entityId: string;
  blob: Blob;
  createdAt: string;
}
