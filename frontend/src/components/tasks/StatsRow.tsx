import { Circle, CircleCheck, Clock, ListChecks, Loader } from "lucide-react";
import { formatMinutes } from "@/lib/time";
import type { TaskDoc } from "@/lib/types";
import { StatTile } from "../ui/StatTile";

/** Read-only summaries for today (not filters). */
export function StatsRow({ tasks }: { tasks: TaskDoc[] }) {
  const count = (s: TaskDoc["status"]): number => tasks.filter((t) => t.status === s).length;
  const planned = tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
  return (
    <section aria-label="Today at a glance" className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<ListChecks size={20} strokeWidth={1.75} />} value={tasks.length} label="Total tasks" tone="neutral" />
        <StatTile icon={<Circle size={20} strokeWidth={1.75} />} value={count("notStarted")} label="Not Started" tone="gray" />
        <StatTile icon={<Loader size={20} strokeWidth={1.75} />} value={count("started")} label="Started" tone="blue" />
        <StatTile icon={<CircleCheck size={20} strokeWidth={1.75} />} value={count("completed")} label="Completed" tone="green" />
      </div>
      <span className="gradient-pill inline-flex h-9 items-center gap-2 px-4 text-[13px] font-medium text-ink-2" data-testid="planned-time">
        <Clock size={14} strokeWidth={1.75} />
        <strong className="font-semibold text-ink">{formatMinutes(planned)}</strong> planned
      </span>
    </section>
  );
}
