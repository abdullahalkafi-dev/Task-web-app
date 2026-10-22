import { expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => vi.fn());
vi.mock('../modules/dayflow-native', () => ({ native: { setMeta: mock } }));
import { persistDraft, flushDrafts } from '../src/lib/drafts';
it('serializes old/new draft writes and waits for the final durable value', async () => {
  let release!: () => void; const stored: string[] = [];
  mock.mockImplementationOnce(() => new Promise<void>(resolve => { release = () => { stored.push('old'); resolve(); }; })).mockImplementationOnce(async () => { stored.push('new'); });
  const old = persistDraft('user', 'draft:task:id', 'old'); const next = persistDraft('user', 'draft:task:id', 'new');
  await vi.waitFor(() => expect(mock).toHaveBeenCalledTimes(1)); release(); await Promise.all([old, next]); await flushDrafts(); expect(stored).toEqual(['old','new']);
});
