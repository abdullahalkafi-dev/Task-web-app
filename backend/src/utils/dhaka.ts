import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

export const DHAKA_TZ = "Asia/Dhaka";
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function dhakaNow(): dayjs.Dayjs {
  return dayjs().tz(DHAKA_TZ);
}

export function dhakaDateKey(d?: Date | string | number | dayjs.Dayjs): string {
  return (d === undefined ? dayjs() : dayjs(d)).tz(DHAKA_TZ).format("YYYY-MM-DD");
}

export function formatDhaka(iso: string | Date, fmt = "DD MMM YYYY, hh:mm A"): string {
  return dayjs(iso).tz(DHAKA_TZ).format(fmt);
}

export function isValidDateKey(key: string): boolean {
  if (!DATE_KEY_RE.test(key)) return false;
  const d = dayjs.utc(key, "YYYY-MM-DD", true);
  return d.isValid() && d.format("YYYY-MM-DD") === key;
}

export function isValidMonthKey(key: string): boolean {
  return MONTH_KEY_RE.test(key);
}

/** A task date is accepted if valid and not later than Dhaka today + 1 day. */
export function isAcceptableTaskDate(key: string, now: Date = new Date()): boolean {
  if (!isValidDateKey(key)) return false;
  const limit = dayjs(now).tz(DHAKA_TZ).add(1, "day").format("YYYY-MM-DD");
  return key <= limit;
}
