"use client";

import { ChevronDown, Circle, CircleCheck, Loader } from "lucide-react";
import { STATUS_LABEL, STATUS_ORDER, type TaskStatus } from "@/lib/types";
import { cn } from "./cn";
import { Menu } from "./Menu";

const tone: Record<TaskStatus, string> = {
  notStarted: "bg-st-ns-bg text-st-ns-fg",
  started: "bg-st-s-bg text-st-s-fg",
  completed: "bg-st-c-bg text-st-c-fg",
};

export function StatusIcon({ status, size = 14 }: { status: TaskStatus; size?: number }) {
  if (status === "completed") return <CircleCheck size={size} strokeWidth={1.75} />;
  if (status === "started") return <Loader size={size} strokeWidth={1.75} />;
  return <Circle size={size} strokeWidth={1.75} />;
}

/** Soft tinted chip. Pass `onChange` to make it a status dropdown. */
export function StatusChip({
  status,
  onChange,
  className,
}: {
  status: TaskStatus;
  onChange?: (s: TaskStatus) => void;
  className?: string;
}) {
  const base = cn("inline-flex h-7 items-center gap-1.5 rounded-chip px-2.5 text-xs font-medium", tone[status], className);
  if (!onChange) {
    return (
      <span className={base}>
        <StatusIcon status={status} />
        {STATUS_LABEL[status]}
      </span>
    );
  }
  return (
    <Menu
      label="Change status"
      align="left"
      items={STATUS_ORDER.map((s) => ({
        label: STATUS_LABEL[s],
        icon: <StatusIcon status={s} size={16} />,
        active: s === status,
        onSelect: () => onChange(s),
      }))}
      trigger={({ toggle, ref, open }) => (
        <button
          ref={ref}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggle();
          }}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={`Status: ${STATUS_LABEL[status]}. Change status`}
          className={cn(base, "min-h-[28px] cursor-pointer transition hover:brightness-95 active:scale-[0.97]")}
        >
          <StatusIcon status={status} />
          {STATUS_LABEL[status]}
          <ChevronDown size={12} />
        </button>
      )}
    />
  );
}
