import { describe, expect, it } from 'vitest';
import { dhakaDateKey, fromReminderInput, nextStamp, shouldApplyRemote, staleSync, toReminderInput } from '@dayflow/shared';
describe('shared mobile rules', () => {
  it('uses the Dhaka day across device timezone and midnight', () => { expect(dhakaDateKey('2026-10-21T17:59:59Z')).toBe('2026-10-21'); expect(dhakaDateKey('2026-10-21T18:00:00Z')).toBe('2026-10-22'); });
  it('round-trips reminder input without using the device timezone', () => { const input = '2026-10-22T09:30'; expect(fromReminderInput(input)).toBe('2026-10-22T03:30:00.000Z'); expect(toReminderInput(fromReminderInput(input))).toBe(input); expect(fromReminderInput('')).toBeNull(); });
  it('retains strictly newer local versions and monotonic stamps', () => { const old = '2026-10-22T00:00:00.000Z'; expect(nextStamp(old, Date.parse(old) - 1000)).toBe('2026-10-22T00:00:00.001Z'); expect(shouldApplyRemote({ updatedAt: old }, { updatedAt: old })).toBe(false); });
  it('requires authoritative reconciliation beyond tombstone retention', () => { expect(staleSync(null)).toBe(false); expect(staleSync('2026-09-01T00:00:00Z', Date.parse('2026-10-02T00:00:00Z'))).toBe(true); });
});
