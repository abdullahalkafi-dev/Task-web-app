"use client";

import { forwardRef, memo, type HTMLAttributes, type Ref } from "react";
import { Check, Clock, Copy, GripVertical, Pencil, Play, RotateCcw, Trash2 } from "lucide-react";
import { formatDhaka, formatMinutes } from "@/lib/time";
import type { TaskDoc, TaskStatus } from "@/lib/types";
import { RichContent } from "../editor/RichContent";
import { cn } from "../ui/cn";
import { GradientPill } from "../ui/GradientPill";
import { StatusChip } from "../ui/StatusChip";

/** One-tap status transition shown on every card: Start → Complete → Reopen. */
export const QUICK_ACTION: Record<TaskStatus, { label: string; next: TaskStatus; className: string }> = {
  notStarted: {
    label: "Start",
    next: "started",
    className: "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900",
  },
  started: { label: "Complete", next: "completed", className: "bg-st-c-bg text-st-c-fg hover:brightness-95" },
  completed: { label: "Reopen", next: "started", className: "bg-surface-muted text-ink-2 hover:bg-surface-hover" },
};

function QuickIcon({ status }: { status: TaskStatus }) {
  if (status === "notStarted") return <Play size={14} strokeWidth={2} />;
  if (status === "started") return <Check size={14} strokeWidth={2.25} />;
  return <RotateCcw size={14} strokeWidth={2} />;
}

export interface TaskCardProps {
  task: TaskDoc;
  seq: number;
  onEdit?: (t: TaskDoc) => void;
  onDelete?: (t: TaskDoc) => void;
  /** Start / Complete / Reopen */
  onQuickAction?: (t: TaskDoc) => void;
  /** List view has no columns, so it also shows the status chip (dropdown). */
  onStatusChange?: (t: TaskDoc, s: TaskStatus) => void;
  handleProps?: HTMLAttributes<HTMLButtonElement>;
  handleRef?: Ref<HTMLButtonElement>;
  dragging?: boolean;
  overlay?: boolean;
}

const iconBtn =
  "grid h-9 w-9 place-items-center rounded-full text-ink-3 transition hover:bg-surface-muted hover:text-ink [@media(hover:none)]:h-11 [@media(hover:none)]:w-11";

function TaskCardImpl(
  { task, seq, onEdit, onDelete, onQuickAction, onStatusChange, handleProps, handleRef, dragging, overlay, className, ...rest }: TaskCardProps & Omit<HTMLAttributes<HTMLDivElement>, keyof TaskCardProps>,
  ref: Ref<HTMLDivElement>,
) {
  const done = task.status === "completed";
  const quick = QUICK_ACTION[task.status];
  const hasBody = task.descriptionHtml.trim().length > 0;
  return (
    <div
      ref={ref}
      data-testid="task-card"
      data-task-id={task.id}
      className={cn(
        "group relative rounded-card border border-line bg-surface p-4 shadow-sm2 transition duration-200 ease-out",
        !overlay && "hover:-translate-y-px hover:shadow-md2",
        // Completed cards "fade" (surface at 70%) while the text keeps AA contrast.
        done && "bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] shadow-none",
        dragging && "opacity-40",
        overlay && "scale-[1.02] cursor-grabbing shadow-drag",
        className,
      )}
      {...rest}
    >
      <div className="flex min-h-9 items-center gap-1.5">
        <span className="rounded-chip bg-surface-muted px-2 py-1 text-[11px] font-medium tracking-wide text-ink-2">#{String(seq).padStart(2, "0")}</span>
        {task.copiedFromDate && (
          <span className="inline-flex items-center gap-1 rounded-chip bg-indigo-50 px-2 py-1 text-[11px] font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
            <Copy size={11} strokeWidth={2} />
            From {formatDhaka(`${task.copiedFromDate}T12:00:00+06:00`, "D MMM")}
          </span>
        )}
        {!overlay && (
          <div className="-mr-1.5 ml-auto flex items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100">
            {handleProps && (
              <button ref={handleRef} type="button" aria-label={`Drag to reorder: ${task.title}`} className={cn(iconBtn, "cursor-grab active:cursor-grabbing")} {...handleProps}>
                <GripVertical size={16} strokeWidth={1.75} />
              </button>
            )}
            {onEdit && (
              <button type="button" aria-label={`Edit ${task.title}`} title="Edit" onClick={() => onEdit(task)} className={iconBtn}>
                <Pencil size={15} strokeWidth={1.75} />
              </button>
            )}
            {onDelete && (
              <button type="button" aria-label={`Delete ${task.title}`} title="Delete" onClick={() => onDelete(task)} className={cn(iconBtn, "hover:text-red-600")}>
                <Trash2 size={15} strokeWidth={1.75} />
              </button>
            )}
          </div>
        )}
      </div>

      <button type="button" onClick={onEdit ? () => onEdit(task) : undefined} disabled={!onEdit} className="mt-1 block w-full text-left disabled:cursor-default">
        <h4 className={cn("line-clamp-2 text-[15px] font-semibold leading-snug text-ink", done && "text-ink-2 line-through decoration-ink-3")}>{task.title}</h4>
      </button>
      {hasBody && (
        // Same formatted content as the editor (lists, headings, bold, links, images).
        <div
          className={cn("mt-1.5", onEdit && "cursor-pointer")}
          onClick={(e) => {
            if (onEdit && !(e.target as HTMLElement).closest("a")) onEdit(task);
          }}
        >
          <RichContent html={task.descriptionHtml} className="!text-[13px] !leading-relaxed !text-ink-2 [&_h1]:!text-base [&_h2]:!text-[15px] [&_h3]:!text-sm [&_img]:max-h-40 [&_img]:w-auto [&>*:last-child]:!mb-0" />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <GradientPill className={cn(task.estimatedMinutes === 0 && "text-ink-3")}>
          <Clock size={13} strokeWidth={1.75} />
          {task.estimatedMinutes === 0 ? "No estimate" : <strong className="font-semibold text-ink">{formatMinutes(task.estimatedMinutes)}</strong>}
        </GradientPill>
        {!overlay && (
          <span className="ml-auto flex items-center gap-2">
            {onStatusChange && <StatusChip status={task.status} onChange={(s) => onStatusChange(task, s)} />}
            {onQuickAction && (
              <button
                type="button"
                aria-label={`${quick.label}: ${task.title}`}
                onClick={() => onQuickAction(task)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition active:scale-95 [@media(hover:none)]:h-11",
                  quick.className,
                )}
              >
                <QuickIcon status={task.status} />
                {quick.label}
              </button>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

export const TaskCard = memo(forwardRef(TaskCardImpl));
