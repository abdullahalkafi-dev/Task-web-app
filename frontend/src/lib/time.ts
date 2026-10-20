import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

export const DHAKA_TZ = "Asia/Dhaka";

export function dhakaNow(): dayjs.Dayjs {
  return dayjs().tz(DHAKA_TZ);
}

/** "YYYY-MM-DD" for the Dhaka calendar day — never UTC, never the browser zone. */
export function dhakaDateKey(d?: Date | string | number | dayjs.Dayjs): string {
  return (d === undefined ? dayjs() : dayjs(d)).tz(DHAKA_TZ).format("YYYY-MM-DD");
}

export function formatDhaka(iso: string | Date, fmt = "DD MMM YYYY, hh:mm A"): string {
  return dayjs(iso).tz(DHAKA_TZ).format(fmt);
}

export function dhakaHour(d?: Date): number {
  return (d === undefined ? dayjs() : dayjs(d)).tz(DHAKA_TZ).hour();
}

export function greetingFor(hour: number): "Good morning" | "Good afternoon" | "Good evening" {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

/** "Tuesday, 20 October 2026" for a date key. */
export function formatDateKey(key: string, fmt = "dddd, D MMMM YYYY"): string {
  return dayjs.tz(key, DHAKA_TZ).format(fmt);
}

export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0 && m === 0) return "0m";
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function splitMinutes(total: number): { hours: number; minutes: number } {
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

export function toMinutes(hours: number, minutes: number): number {
  const h = Math.min(23, Math.max(0, Math.floor(hours || 0)));
  const m = Math.min(59, Math.max(0, Math.floor(minutes || 0)));
  return h * 60 + m;
}

export function relativeFromNow(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime());
  if (diff < 45_000) return "just now";
  return dayjs(iso).from(dayjs(now));
}

export function monthKeyOf(dateKey: string): string {
  return dateKey.slice(0, 7);
}

export function addDaysKey(dateKey: string, days: number): string {
  return dayjs.utc(dateKey).add(days, "day").format("YYYY-MM-DD");
}
