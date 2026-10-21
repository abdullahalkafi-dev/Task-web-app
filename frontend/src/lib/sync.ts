import { api, ApiError, type PushChange, type PushResult } from "./api";
import { getMeta, setMeta, type DayflowDB } from "./db";
import { containsLocalImages, dropLocalImage, rewriteLocalImage } from "./html";
import { shouldApplyRemote } from "./merge";
import { LOCAL_WRITE_EVENT, nextStamp } from "./repo";
import type { Entity, NoteDoc, PendingUpload, SyncState, TaskDoc } from "./types";
import { watchChanges } from "./change-stream";

export interface SyncSnapshot {
  state: SyncState;
  pendingCount: number;
  lastSyncedAt: string | null;
  unauthorized: boolean;
}

const LOCK_NAME = "dayflow-sync";
const CHANNEL = "dayflow-sync";
const BATCH = 100;
const POLL_MS = 30_000;
const DEBOUNCE_MS = 1_000;
const BACKOFF_MIN = 1_000;
const BACKOFF_MAX = 60_000;

function stripUser<T extends { userId: string }>(doc: T): Omit<T, "userId"> {
  const { userId, ...rest } = doc;
  void userId;
  return rest;
}

function extFor(blob: Blob): string {
  if (blob.type === "image/jpeg") return "jpg";
  if (blob.type === "image/gif") return "gif";
  if (blob.type === "image/webp") return "webp";
  return "png";
}

export class SyncEngine {
  private listeners = new Set<() => void>();
  private snapshot: SyncSnapshot = { state: "synced", pendingCount: 0, lastSyncedAt: null, unauthorized: false };
  private running = false;
  private rerun = false;
  private started = false;
  private backoff = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private channel: BroadcastChannel | null = null;
  private stopEvents: (() => void) | null = null;
  private cleanups: Array<() => void> = [];

  constructor(
    private readonly db: DayflowDB,
    private readonly userId: string,
  ) {}

  /* ------------------------------ observable ------------------------------ */

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): SyncSnapshot => this.snapshot;

  private set(patch: Partial<SyncSnapshot>): void {
    const next = { ...this.snapshot, ...patch };
    if (
      next.state === this.snapshot.state &&
      next.pendingCount === this.snapshot.pendingCount &&
      next.lastSyncedAt === this.snapshot.lastSyncedAt &&
      next.unauthorized === this.snapshot.unauthorized
    ) {
      return;
    }
    this.snapshot = next;
    this.listeners.forEach((l) => l());
  }

  async refreshPending(): Promise<void> {
    const rows = await this.db.outbox.toArray();
    const distinct = new Set(rows.map((r) => `${r.entity}:${r.entityId}`));
    this.set({ pendingCount: distinct.size });
  }

  /* ------------------------------- lifecycle ------------------------------ */

  start(): void {
    if (this.started || typeof window === "undefined") return;
    this.started = true;

    const on = <K extends keyof WindowEventMap>(target: Window, ev: K, fn: () => void): void => {
      target.addEventListener(ev, fn);
      this.cleanups.push(() => target.removeEventListener(ev, fn));
    };
    on(window, "online", () => this.trigger());
    on(window, "offline", () => {
      this.set({ state: "offline" });
    });
    const onVisible = (): void => {
      if (document.visibilityState === "visible") this.trigger();
    };
    document.addEventListener("visibilitychange", onVisible);
    this.cleanups.push(() => document.removeEventListener("visibilitychange", onVisible));
    const onLocalWrite = (): void => {
      void this.refreshPending();
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.trigger(), DEBOUNCE_MS);
    };
    window.addEventListener(LOCAL_WRITE_EVENT, onLocalWrite);
    this.cleanups.push(() => window.removeEventListener(LOCAL_WRITE_EVENT, onLocalWrite));

    this.pollTimer = setInterval(() => this.trigger(), POLL_MS);

    if (typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(`${CHANNEL}:${this.userId}`);
      this.channel.onmessage = () => {
        void this.refreshPending();
        void getMeta<string>(this.db, "lastSyncedAt").then((v) => {
          if (v) this.set({ lastSyncedAt: v });
        });
      };
    }

    void this.refreshPending();
    if (!navigator.onLine) this.set({ state: "offline" });
    this.trigger();
    this.startEvents();
  }

  private startEvents(): void {
    this.stopEvents?.();
    this.stopEvents = watchChanges(this.userId, () => this.trigger(), () => this.set({ unauthorized: true, state: "error" }));
  }

  stop(): void {
    this.stopEvents?.();
    this.stopEvents = null;
    this.started = false;
    this.cleanups.forEach((c) => c());
    this.cleanups = [];
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.channel?.close();
    this.channel = null;
  }

  /** Called after the user signs in again: resume syncing with the new token. */
  clearUnauthorized(): void {
    if (this.started) this.startEvents();
    if (!this.snapshot.unauthorized) return;
    this.set({ unauthorized: false, state: "syncing" });
    this.trigger();
  }

  trigger = (): void => {
    if (this.running) {
      this.rerun = true;
      return;
    }
    void this.run();
  };

  /* --------------------------------- cycle -------------------------------- */

  private async run(): Promise<void> {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.set({ state: "offline" });
      await this.refreshPending();
      return;
    }
    this.running = true;
    try {
      if ("locks" in navigator) {
        await navigator.locks.request(LOCK_NAME + this.userId, { ifAvailable: true }, async (lock) => {
          if (!lock) return; // another tab is syncing
          await this.syncOnce();
        });
      } else {
        await this.syncOnce();
      }
    } finally {
      this.running = false;
    }
    if (this.rerun) {
      this.rerun = false;
      this.trigger();
    }
  }

  async syncOnce(): Promise<void> {
    if (this.snapshot.unauthorized) return;
    this.set({ state: "syncing" });
    try {
      await this.uploadPending();
      await this.pushAll();
      await this.pull();
      const now = new Date().toISOString();
      await setMeta(this.db, "lastSyncedAt", now);
      this.backoff = 0;
      await this.refreshPending();
      this.set({ state: "synced", lastSyncedAt: now });
      this.channel?.postMessage("synced");
    } catch (err) {
      await this.refreshPending();
      if (err instanceof ApiError && err.status === 401) {
        this.set({ state: "error", unauthorized: true });
        return; // keep all local data; the user is asked to sign in again
      }
      if (err instanceof ApiError && err.status === 0) {
        this.set({ state: "offline" }); // server unreachable == offline for the user; retried with backoff
      } else {
        this.set({ state: "error" });
      }
      this.scheduleRetry();
    }
  }

  private scheduleRetry(): void {
    this.backoff = Math.min(BACKOFF_MAX, Math.max(BACKOFF_MIN, this.backoff * 2));
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.trigger(), this.backoff);
  }

  /* ----------------------------- 1. image uploads ---------------------------- */

  private async uploadPending(): Promise<void> {
    const rows = await this.db.pendingUploads.orderBy("createdAt").toArray();
    for (const row of rows) {
      let url: string | null = null;
      try {
        const res = await api.upload(row.blob, `${row.localId}.${extFor(row.blob)}`);
        url = res.url;
      } catch (err) {
        const permanent = err instanceof ApiError && (err.status === 400 || err.status === 413);
        if (!permanent) throw err;
      }
      await this.applyUploadResult(row, url);
    }
  }

  private async applyUploadResult(row: PendingUpload, url: string | null): Promise<void> {
    const table = row.entity === "task" ? this.db.tasks : this.db.notes;
    await this.db.transaction("rw", this.db.tasks, this.db.notes, this.db.outbox, this.db.pendingUploads, async () => {
      const doc = await table.get(row.entityId);
      if (doc) {
        const html = url
          ? rewriteLocalImage(doc.descriptionHtml, row.localId, url)
          : dropLocalImage(doc.descriptionHtml, row.localId);
        if (html !== doc.descriptionHtml) {
          await table.put({ ...doc, descriptionHtml: html, updatedAt: nextStamp(doc.updatedAt) } as TaskDoc & NoteDoc);
          await this.db.outbox.add({
            entity: row.entity,
            entityId: row.entityId,
            op: doc.deletedAt ? "delete" : "upsert",
            createdAt: new Date().toISOString(),
          });
        }
      }
      await this.db.pendingUploads.delete(row.localId);
    });
  }

  /* --------------------------------- 2. push --------------------------------- */

  private async pushAll(): Promise<void> {
    for (;;) {
      const rows = await this.db.outbox.orderBy("seq").toArray();
      if (rows.length === 0) return;

      const maxSeq = new Map<string, number>();
      for (const r of rows) maxSeq.set(`${r.entity}:${r.entityId}`, Math.max(maxSeq.get(`${r.entity}:${r.entityId}`) ?? 0, r.seq ?? 0));

      const changes: Array<{ key: string; entity: Entity; id: string; change: PushChange; upTo: number }> = [];
      const staleKeys: Array<{ entity: Entity; id: string; upTo: number }> = [];
      for (const [key, upTo] of maxSeq) {
        const [entity, id] = key.split(":") as [Entity, string];
        const doc = entity === "task" ? await this.db.tasks.get(id) : await this.db.notes.get(id);
        if (!doc) {
          staleKeys.push({ entity, id, upTo });
          continue;
        }
        if (containsLocalImages(doc.descriptionHtml)) continue; // wait until its images are uploaded
        changes.push({
          key,
          entity,
          id,
          upTo,
          change: {
            entity: entity === "task" ? "task" : "note",
            op: doc.deletedAt ? "delete" : "upsert",
            doc: stripUser(doc),
            clientUpdatedAt: doc.updatedAt,
          },
        });
      }
      for (const s of staleKeys) await this.clearOutbox(s.entity, s.id, s.upTo);
      if (changes.length === 0) return;

      for (let i = 0; i < changes.length; i += BATCH) {
        const batch = changes.slice(i, i + BATCH);
        const res = await api.push(batch.map((b) => b.change));
        for (let k = 0; k < batch.length; k++) {
          const result: PushResult | undefined = res.results[k];
          const item = batch[k];
          if (result && !result.applied && result.winner) await this.applyRemote(item.entity, result.winner);
          // The server acknowledged (applied, superseded, or rejected) -> safe to drop from the outbox.
          await this.clearOutbox(item.entity, item.id, item.upTo);
        }
      }
      // Anything still queued is either new (loop again) or blocked on image uploads (loop ends above).
      const left = await this.db.outbox.count();
      if (left === 0) return;
    }
  }

  private async clearOutbox(entity: Entity, entityId: string, upToSeq: number): Promise<void> {
    await this.db.outbox
      .where("entityId")
      .equals(entityId)
      .and((r) => r.entity === entity && (r.seq ?? 0) <= upToSeq)
      .delete();
  }

  /* --------------------------------- 3. pull --------------------------------- */

  private async applyRemote(entity: Entity, remote: Omit<TaskDoc, "userId"> | Omit<NoteDoc, "userId">): Promise<void> {
    if (entity === "task") {
      const local = await this.db.tasks.get(remote.id);
      if (shouldApplyRemote(local, remote)) await this.db.tasks.put({ ...(remote as Omit<TaskDoc, "userId">), userId: this.userId });
    } else {
      const local = await this.db.notes.get(remote.id);
      if (shouldApplyRemote(local, remote)) await this.db.notes.put({ ...(remote as Omit<NoteDoc, "userId">), userId: this.userId });
    }
  }

  private async pull(): Promise<void> {
    const since = (await getMeta<string>(this.db, "lastPulledAt")) ?? null;
    const res = await api.pull(since);
    await this.db.transaction("rw", this.db.tasks, this.db.notes, async () => {
      for (const t of res.tasks) await this.applyRemote("task", t);
      for (const n of res.notes) await this.applyRemote("note", n);
    });
    await setMeta(this.db, "lastPulledAt", res.serverTime);
  }
}
