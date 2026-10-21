import { describe, expect, it, vi } from "vitest";
import { consumeFrames } from "./change-stream";
describe("change notifications", () => {
  it("handles split frames, comments and multiple events without dropping the tail", () => {
    const changed = vi.fn();
    let buffer = consumeFrames(": heartbeat\n\nevent: cha", changed);
    expect(changed).not.toHaveBeenCalled();
    buffer = consumeFrames(`${buffer}nge\ndata: {}\n\nevent: change\ndata: {}\n\npartial`, changed);
    expect(changed).toHaveBeenCalledTimes(2);
    expect(buffer).toBe("partial");
  });
});
