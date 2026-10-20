/**
 * Last-write-wins merge rule shared by sync pull and push-winner handling.
 * A remote copy replaces the local one only when it is strictly newer.
 */
export function shouldApplyRemote(local: { updatedAt: string } | undefined, remote: { updatedAt: string }): boolean {
  if (!local) return true;
  return new Date(remote.updatedAt).getTime() > new Date(local.updatedAt).getTime();
}

export function mergeById<T extends { id: string; updatedAt: string }>(
  localDocs: readonly T[],
  remoteDocs: readonly T[],
): T[] {
  const map = new Map(localDocs.map((d) => [d.id, d]));
  for (const remote of remoteDocs) {
    if (shouldApplyRemote(map.get(remote.id), remote)) map.set(remote.id, remote);
  }
  return Array.from(map.values());
}
