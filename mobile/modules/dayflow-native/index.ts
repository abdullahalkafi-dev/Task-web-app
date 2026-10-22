import { requireNativeModule } from 'expo-modules-core';
import type { Document, Entity, PullResponse } from '@dayflow/shared';

export interface Queued { seq: number; entity: Entity; id: string; doc: Document }
export interface Upload { localId: string; entity: Entity; entityId: string; uri: string; mime: string; uploadedUrl?: string }
export interface Incoming { id: string; title: string; text: string; images: { uri: string; mime: string }[] }
export interface Permissions { overlay: boolean; notifications: boolean; exactAlarms: boolean; bubble: boolean }
interface Native {
  testSession(): Promise<string | null>;
  activate(user: string | null): Promise<void>;
  list(user: string, entity: Entity): Promise<string>;
  mutate(user: string, entity: Entity, json: string): Promise<string>;
  meta(user: string, key: string): Promise<string | null>;
  setMeta(user: string, key: string, value: string | null): Promise<void>;
  outbox(user: string): Promise<string>;
  pendingCount(user: string): Promise<number>;
  acknowledge(user: string, seq: number, entity: Entity, id: string, stamp: string, winner: string | null): Promise<void>;
  mergePull(user: string, json: string, reset: boolean): Promise<void>;
  recoveries(user: string): Promise<string>;
  drafts(user: string): Promise<string>;
  uploads(user: string): Promise<string>;
  queueImage(user: string, entity: Entity, entityId: string, uri: string, mime: string): Promise<string>;
  completeUpload(user: string, id: string, url: string): Promise<void>;
  imageData(user: string, source: string, token: string, apiOrigin: string): Promise<string>;
  permissions(): Promise<Permissions>;
  requestPermission(kind: 'overlay' | 'notifications' | 'exactAlarms'): Promise<void>;
  setBubble(enabled: boolean): Promise<void>;
  appVisible(visible: boolean): Promise<void>;
  bubbleActive(): Promise<boolean>;
  pinWidget(): Promise<boolean>;
  incoming(): Promise<string>;
  consumeIncoming(id: string): Promise<void>;
  storage(user: string): Promise<Record<string, number>>;
  addListener(event: 'changed', callback: () => void): { remove(): void };
}
export const native = requireNativeModule<Native>('DayflowNative');
export const repository = {
  list: async (user: string, entity: Entity): Promise<Document[]> => JSON.parse(await native.list(user, entity)),
  mutate: async (user: string, entity: Entity, patch: Partial<Document> & { localImageSourceId?: string }): Promise<Document> => JSON.parse(await native.mutate(user, entity, JSON.stringify(patch))),
  outbox: async (user: string): Promise<Queued[]> => JSON.parse(await native.outbox(user)),
  uploads: async (user: string): Promise<Upload[]> => JSON.parse(await native.uploads(user)),
  merge: (user: string, payload: PullResponse, reset = false) => native.mergePull(user, JSON.stringify(payload), reset),
};
