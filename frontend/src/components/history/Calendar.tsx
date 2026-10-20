"use client";
import "@/lib/time";


import { useMemo } from "react";
import dayjs from "dayjs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../ui/cn";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Props {
  /** Visible month, YYYY-MM */
  month: string;
  selected: string | null;
  today: string;
  marked: ReadonlySet<string>;
  onSelect: (dateKey: string) => void;
  onMonthChange: (month: string) => void;
}

/** Custom month grid: today outlined, selected = black circle, dot under days with tasks, future disabled. */
export function Calendar({ month, selected, today, marked, onSelect, onMonthChange }: Props) {
  const cells = useMemo(() => {
    const first = dayjs.utc(`${month}-01`);
    const lead = (first.day() + 6) % 7; // Monday-first
    const out: Array<string | null> = Array(lead).fill(null);
    for (let d = 1; d <= first.daysInMonth(); d++) out.push(first.date(d).format("YYYY-MM-DD"));
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [month]);

  const weeks = useMemo(() => {
    const rows: Array<Array<string | null>> = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cells]);

  const title = dayjs.utc(`${month}-01`).format("MMMM YYYY");
  const prev = dayjs.utc(`${month}-01`).subtract(1, "month").format("YYYY-MM");
  const next = dayjs.utc(`${month}-01`).add(1, "month").format("YYYY-MM");
  const canNext = next <= today.slice(0, 7);

  return (
    <div className="rounded-panel bg-surface p-4 shadow-sm2 md:p-5" data-testid="calendar">
      <div className="mb-3 flex items-center">
        <h2 className="text-base font-semibold text-ink" aria-live="polite">
          {title}
        </h2>
        <div className="ml-auto flex gap-1">
          <button type="button" aria-label="Previous month" onClick={() => onMonthChange(prev)} className="grid h-11 w-11 place-items-center rounded-full text-ink-2 hover:bg-surface-muted">
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Next month"
            disabled={!canNext}
            onClick={() => onMonthChange(next)}
            className="grid h-11 w-11 place-items-center rounded-full text-ink-2 hover:bg-surface-muted disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div role="grid" aria-label={title} className="space-y-1 text-center">
        <div role="row" className="grid grid-cols-7">
          {WEEKDAYS.map((w) => (
            <div key={w} role="columnheader" className="pb-1 text-[11px] font-medium uppercase tracking-wide text-ink-3">
              {w}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} role="row" className="grid grid-cols-7">
            {week.map((key, i) => {
          if (!key) return <div key={`b${i}`} role="gridcell" />;
          const isToday = key === today;
          const future = key > today;
          const isSelected = key === selected;
          const disabled = future || isToday; // today lives on Home
          const label = dayjs.utc(key).format("dddd, D MMMM YYYY");
          return (
            <div key={key} role="gridcell" className="grid place-items-center">
              <button
                type="button"
                disabled={disabled}
                aria-label={`${label}${marked.has(key) ? ", has tasks" : ""}${isToday ? ", today" : ""}`}
                aria-pressed={isSelected}
                data-date={key}
                onClick={() => onSelect(key)}
                className={cn(
                  "relative grid h-11 w-11 place-items-center rounded-full text-sm transition duration-150",
                  isSelected ? "bg-primary font-semibold text-primary-ink shadow-md2" : "text-ink hover:bg-surface-muted",
                  isToday && !isSelected && "ring-1 ring-inset ring-ink-3",
                  future && "text-ink-3/50 hover:bg-transparent",
                  isToday && "cursor-default hover:bg-transparent",
                )}
              >
                {Number(key.slice(8))}
                {marked.has(key) && (
                  <span aria-hidden className={cn("absolute bottom-1.5 h-1 w-1 rounded-full", isSelected ? "bg-primary-ink" : "bg-accent-orange")} />
                )}
              </button>
            </div>
          );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
