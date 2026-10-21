/** Editors register their real pending writes; native close waits for these promises. */
const writers = new Set<() => Promise<void>>();
export function registerLocalWriter(writer: () => Promise<void>): () => void {
  writers.add(writer);
  return () => { writers.delete(writer); };
}
/** Keep a closing editor's final write visible to native quit, including retries. */
export function finishLocalWriter(writer: () => Promise<void>): void {
  let active: Promise<void> | null = null;
  const finish = (): Promise<void> => {
    if (active) return active;
    active = Promise.resolve().then(writer).then(() => { writers.delete(finish); }).finally(() => { active = null; });
    return active;
  };
  writers.add(finish);
  void finish().catch(() => undefined); // Retain the writer for a retry at the next save boundary.
}
export async function flushLocalWrites(): Promise<void> {
  await Promise.all(Array.from(writers, (writer) => writer()));
}
