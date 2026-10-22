import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ activate: vi.fn(), flush: vi.fn(), save: vi.fn(), remove: vi.fn() }));
vi.mock('react-native', () => ({ AppRegistry: { registerHeadlessTask: vi.fn() } }));
vi.mock('expo-secure-store', () => ({ setItemAsync: mocks.save, deleteItemAsync: mocks.remove }));
vi.mock('../modules/dayflow-native', () => ({ native: { activate: mocks.activate } }));
vi.mock('../src/lib/drafts', () => ({ flushDrafts: mocks.flush }));
vi.mock('../src/lib/sync', () => ({ initialSync: { state: 'idle', pending: 0 }, SyncEngine: class {} }));
const alice = { token: 'test-alice', user: { id: 'alice', email: 'alice@example.invalid', role: 'user' as const } };
const bob = { token: 'test-bob', user: { id: 'bob', email: 'bob@example.invalid', role: 'user' as const } };
beforeEach(() => { vi.resetModules(); vi.resetAllMocks(); mocks.activate.mockResolvedValue(undefined); mocks.flush.mockResolvedValue(undefined); mocks.save.mockResolvedValue(undefined); mocks.remove.mockResolvedValue(undefined); });

it('invalidates pending account reads as soon as logout starts, before draft flushing finishes', async () => {
  const runtime = await import('../src/lib/runtime');
  await runtime.setSession(alice); const oldRead = runtime.accountReadGuard('alice'); expect(oldRead()).toBe(true);
  let finish!: () => void; mocks.flush.mockReturnValueOnce(new Promise<void>(resolve => { finish = resolve; }));
  const logout = runtime.setSession(null);
  expect(runtime.currentSession()?.user.id).toBe('alice'); expect(oldRead()).toBe(false);
  expect(runtime.accountReadGuard('alice')()).toBe(false);
  finish(); await logout; expect(runtime.currentSession()).toBeNull(); expect(oldRead()).toBe(false);
});
it('never accepts an old account read after switching away and back to the same account', async () => {
  const runtime = await import('../src/lib/runtime');
  await runtime.setSession(alice); const oldRead = runtime.accountReadGuard('alice');
  await runtime.setSession(bob); await runtime.setSession(alice);
  expect(oldRead()).toBe(false); expect(runtime.accountReadGuard('alice')()).toBe(true);
});
it('restores the prior native account after a secure-storage failure while discarding its old callbacks', async () => {
  const runtime = await import('../src/lib/runtime');
  await runtime.setSession(alice); const oldRead = runtime.accountReadGuard('alice');
  mocks.save.mockRejectedValueOnce(new Error('Storage unavailable'));
  await expect(runtime.setSession(bob)).rejects.toThrow('Storage unavailable');
  expect(runtime.currentSession()?.user.id).toBe('alice'); expect(mocks.activate).toHaveBeenLastCalledWith('alice');
  expect(oldRead()).toBe(false); expect(runtime.accountReadGuard('alice')()).toBe(true);
});
