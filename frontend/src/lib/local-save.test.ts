import { describe, expect, it, vi } from "vitest";
import { finishLocalWriter, flushLocalWrites, registerLocalWriter } from "./local-save";
describe("native save boundary", () => {
  it("keeps a closing editor's pending save registered and retries storage failures", async () => {
    let finish: (() => void) | undefined;
    finishLocalWriter(() => new Promise<void>((resolve) => { finish = resolve; }));
    const done = vi.fn();
    const waiting = flushLocalWrites().then(done);
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    finish?.(); await waiting;
    const retry = vi.fn().mockRejectedValueOnce(new Error("storage unavailable")).mockResolvedValue(undefined);
    finishLocalWriter(retry);
    await expect(flushLocalWrites()).rejects.toThrow("storage unavailable");
    await expect(flushLocalWrites()).resolves.toBeUndefined();
    expect(retry).toHaveBeenCalledTimes(2);
  });
  it("waits for actual writes, reports failures, and unregisters editors", async () => {
    let finish: (() => void) | undefined;
    const unregister = registerLocalWriter(() => new Promise<void>((resolve) => { finish = resolve; }));
    const done = vi.fn();
    const pending = flushLocalWrites().then(done);
    expect(done).not.toHaveBeenCalled();
    finish?.(); await pending;
    expect(done).toHaveBeenCalledOnce(); unregister();
    const remove = registerLocalWriter(async () => { throw new Error("disk full"); });
    await expect(flushLocalWrites()).rejects.toThrow("disk full"); remove();
    await expect(flushLocalWrites()).resolves.toBeUndefined();
  });
});
