/** Editors register their real pending writes; native close waits for these promises. */
const writers = new Set<() => Promise<void>>();
export function registerLocalWriter(writer: () => Promise<void>): () => void {
  writers.add(writer);
  return () => { writers.delete(writer); };
}
export async function flushLocalWrites(): Promise<void> {
  await Promise.all(Array.from(writers, (writer) => writer()));
}
