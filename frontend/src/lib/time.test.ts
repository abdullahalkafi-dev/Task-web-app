import { describe, expect, it } from "vitest";
import { addDaysKey, dhakaDateKey, dhakaHour, formatDhaka, formatMinutes, greetingFor, relativeFromNow, splitMinutes, toMinutes } from "./time";

describe("Dhaka date logic (Asia/Dhaka, UTC+6)", () => {
  it("derives the day from Dhaka, never UTC", () => {
    // 17:59 UTC is 23:59 in Dhaka -> still the 20th
    expect(dhakaDateKey(new Date("2026-10-20T17:59:59Z"))).toBe("2026-10-20");
    // 18:00 UTC is 00:00 in Dhaka -> the 21st
    expect(dhakaDateKey(new Date("2026-10-20T18:00:00Z"))).toBe("2026-10-21");
    expect(dhakaDateKey(new Date("2026-12-31T20:00:00Z"))).toBe("2027-01-01");
  });

  it("reads the hour in Dhaka time", () => {
    expect(dhakaHour(new Date("2026-10-20T00:00:00Z"))).toBe(6);
    expect(dhakaHour(new Date("2026-10-20T18:30:00Z"))).toBe(0);
  });

  it("formats timestamps in Dhaka time", () => {
    expect(formatDhaka("2026-10-20T19:40:00Z")).toBe("21 Oct 2026, 01:40 AM");
    expect(formatDhaka("2026-10-12T03:14:00Z")).toBe("12 Oct 2026, 09:14 AM");
  });

  it("picks the greeting from the Dhaka hour (5–12 / 12–17 / 17–5)", () => {
    expect(greetingFor(5)).toBe("Good morning");
    expect(greetingFor(11)).toBe("Good morning");
    expect(greetingFor(12)).toBe("Good afternoon");
    expect(greetingFor(16)).toBe("Good afternoon");
    expect(greetingFor(17)).toBe("Good evening");
    expect(greetingFor(23)).toBe("Good evening");
    expect(greetingFor(0)).toBe("Good evening");
    expect(greetingFor(4)).toBe("Good evening");
  });

  it("does date arithmetic on keys", () => {
    expect(addDaysKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysKey("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("estimated time", () => {
  it("stores 1h 30m as 90 minutes and shows it back", () => {
    expect(toMinutes(1, 30)).toBe(90);
    expect(formatMinutes(90)).toBe("1h 30m");
    expect(splitMinutes(90)).toEqual({ hours: 1, minutes: 30 });
  });

  it("clamps to 0–23h and 0–59m", () => {
    expect(toMinutes(99, 99)).toBe(23 * 60 + 59);
    expect(toMinutes(-1, -5)).toBe(0);
    expect(toMinutes(Number.NaN, 15)).toBe(15);
  });

  it("formats edge cases", () => {
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(120)).toBe("2h");
  });
});

describe("relative time", () => {
  it("says 'just now' for fresh timestamps", () => {
    const now = Date.now();
    expect(relativeFromNow(new Date(now - 5_000).toISOString(), now)).toBe("just now");
  });
  it("uses hours for older ones", () => {
    const now = Date.now();
    expect(relativeFromNow(new Date(now - 2 * 3_600_000).toISOString(), now)).toBe("2 hours ago");
  });
});
