import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';
import { staleSync, type PushChange, type Session } from '@dayflow/shared';
import { native, repository } from '../../modules/dayflow-native';
import { api, ApiError, ORIGIN } from './api';

export interface SyncSnapshot { state: 'synced' | 'syncing' | 'offline' | 'error'; pending: number; lastSyncedAt: string | null; message: string | null }
export const initialSync: SyncSnapshot = { state: 'syncing', pending: 0, lastSyncedAt: null, message: null };
export class SyncEngine {
  private controller = new AbortController();
  private running = false;
  private rerun = false;
  private retry = 1000;
  private stopped = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private poll: ReturnType<typeof setInterval> | undefined;
  private subscription: { remove(): void } | undefined;
  private snapshot: SyncSnapshot = initialSync;
  constructor(private session: Session, private notify: (snapshot: SyncSnapshot) => void) {}
  private get user() { return this.session.user.id; }
  start() {
    this.subscription = native.addListener('changed', () => { if (!this.running) { clearTimeout(this.timer); this.timer = setTimeout(() => this.trigger(), 1000); } });
    this.poll = setInterval(() => this.trigger(), 30000);
    void this.stream(); this.trigger();
  }
  stop() { this.stopped = true; this.controller.abort(); this.subscription?.remove(); clearTimeout(this.timer); clearInterval(this.poll); }
  private async report(patch: Partial<SyncSnapshot>) {
    if (this.stopped) return;
    this.snapshot = { ...this.snapshot, ...patch };
    this.notify(this.snapshot);
    await native.setMeta(this.user, 'syncState', this.snapshot.state === 'synced' ? 'Synced' : this.snapshot.message ?? this.snapshot.state).catch(() => undefined);
  }
  trigger = () => { if (this.stopped) return; if (this.running) { this.rerun = true; return; } void this.run(); };
  private async run() {
    this.running = true;
    try {
      await this.report({ state: 'syncing', message: null });
      const token = this.session.token, signal = this.controller.signal;
      const since = await native.meta(this.user, 'lastPulledAt');
      if (staleSync(since)) {
        const snapshot = await api.pull(token, null, signal);
        if (this.stopped) return;
        await repository.merge(this.user, snapshot, true);
      }
      const documents = [...await repository.list(this.user, 'task'), ...await repository.list(this.user, 'note')];
      for (const image of await repository.uploads(this.user)) {
        const owner = documents.find(doc => doc.id === image.entityId && !doc.deletedAt);
        // Images in an uncommitted editor draft must stay on this device.
        if (!owner?.descriptionHtml.includes(image.localId)) continue;
        if (image.uploadedUrl) { await native.completeUpload(this.user, image.localId, image.uploadedUrl); continue; }
        const form = new FormData();
        // Expo fetch consumes byte-backed file parts, not RN's legacy URI parts.
        // Private files intentionally have no extension, so supply their MIME
        // and multipart name explicitly while File reads their bytes natively.
        const file = new File(image.uri);
        const part = { bytes: () => file.bytes(), type: image.mime, name: `${image.localId}.${image.mime.split('/')[1]}` };
        form.append('file', part as unknown as Blob);
        const response = await fetch(`${ORIGIN}/api/uploads`, { method: 'POST', signal, headers: { Authorization: `Bearer ${token}` }, body: form });
        if (!response.ok) throw new ApiError(response.status, response.status === 413 ? 'An image is too large. Remove it from the editor and try again.' : 'Image upload failed');
        const uploaded = await response.json() as { url: string };
        if (this.stopped) return;
        await native.completeUpload(this.user, image.localId, uploaded.url);
      }
      while (!this.stopped) {
        const batch = (await repository.outbox(this.user)).filter(row => row.doc.deletedAt || !row.doc.descriptionHtml.includes('data-local-id='));
        if (!batch.length) break;
        const changes: PushChange[] = batch.map(row => {
          const { userId: _user, ...doc } = row.doc;
          return { entity: row.entity, op: doc.deletedAt ? 'delete' : 'upsert', doc, clientUpdatedAt: doc.updatedAt };
        });
        const response = await api.push(token, changes, signal);
        if (this.stopped) return;
        for (let index = 0; index < batch.length; index++) {
          const row = batch[index], result = response.results[index];
          if (!result || result.error || result.id !== row.id || result.entity !== row.entity) throw new Error('A change could not be accepted. Your local copy is retained.');
          await native.acknowledge(this.user, row.seq, row.entity, row.id, row.doc.updatedAt, result.winner ? JSON.stringify(result.winner) : null);
        }
      }
      const cursor = await native.meta(this.user, 'lastPulledAt');
      const pulled = await api.pull(token, cursor, signal);
      if (this.stopped) return;
      await repository.merge(this.user, pulled);
      const pending = await native.pendingCount(this.user);
      if (pending) throw new Error('Changes are waiting to upload. Your local copy is safe; sync will retry.');
      this.retry = 1000;
      await this.report({ state: 'synced', message: null, pending: await native.pendingCount(this.user), lastSyncedAt: await native.meta(this.user, 'lastSyncedAt') });
    } catch (error) {
      if (this.stopped) return;
      const unauthorized = error instanceof ApiError && error.status === 401;
      await this.report({ state: error instanceof ApiError ? 'error' : 'offline', message: unauthorized ? 'Sign in again to sync. Local changes are safe.' : error instanceof Error ? error.message : 'Server unreachable', pending: await native.pendingCount(this.user).catch(() => 0) });
      clearTimeout(this.timer);
      if (!unauthorized) { this.timer = setTimeout(() => this.trigger(), this.retry); this.retry = Math.min(60000, this.retry * 2); }
    } finally {
      this.running = false;
      if (this.rerun && !this.stopped) { this.rerun = false; this.trigger(); }
    }
  }
  private async stream() {
    while (!this.stopped) {
      try {
        const response = await fetch(`${ORIGIN}/api/sync/events`, { signal: this.controller.signal, headers: { Authorization: `Bearer ${this.session.token}` } });
        if (response.status === 401) { await this.report({ state: 'error', message: 'Sign in again to sync. Local changes are safe.' }); return; }
        if (!response.ok || !response.body) throw new Error('Live connection unavailable');
        const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = '';
        while (!this.stopped) { const chunk = await reader.read(); if (chunk.done) break; buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, '\n'); let end: number; while ((end = buffer.indexOf('\n\n')) >= 0) { const frame = buffer.slice(0, end); buffer = buffer.slice(end + 2); if (/^event:\s*change$/m.test(frame)) this.trigger(); } }
      } catch { /* polling remains available */ }
      if (!this.stopped) await new Promise<void>(resolve => {
        const done = () => { clearTimeout(timer); this.controller.signal.removeEventListener('abort', done); resolve(); };
        const timer = setTimeout(done, 5000);
        this.controller.signal.addEventListener('abort', done, { once: true });
        if (this.stopped) done();
      });
    }
  }
}
