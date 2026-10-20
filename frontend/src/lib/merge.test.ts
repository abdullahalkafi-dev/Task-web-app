import { describe, expect, it } from "vitest";
import { mergeById, shouldApplyRemote } from "./merge";

const doc = (id: string, updatedAt: string, title = id) => ({ id, updatedAt, title });

describe("last-write-wins merge", () => {
  it("applies a remote copy only when strictly newer", () => {
    expect(shouldApplyRemote(undefined, doc("a", "2026-01-01T00:00:00.000Z"))).toBe(true);
    expect(shouldApplyRemote(doc("a", "2026-01-01T00:00:00.000Z"), doc("a", "2026-01-02T00:00:00.000Z"))).toBe(true);
    expect(shouldApplyRemote(doc("a", "2026-01-02T00:00:00.000Z"), doc("a", "2026-01-01T00:00:00.000Z"))).toBe(false);
    expect(shouldApplyRemote(doc("a", "2026-01-01T00:00:00.000Z"), doc("a", "2026-01-01T00:00:00.000Z"))).toBe(false);
  });

  it("merges lists: newer wins per document, unknown docs are added, local-only docs are kept", () => {
    const local = [doc("a", "2026-01-05T00:00:00.000Z", "local-a"), doc("b", "2026-01-01T00:00:00.000Z", "local-b"), doc("only-local", "2026-01-01T00:00:00.000Z")];
    const remote = [doc("a", "2026-01-02T00:00:00.000Z", "remote-a"), doc("b", "2026-01-03T00:00:00.000Z", "remote-b"), doc("c", "2026-01-01T00:00:00.000Z")];
    const merged = new Map(mergeById(local, remote).map((d) => [d.id, d.title]));
    expect(merged.get("a")).toBe("local-a");
    expect(merged.get("b")).toBe("remote-b");
    expect(merged.get("c")).toBe("c");
    expect(merged.has("only-local")).toBe(true);
  });

  it("treats a tombstone like any other edit", () => {
    const local = [{ ...doc("a", "2026-01-01T00:00:00.000Z"), deletedAt: null as string | null }];
    const remote = [{ ...doc("a", "2026-01-02T00:00:00.000Z"), deletedAt: "2026-01-02T00:00:00.000Z" as string | null }];
    expect(mergeById(local, remote)[0].deletedAt).toBe("2026-01-02T00:00:00.000Z");
  });
});
