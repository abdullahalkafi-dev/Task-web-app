import { describe, expect, it, vi } from "vitest";
import { flushLocalWrites, registerLocalWriter } from "./local-save";
describe("native save boundary", () => {
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
