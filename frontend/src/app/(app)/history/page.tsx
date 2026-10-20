"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/history/Calendar";
import { HistoryTaskCard } from "@/components/history/HistoryTaskCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useData } from "@/hooks/useData";
import { useDhakaToday } from "@/hooks/useDhakaToday";
import { useTaskDates, useTasks } from "@/hooks/useTasks";
import { api } from "@/lib/api";
import { copyTaskToToday } from "@/lib/repo";
import { addDaysKey, formatDateKey } from "@/lib/time";

export default function HistoryPage() {
  const { db, userId } = useData();
  const toast = useToast();
  const today = useDhakaToday();
  const [month, setMonth] = useState(() => addDaysKey(today, 0).slice(0, 7));
  const [selected, setSelected] = useState<string | null>(null);
  const localDates = useTaskDates(month);
  const [serverDates, setServerDates] = useState<string[]>([]);
  const dayTasks = useTasks(selected ?? "0000-00-00");
  const todayTasks = useTasks(today);

  // Online: also ask the server for the month's task days (IndexedDB alone covers offline).
  useEffect(() => {
    let cancelled = false;
    setServerDates([]);
    if (!navigator.onLine) return;
    api
      .taskDates(month)
      .then((r) => {
        if (!cancelled) setServerDates(r.dates);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [month]);

  const marked = useMemo(() => new Set<string>([...(localDates ?? []), ...serverDates]), [localDates, serverDates]);
  const copiedIds = useMemo(() => new Set((todayTasks ?? []).map((t) => t.copiedFromTaskId).filter((x): x is string => !!x)), [todayTasks]);

  const ordered = useMemo(() => [...(dayTasks ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [dayTasks]);
  const seqById = useMemo(() => new Map(ordered.map((t, i) => [t.id, i + 1])), [ordered]);

  return (
    <div className="space-y-5 md:space-y-6">
      <header>
        <h1 className="text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink md:text-4xl">Task History</h1>
        <p className="mt-1.5 text-sm text-ink-2">Look back at any past day.</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr] lg:items-start">
        <Calendar
          month={month}
          selected={selected}
          today={today}
          marked={marked}
          onSelect={setSelected}
          onMonthChange={setMonth}
        />

        <section aria-label="Tasks of the selected day" aria-live="polite">
          {!selected ? (
            <div className="grid place-items-center rounded-panel bg-surface px-6 py-16 text-center shadow-sm2">
              <span className="mb-3 grid h-14 w-14 place-items-center rounded-[20px] bg-surface-muted text-ink-2">
                <CalendarDays size={26} strokeWidth={1.5} />
              </span>
              <p className="text-sm text-ink-2">Pick a day to see its tasks.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-[22px] font-semibold text-ink" data-testid="history-day-title">
                {formatDateKey(selected)}
              </h2>
              {!dayTasks ? (
                <Skeleton className="h-40" />
              ) : ordered.length === 0 ? (
                <p className="rounded-panel bg-surface px-6 py-10 text-center text-sm text-ink-2 shadow-sm2">No tasks on this day.</p>
              ) : (
                ordered.map((t) => (
                  <HistoryTaskCard
                    key={t.id}
                    task={t}
                    seq={seqById.get(t.id) ?? 0}
                    copied={copiedIds.has(t.id)}
                    onCopy={() => void copyTaskToToday(db, userId, t).then(() => toast.show("Copied to today ✓"))}
                  />
                ))
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
