export const ORDER_STEP = 1024;
export const MIN_GAP = 1e-6;

export interface Ordered {
  id: string;
  orderIndex: number;
}

/** Index to give an item dropped between `prev` and `next` (either may be absent). */
export function orderBetween(prev: number | undefined, next: number | undefined): number {
  if (prev === undefined && next === undefined) return ORDER_STEP;
  if (prev === undefined) return (next as number) - ORDER_STEP;
  if (next === undefined) return prev + ORDER_STEP;
  return (prev + next) / 2;
}

export function orderAtEnd(items: readonly Ordered[]): number {
  if (items.length === 0) return ORDER_STEP;
  return Math.max(...items.map((i) => i.orderIndex)) + ORDER_STEP;
}

export function gapTooSmall(prev: number | undefined, next: number | undefined): boolean {
  return prev !== undefined && next !== undefined && next - prev < MIN_GAP;
}

export function renormalize(ids: readonly string[]): Ordered[] {
  return ids.map((id, i) => ({ id, orderIndex: (i + 1) * ORDER_STEP }));
}

/**
 * Moves `movedId` so it sits at `toIndex` of the list (index within the list AFTER removing it).
 * Returns only the documents that must change: one normally, all of them after renormalizing.
 */
export function computeMove(items: readonly Ordered[], movedId: string, toIndex: number): Ordered[] {
  const sorted = [...items].sort((a, b) => a.orderIndex - b.orderIndex);
  const rest = sorted.filter((i) => i.id !== movedId);
  const idx = Math.max(0, Math.min(toIndex, rest.length));
  const prev = rest[idx - 1]?.orderIndex;
  const next = rest[idx]?.orderIndex;
  if (gapTooSmall(prev, next)) {
    const ids = rest.map((i) => i.id);
    ids.splice(idx, 0, movedId);
    const all = renormalize(ids);
    const before = new Map(items.map((i) => [i.id, i.orderIndex]));
    return all.filter((o) => before.get(o.id) !== o.orderIndex);
  }
  return [{ id: movedId, orderIndex: orderBetween(prev, next) }];
}
