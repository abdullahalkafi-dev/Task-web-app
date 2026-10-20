"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CloudOff, LayoutGrid, List } from "lucide-react";
import { useShell } from "@/components/layout/AppShell";
import { NoteEditorPanel } from "@/components/notes/NoteEditorPanel";
import { BoardSkeleton } from "@/components/tasks/BoardSkeleton";
import { EmptyDay } from "@/components/tasks/EmptyDay";
import { StatsRow } from "@/components/tasks/StatsRow";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { TaskEditorDialog } from "@/components/tasks/TaskEditorDialog";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { InfoBanner } from "@/components/ui/InfoBanner";
import { PillTabs } from "@/components/ui/PillTabs";
import { useToast } from "@/components/ui/Toast";
import { useData } from "@/hooks/useData";
import { useDhakaToday } from "@/hooks/useDhakaToday";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useSyncOnline } from "@/hooks/useOnline";
import { useTasks } from "@/hooks/useTasks";
import { deleteTask } from "@/lib/repo";
import { formatDateKey } from "@/lib/time";
import type { TaskDoc, TaskStatus } from "@/lib/types";

type View = "board" | "list";
const VIEW_KEY = "dayflow-view";

function useViewPref(): [View, (v: View) => void] {
  const wide = useMediaQuery("(min-width: 768px)");
  const [stored, setStored] = useState<View | null>(null);
  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "board" || v === "list") setStored(v);
    } catch {
      /* ignore */
    }
  }, []);
  const set = useCallback((v: View) => {
    setStored(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  }, []);
  return [stored ?? (wide ? "board" : "list"), set];
}

function TodayView() {
  const { db } = useData();
  const toast = useToast();
  const { addTaskTick } = useShell();
  const online = useSyncOnline();
  const today = useDhakaToday();
  const tasks = useTasks(today);
  const [view, setView] = useViewPref();
  const [editor, setEditor] = useState<{ open: boolean; task: TaskDoc | null; status: TaskStatus }>({ open: false, task: null, status: "notStarted" });
  const [toDelete, setToDelete] = useState<TaskDoc | null>(null);

  // "+" in the mobile tab bar (or elsewhere) asks Home to open the editor.
  const seenTick = useRef(addTaskTick);
  useEffect(() => {
    if (addTaskTick !== seenTick.current) {
      seenTick.current = addTaskTick;
      setEditor({ open: true, task: null, status: "notStarted" });
    }
  }, [addTaskTick]);

  const seqById = useMemo(() => {
    const byCreated = [...(tasks ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return new Map(byCreated.map((t, i) => [t.id, i + 1]));
  }, [tasks]);

  const openNew = (): void => setEditor({ open: true, task: null, status: "notStarted" });
  const closeEditor = (): void => setEditor((e) => ({ ...e, open: false }));
  const openTask = useCallback((t: TaskDoc) => setEditor({ open: true, task: t, status: t.status }), []);
  const askDelete = useCallback((t: TaskDoc) => setToDelete(t), []);
  const openInColumn = useCallback((status: TaskStatus) => setEditor({ open: true, task: null, status }), []);

  return (
    <div className="space-y-5 md:space-y-6">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1 basis-60">
          <h1 className="text-2xl font-bold leading-tight tracking-[-0.02em] text-ink md:text-[28px]">Today’s tasks</h1>
          <p className="mt-0.5 text-sm text-ink-2" data-testid="today-date">
            {formatDateKey(today, "dddd D MMMM")} · resets at midnight
          </p>
        </div>
        <PillTabs
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: "board", label: "Board", icon: <LayoutGrid size={15} strokeWidth={1.75} /> },
            { value: "list", label: "List", icon: <List size={15} strokeWidth={1.75} /> },
          ]}
        />
        <Button plus onClick={openNew} className="hidden md:inline-flex" data-testid="add-task">
          Add task
        </Button>
      </header>

      {!online && (
        <InfoBanner title="You’re offline —" icon={<CloudOff size={18} strokeWidth={1.75} />}>
          changes are saved on this device and will sync automatically.
        </InfoBanner>
      )}

      <StatsRow tasks={tasks ?? []} />

      {!tasks ? (
        <BoardSkeleton />
      ) : tasks.length === 0 ? (
        <EmptyDay onAdd={openNew} />
      ) : (
        <TaskBoard
          tasks={tasks}
          view={view}
          seqById={seqById}
          onOpen={openTask}
          onDelete={askDelete}
          onAddInColumn={openInColumn}
        />
      )}

      <TaskEditorDialog
        open={editor.open}
        task={editor.task}
        defaultStatus={editor.status}
        onClose={closeEditor}
        onDelete={(t) => {
          closeEditor();
          setToDelete(t);
        }}
      />
      <ConfirmDialog
        open={!!toDelete}
        title="Delete this task?"
        message="Delete this task? This can't be undone."
        onClose={() => setToDelete(null)}
        onConfirm={() => {
          if (toDelete) void deleteTask(db, toDelete.id).then(() => toast.show("Task deleted"));
        }}
      />
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const params = useSearchParams();
  const noteId = params.get("note");
  if (noteId) return <NoteEditorPanel id={noteId} onBack={() => router.push("/")} />;
  return <TodayView />;
}
