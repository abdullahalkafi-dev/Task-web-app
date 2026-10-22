import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ api: { pull: vi.fn(), push: vi.fn() }, native: { meta: vi.fn(), setMeta: vi.fn(), pendingCount: vi.fn(), acknowledge: vi.fn(), completeUpload: vi.fn(), addListener: vi.fn() }, repository: { list: vi.fn(), outbox: vi.fn(), uploads: vi.fn(), merge: vi.fn() }, fetch: vi.fn() }));
vi.mock('expo/fetch', () => ({ fetch: mocks.fetch }));
vi.mock('expo-file-system', () => ({ File: class { async bytes() { return new Uint8Array(); } } }));
vi.mock('../modules/dayflow-native', () => ({ native: mocks.native, repository: mocks.repository }));
vi.mock('../src/lib/api', () => ({ api: mocks.api, ORIGIN: 'https://test.invalid', ApiError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
import { SyncEngine, type SyncSnapshot } from '../src/lib/sync';
const session = { token: 'test-token', user: { id: 'test-user', email: 'test@example.invalid', role: 'user' as const } };
const doc = { id: 'task-id', userId: 'test-user', title: 'Task', descriptionHtml: '', updatedAt: '2026-10-22T00:00:00Z', deletedAt: null };
let engine: SyncEngine | undefined;
beforeEach(() => { vi.resetAllMocks(); mocks.native.meta.mockResolvedValue(null); mocks.native.setMeta.mockResolvedValue(undefined); mocks.native.pendingCount.mockResolvedValue(0); mocks.repository.list.mockResolvedValue([]); mocks.repository.uploads.mockResolvedValue([]); mocks.repository.outbox.mockResolvedValue([]); mocks.api.pull.mockResolvedValue({ tasks: [], notes: [], serverTime: '2026-10-22T00:01:00Z' }); });
afterEach(() => engine?.stop());
describe('Android sync coordinator', () => {
  it('acknowledges only the sent sequence and consumes canonical winner', async () => {
    const snapshots: SyncSnapshot[] = []; mocks.repository.outbox.mockResolvedValueOnce([{ seq: 7, entity: 'task', id: doc.id, doc }]).mockResolvedValue([]);
    mocks.api.push.mockResolvedValue({ results: [{ entity: 'task', id: doc.id, applied: true, winner: doc }] });
    engine = new SyncEngine(session, value => snapshots.push(value)); engine.trigger();
    await vi.waitFor(() => expect(snapshots.at(-1)?.state).toBe('synced'));
    expect(mocks.native.acknowledge).toHaveBeenCalledWith('test-user', 7, 'task', doc.id, doc.updatedAt, JSON.stringify(doc));
    expect(mocks.api.push.mock.calls[0][1][0].doc).not.toHaveProperty('userId');
  });
  it('keeps a change queued when the server does not acknowledge it', async () => {
    const snapshots: SyncSnapshot[] = []; mocks.repository.outbox.mockResolvedValue([{ seq: 1, entity: 'task', id: doc.id, doc }]); mocks.api.push.mockResolvedValue({ results: [] });
    engine = new SyncEngine(session, value => snapshots.push(value)); engine.trigger();
    await vi.waitFor(() => expect(snapshots.at(-1)?.message).toContain('local copy is retained'));
    expect(mocks.native.acknowledge).not.toHaveBeenCalled();
  });
  it('reconciles a stale database before pushing local records', async () => {
    mocks.native.meta.mockResolvedValue('2026-01-01T00:00:00Z'); const snapshots: SyncSnapshot[] = [];
    engine = new SyncEngine(session, value => snapshots.push(value)); engine.trigger(); await vi.waitFor(() => expect(snapshots.at(-1)?.state).toBe('synced'));
    expect(mocks.api.pull.mock.calls[0][1]).toBeNull(); expect(mocks.repository.merge.mock.calls[0][2]).toBe(true);
  });
  it('does not apply a late network response after account shutdown', async () => {
    let resolve!: (value: unknown) => void; mocks.api.pull.mockReturnValue(new Promise(done => { resolve = done; }));
    engine = new SyncEngine(session, () => undefined); engine.trigger(); await vi.waitFor(() => expect(mocks.api.pull).toHaveBeenCalled()); engine.stop(); resolve({ tasks: [], notes: [], serverTime: '' }); await new Promise(done => setTimeout(done, 10)); expect(mocks.repository.merge).not.toHaveBeenCalled();
  });
  it('does not merge a late stale-database snapshot after account shutdown', async () => {
    mocks.native.meta.mockResolvedValue('2026-01-01T00:00:00Z');
    let resolve!: (value: unknown) => void; mocks.api.pull.mockReturnValue(new Promise(done => { resolve = done; }));
    engine = new SyncEngine(session, () => undefined); engine.trigger();
    await vi.waitFor(() => expect(mocks.api.pull).toHaveBeenCalled()); engine.stop();
    resolve({ tasks: [], notes: [], serverTime: '' }); await new Promise(done => setTimeout(done, 10));
    expect(mocks.repository.merge).not.toHaveBeenCalled();
  });
  it('never reports synced while unresolved image documents remain queued', async () => {
    const snapshots: SyncSnapshot[] = [];
    mocks.repository.outbox.mockResolvedValue([{ seq: 1, entity: 'task', id: doc.id, doc: { ...doc, descriptionHtml: '<img data-local-id="missing" src="local:missing">' } }]);
    mocks.native.pendingCount.mockResolvedValue(1);
    engine = new SyncEngine(session, value => snapshots.push(value)); engine.trigger();
    await vi.waitFor(() => expect(snapshots.at(-1)?.message).toContain('waiting to upload'));
    expect(snapshots.some(value => value.state === 'synced')).toBe(false);
    expect(mocks.api.push).not.toHaveBeenCalled();
  });
  it('syncs deletion of a task with an unuploaded image without uploading that image', async () => {
    const deleted = { ...doc, deletedAt: '2026-10-22T01:00:00Z', descriptionHtml: '<img data-local-id="pending" src="local:pending">' };
    const snapshots: SyncSnapshot[] = [];
    mocks.repository.list.mockResolvedValue([deleted]);
    mocks.repository.uploads.mockResolvedValue([{ localId: 'pending', entityId: doc.id, uri: 'file:///private/image', mime: 'image/png' }]);
    mocks.repository.outbox.mockResolvedValueOnce([{ seq: 9, entity: 'task', id: doc.id, doc: deleted }]).mockResolvedValue([]);
    mocks.api.push.mockResolvedValue({ results: [{ entity: 'task', id: doc.id, applied: true, winner: { ...deleted, descriptionHtml: '' } }] });
    engine = new SyncEngine(session, value => snapshots.push(value)); engine.trigger();
    await vi.waitFor(() => expect(snapshots.at(-1)?.state).toBe('synced'));
    expect(mocks.api.push.mock.calls[0][1][0].op).toBe('delete');
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.native.acknowledge).toHaveBeenCalled();
  });
});
