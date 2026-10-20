"use client";

import { useState } from "react";
import { Check, ChevronDown, Clock, Copy } from "lucide-react";
import { formatMinutes } from "@/lib/time";
import type { TaskDoc } from "@/lib/types";
import { RichContent } from "../editor/RichContent";
import { Button } from "../ui/Button";
import { cn } from "../ui/cn";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { GradientPill } from "../ui/GradientPill";
import { StatusChip } from "../ui/StatusChip";

/** Read-only card (no drag handle) with an expandable description and "Copy to Today". */
export function HistoryTaskCard({ task, seq, copied, onCopy }: { task: TaskDoc; seq: number; copied: boolean; onCopy: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const hasBody = task.descriptionHtml.trim().length > 0;
  return (
    <article className="rounded-card bg-surface-muted p-5 shadow-sm2" data-testid="history-task">
      <div className="flex items-center gap-2">
        <span className="rounded-chip bg-surface px-2 py-1 text-[11px] font-medium tracking-wide text-ink-2">#{String(seq).padStart(2, "0")}</span>
        <StatusChip status={task.status} className="ml-auto" />
      </div>
      <h3 className="mt-2 text-base font-semibold text-ink">{task.title}</h3>

      {hasBody && (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="mt-1.5 inline-flex min-h-[32px] items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink"
          >
            {open ? "Hide details" : "Show details"}
            <ChevronDown size={14} className={cn("transition-transform", open && "rotate-180")} />
          </button>
          {open && <RichContent html={task.descriptionHtml} className="mt-2 rounded-2xl bg-surface p-4" />}
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line-strong/60 pt-3">
        <GradientPill>
          <Clock size={13} strokeWidth={1.75} />
          Est: <strong className="font-semibold text-ink">{formatMinutes(task.estimatedMinutes)}</strong>
        </GradientPill>
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          icon={copied ? <Check size={15} /> : <Copy size={15} />}
          onClick={() => (copied ? setConfirm(true) : onCopy())}
        >
          {copied ? "Copied ✓" : "Copy to Today"}
        </Button>
      </div>

      <ConfirmDialog
        open={confirm}
        title="Copy again?"
        message="This task was already copied to today. Copy it again?"
        confirmLabel="Copy again"
        onClose={() => setConfirm(false)}
        onConfirm={onCopy}
      />
    </article>
  );
}
