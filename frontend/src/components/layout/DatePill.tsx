"use client";

import { CalendarDays } from "lucide-react";
import { useDhakaToday } from "@/hooks/useDhakaToday";
import { formatDateKey } from "@/lib/time";

/** Today's Dhaka date. */
export function DatePill({ compact }: { compact?: boolean } = {}) {
  const today = useDhakaToday();
  return (
    <span
      className="inline-flex h-9 items-center gap-2 rounded-full border border-line bg-surface px-3 text-[13px] font-medium text-ink"
      data-testid="dhaka-date"
    >
      <CalendarDays size={15} strokeWidth={1.75} className="text-ink-2" />
      {compact ? (
        <span>{formatDateKey(today, "D MMM")}</span>
      ) : (
        <>
          <span className="hidden sm:inline">{formatDateKey(today, "MMM D, YYYY")}</span>
          <span className="sm:hidden">{formatDateKey(today, "D MMM")}</span>
        </>
      )}
    </span>
  );
}
