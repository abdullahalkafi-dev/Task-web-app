"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Trash2 } from "lucide-react";
import { useData } from "@/hooks/useData";
import { getMeta, setMeta } from "@/lib/db";
import { createTask, updateTask } from "@/lib/repo";
import { formatDhaka, splitMinutes, toMinutes } from "@/lib/time";
import { STATUS_LABEL, STATUS_ORDER, type TaskDoc, type TaskStatus } from "@/lib/types";
import { RichTextEditor } from "../editor/RichTextEditor";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { PillTabs } from "../ui/PillTabs";
import { useToast } from "../ui/Toast";
import { registerLocalWriter } from "@/lib/local-save";

interface Draft {
  id?: string;
  title: string;
  html: string;
  hours: number;
  minutes: number;
  status: TaskStatus;
  base: string | null;
}

interface BodyProps {
  task: TaskDoc | null;
  defaultStatus: TaskStatus;
  onClose: () => void;
  onDelete: (t: TaskDoc) => void;
}

const timeBox = "flex h-12 flex-1 items-center justify-between gap-2 rounded-input bg-surface-muted px-4 text-sm text-ink-3 focus-within:ring-2 focus-within:ring-accent-blue/30";
const timeInput = "w-full min-w-0 bg-transparent text-base font-semibold text-ink outline-none";

function EditorBody({ task, defaultStatus, onClose, onDelete }: BodyProps) {
  const { db, userId } = useData();
  const toast = useToast();
  const draftKey = `draft:task:${task?.id ?? "new"}`;
  const newId = useRef<string>(task?.id ?? crypto.randomUUID());
  const initial = useMemo(() => {
    const { hours, minutes } = splitMinutes(task?.estimatedMinutes ?? 0);
    return { title: task?.title ?? "", html: task?.descriptionHtml ?? "", hours, minutes, status: (task?.status ?? defaultStatus) as TaskStatus };
  }, [task, defaultStatus]);

  const [title, setTitle] = useState(initial.title);
  const [html, setHtml] = useState(initial.html);
  const [hours, setHours] = useState(initial.hours);
  const [minutes, setMinutes] = useState(initial.minutes);
  const [status, setStatus] = useState<TaskStatus>(initial.status);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorKey, setEditorKey] = useState(0);
  const dirty = useRef(false);
  const base = useRef(task?.updatedAt ?? null);
  const latestDraft = useRef<Draft>({ id: newId.current, title, html, hours, minutes, status, base: base.current });
  latestDraft.current = { id: newId.current, title, html, hours, minutes, status, base: base.current };
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const write = async () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
      if (dirty.current) await setMeta(db, draftKey, latestDraft.current);
    };
    const unregister = registerLocalWriter(write);
    return () => { unregister(); void write(); };
  }, [db, draftKey]);

  // Restore a local draft (nothing is lost if the dialog was closed by accident).
  useEffect(() => {
    let cancelled = false;
    void getMeta<Draft>(db, draftKey).then((d) => {
      if (cancelled || !d) return;
      if (!task && d.id) newId.current = d.id;
      if (task && d.base !== task.updatedAt) toast.show("Task changed elsewhere. Your saved draft is restored for review before saving.", "info");
      setTitle(d.title);
      setHtml(d.html);
      setHours(d.hours);
      setMinutes(d.minutes);
      setStatus(d.status);
      setEditorKey((k) => k + 1);
      toast.show("Draft restored", "info");
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Draft autosave every 1s while typing.
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => {
      void setMeta(db, draftKey, latestDraft.current);
    }, 1000);
    draftTimer.current = t;
    return () => clearTimeout(t);
  }, [title, html, hours, minutes, status, db, draftKey, task]);

  const touch = <T,>(setter: (v: T) => void) => (v: T) => {
    dirty.current = true;
    setter(v);
  };

  async function save(): Promise<void> {
    if (!title.trim()) {
      setError("Give your task a title.");
      return;
    }
    setSaving(true);
    const estimatedMinutes = toMinutes(hours, minutes);
    try {
      if (task) await updateTask(db, task.id, { title, descriptionHtml: html, estimatedMinutes, status });
      else await createTask(db, userId, { id: newId.current, title, descriptionHtml: html, estimatedMinutes, status });
      dirty.current = false;
      if (draftTimer.current) clearTimeout(draftTimer.current);
      await db.meta.delete(draftKey);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        <input
          data-autofocus
          value={title}
          onChange={(e) => {
            touch(setTitle)(e.target.value);
            setError(null);
          }}
          maxLength={200}
          placeholder="Task title"
          aria-label="Task title"
          aria-invalid={!!error}
          className="w-full border-0 bg-transparent text-2xl font-bold tracking-tight text-ink outline-none placeholder:text-ink-3"
        />
        {error && (
          <p role="alert" className="text-[13px] text-red-600">
            {error}
          </p>
        )}

        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-2">Description</p>
          <RichTextEditor boxed key={editorKey} value={html} onChange={touch(setHtml)} entity="task" entityId={newId.current} placeholder="Add details, links or images…" minHeight={150} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Estimated time</legend>
            <div className="flex items-center gap-2">
              <label className={timeBox}>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={23}
                  value={hours}
                  aria-label="Hours"
                  onChange={(e) => touch(setHours)(Math.min(23, Math.max(0, Number(e.target.value) || 0)))}
                  className={timeInput}
                />
                <span aria-hidden>h</span>
              </label>
              <label className={timeBox}>
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={59}
                  step={5}
                  value={minutes}
                  aria-label="Minutes"
                  onChange={(e) => touch(setMinutes)(Math.min(59, Math.max(0, Number(e.target.value) || 0)))}
                  className={timeInput}
                />
                <span aria-hidden>m</span>
              </label>
            </div>
          </fieldset>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink-2">Status</p>
            <PillTabs
              accentActive
              label="Status"
              value={status}
              onChange={touch(setStatus)}
              options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
              className="w-full [&>button]:flex-1 [&>button]:justify-center [&>button]:px-2"
            />
          </div>
        </div>
      </div>

      <div className="safe-bottom sticky bottom-0 -mx-5 mt-5 flex items-center gap-2 border-t border-line bg-surface px-5 py-3 md:-mx-6 md:px-6">
        {task && (
          <Button
            variant="soft"
            icon={<Trash2 size={16} />}
            onClick={() => onDelete(task)}
            className="!bg-red-50 !text-red-700 hover:!bg-red-100 dark:!bg-red-950 dark:!text-red-300"
          >
            Delete
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="soft" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            Save task
          </Button>
        </div>
      </div>
    </>
  );
}

export function TaskEditorDialog({
  open,
  task,
  defaultStatus = "notStarted",
  onClose,
  onDelete,
}: {
  open: boolean;
  task: TaskDoc | null;
  /** Status preselected for a new task (the "+" in a board column). */
  defaultStatus?: TaskStatus;
  onClose: () => void;
  onDelete: (t: TaskDoc) => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={task ? "Edit task" : "New task"}
      dismissOnBackdrop={false}
      headerContent={
        <>
          <span className="rounded-chip bg-surface-muted px-2.5 py-1.5 text-xs font-medium text-ink-2">{task ? "Edit task" : "New task"}</span>
          {task?.copiedFromDate && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              <Copy size={12} strokeWidth={2} />
              Transferred from {formatDhaka(`${task.copiedFromDate}T12:00:00+06:00`, "D MMM YYYY")}
            </span>
          )}
        </>
      }
    >
      {open && <EditorBody key={task?.id ?? `new-${defaultStatus}`} task={task} defaultStatus={defaultStatus} onClose={onClose} onDelete={onDelete} />}
    </Dialog>
  );
}
