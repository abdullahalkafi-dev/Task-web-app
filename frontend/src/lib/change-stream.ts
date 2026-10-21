import { ApiError, openChangeStream } from "./api";

/** Parse complete SSE frames, including frames split across network chunks. */
export function consumeFrames(buffer: string, onChange: () => void): string {
  let end: number;
  while ((end = buffer.indexOf("\n\n")) >= 0) {
    const frame = buffer.slice(0, end);
    buffer = buffer.slice(end + 2);
    if (frame.split("\n").some((line) => line.trim() === "event: change")) onChange();
  }
  return buffer;
}

export function watchChanges(userId: string, changed: () => void, unauthorized: () => void): () => void {
  const controller = new AbortController();
  const { signal } = controller;
  const wait = (ms: number): Promise<void> => new Promise((resolve) => {
    if (signal.aborted) { resolve(); return; }
    const done = () => { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
  });
  const run = async (): Promise<void> => {
    let backoff = 1000;
    while (!signal.aborted) {
      try {
        const response = await openChangeStream(signal);
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (!signal.aborted) {
            const part = await reader.read();
            if (part.done) break;
            buffer += decoder.decode(part.value, { stream: true }).replace(/\r/g, "");
            if (buffer.length > 64_000) throw new Error("Invalid event stream");
            buffer = consumeFrames(buffer, changed);
            backoff = 1000;
          }
        } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
      } catch (error) {
        if (signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) { unauthorized(); return; }
      }
      if (!signal.aborted) { await wait(backoff); backoff = Math.min(backoff * 2, 30_000); }
    }
  };
  // One live connection per user/browser partition; Dexie broadcasts actual changes to other tabs.
  const start = async (): Promise<void> => {
    if (navigator.locks) await navigator.locks.request(`dayflow-events:${userId}`, { signal }, run);
    else await run();
  };
  void start().catch(() => undefined);
  return () => controller.abort();
}
