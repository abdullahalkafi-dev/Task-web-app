import { describe, expect, it } from "vitest";
import { computeMove, gapTooSmall, orderAtEnd, orderBetween, renormalize, type Ordered } from "./order";

const list = (...orders: number[]): Ordered[] => orders.map((o, i) => ({ id: String.fromCharCode(97 + i), orderIndex: o }));

describe("fractional ordering", () => {
  it("places between, at the top and at the bottom", () => {
    expect(orderBetween(1024, 2048)).toBe(1536);
    expect(orderBetween(undefined, 1024)).toBe(0); // first - 1024
    expect(orderBetween(3072, undefined)).toBe(4096); // last + 1024
    expect(orderBetween(undefined, undefined)).toBe(1024);
  });

  it("appends at the end of a list", () => {
    expect(orderAtEnd([])).toBe(1024);
    expect(orderAtEnd(list(1024, 2048, 512))).toBe(3072);
  });

  it("updates exactly ONE document for a normal move", () => {
    const items = list(1024, 2048, 3072); // a, b, c
    const updates = computeMove(items, "c", 0); // c to the top
    expect(updates).toEqual([{ id: "c", orderIndex: 0 }]);
    expect(computeMove(items, "a", 1)).toEqual([{ id: "a", orderIndex: 2560 }]); // between b and c
    expect(computeMove(items, "a", 2)).toEqual([{ id: "a", orderIndex: 4096 }]); // bottom
  });

  it("renormalizes the list when the gap gets smaller than 1e-6", () => {
    expect(gapTooSmall(1, 1 + 1e-7)).toBe(true);
    expect(gapTooSmall(1, 2)).toBe(false);
    const items = list(1000, 1000.0000001, 2000); // a, b are almost identical
    const updates = computeMove(items, "c", 1); // c between a and b
    const byId = new Map(updates.map((u) => [u.id, u.orderIndex]));
    expect(byId.get("a")).toBe(1024);
    expect(byId.get("c")).toBe(2048);
    expect(byId.get("b")).toBe(3072);
  });

  it("renormalize() spaces ids 1024 apart", () => {
    expect(renormalize(["x", "y"])).toEqual([
      { id: "x", orderIndex: 1024 },
      { id: "y", orderIndex: 2048 },
    ]);
  });

  it("survives many repeated inserts at the same spot", () => {
    let items = list(1024, 2048);
    for (let i = 0; i < 80; i++) {
      const id = `n${i}`;
      const updates = computeMove([...items, { id, orderIndex: 9999 }], id, 1);
      const merged = new Map([...items, { id, orderIndex: 9999 }].map((x) => [x.id, x.orderIndex]));
      updates.forEach((u) => merged.set(u.id, u.orderIndex));
      items = Array.from(merged, ([k, v]) => ({ id: k, orderIndex: v }));
    }
    const sorted = [...items].sort((a, b) => a.orderIndex - b.orderIndex);
    expect(new Set(sorted.map((s) => s.orderIndex)).size).toBe(items.length); // all distinct, no collisions
    expect(sorted[0].id).toBe("a");
    expect(sorted[sorted.length - 1].id).toBe("b");
  });
});
