import { describe, expect, it, vi } from "vitest";
import { notifyUser, subscribeUser } from "./sync.events";
describe("sync notifications", () => {
  it("isolates users and removes disconnected subscribers", () => {
    const a = vi.fn(); const b = vi.fn();
    const stopA = subscribeUser("a", a); const stopB = subscribeUser("b", b);
    notifyUser("a"); expect(a).toHaveBeenCalledOnce(); expect(b).not.toHaveBeenCalled();
    stopA(); notifyUser("a"); expect(a).toHaveBeenCalledOnce(); stopB();
  });
});
