import { describe, expect, it } from "vitest";
import { fitBounds, PRODUCTION_ORIGIN, resolveOrigin, safeExternal, trustedPage } from "../src/policy";
describe("desktop boundaries", () => {
  it("never allows an environment override in a packaged app", () => {
    expect(resolveOrigin(true, "https://evil.example")).toBe(PRODUCTION_ORIGIN);
    expect(resolveOrigin(false, "http://localhost:3100/a")).toBe("http://localhost:3100");
    expect(() => resolveOrigin(false, "https://evil.example")).toThrow();
    expect(trustedPage(`${PRODUCTION_ORIGIN}.evil.example`, PRODUCTION_ORIGIN)).toBe(false);
    expect(trustedPage(`${PRODUCTION_ORIGIN}/?note=a`, PRODUCTION_ORIGIN)).toBe(true);
    expect(safeExternal("file:///etc/passwd")).toBe(false);
    expect(safeExternal("javascript:alert(1)")).toBe(false);
  });
  it("keeps windows reachable on negative-position, small, and disconnected displays", () => {
    const result = fitBounds({ x: 9999, y: -9999, width: 1100, height: 800 }, { x: -800, y: 100, width: 800, height: 600 });
    expect(result).toEqual({ x: -800, y: 100, width: 800, height: 600 });
  });
});
