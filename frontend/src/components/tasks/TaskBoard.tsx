"use client";

import { memo, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useData } from "@/hooks/useData";
import { orderAtEnd } from "@/lib/order";
import { moveTask, updateTask } from "@/lib/repo";
import { STATUS_LABEL, STATUS_ORDER, type TaskDoc, type TaskStatus } from "@/lib/types";
import { cn } from "../ui/cn";
import { ColumnHeader } from "../ui/ColumnHeader";
import { QUICK_ACTION, TaskCard } from "./TaskCard";

// Accent bars follow the reference: orange / indigo / green.
const ACCENT: Record<TaskStatus, string> = {
  notStarted: "#F97316",
  started: "#6366F1",
  completed: "#16A34A",
};

type Columns = Record<TaskStatus, string[]>;

interface Props {
  tasks: TaskDoc[];
  view: "board" | "list";
  seqById: Map<string, number>;
  onOpen: (t: TaskDoc) => void;
  onDelete: (t: TaskDoc) => void;
  /** The "+" in a column header: open the editor with that status pre-selected. */
  onAddInColumn: (status: TaskStatus) => void;
}

interface CardActions {
  onOpen: (t: TaskDoc) => void;
  onDelete: (t: TaskDoc) => void;
  onQuick: (t: TaskDoc) => void;
  onStatus: (t: TaskDoc, s: TaskStatus) => void;
}

const SortableCard = memo(function SortableCard({ task, seq, listView, actions }: { task: TaskDoc; seq: number; listView: boolean; actions: CardActions }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const handleProps = useMemo(() => ({ ...attributes, ...listeners }), [attributes, listeners]);
  return (
    <TaskCard
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      task={task}
      seq={seq}
      dragging={isDragging}
      onEdit={actions.onOpen}
      onDelete={actions.onDelete}
      onQuickAction={actions.onQuick}
      onStatusChange={listView ? actions.onStatus : undefined}
      handleRef={setActivatorNodeRef}
      handleProps={handleProps}
    />
  );
});

function Column({
  status,
  ids,
  byId,
  seqById,
  actions,
  onAdd,
}: {
  status: TaskStatus;
  ids: string[];
  byId: Map<string, TaskDoc>;
  seqById: Map<string, number>;
  actions: CardActions;
  onAdd: (s: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` });
  return (
    <section
      aria-label={STATUS_LABEL[status]}
      data-testid={`column-${status}`}
      className={cn("min-w-[82%] shrink-0 snap-start rounded-panel bg-surface-muted p-3 transition-colors sm:min-w-[320px] lg:min-w-0", isOver && "bg-surface-hover")}
    >
      <ColumnHeader
        title={STATUS_LABEL[status]}
        count={ids.length}
        accent={ACCENT[status]}
        right={
          <button
            type="button"
            aria-label={`Add task to ${STATUS_LABEL[status]}`}
            title={`Add to ${STATUS_LABEL[status]}`}
            onClick={() => onAdd(status)}
            className="-mr-2 grid h-10 w-10 place-items-center rounded-full text-ink-2 transition hover:bg-surface-muted hover:text-ink"
          >
            <Plus size={18} strokeWidth={1.75} />
          </button>
        }
      />
      <div ref={setNodeRef} className="mt-3 min-h-[120px] space-y-3">
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((id) => {
            const t = byId.get(id);
            return t ? <SortableCard key={id} task={t} seq={seqById.get(id) ?? 0} listView={false} actions={actions} /> : null;
          })}
        </SortableContext>
        {ids.length === 0 && <p className="px-2 py-8 text-center text-xs text-ink-3">Drop a task here</p>}
      </div>
    </section>
  );
}

export function TaskBoard({ tasks, view, seqById, onOpen, onDelete, onAddInColumn }: Props) {
  const { db } = useData();
  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const viewRef = useRef(view);
  viewRef.current = view;

  // Stable callbacks so memoized cards do not re-render when something unrelated changes.
  const actions = useMemo<CardActions>(
    () => ({
      onOpen,
      onDelete,
      onQuick: (t) => {
        const next = QUICK_ACTION[t.status].next;
        if (viewRef.current === "list") {
          void updateTask(db, t.id, { status: next });
          return;
        }
        // Board: the card lands at the end of its new column (and of the day's list).
        void updateTask(db, t.id, { status: next, orderIndex: orderAtEnd(tasksRef.current.filter((x) => x.id !== t.id)) });
      },
      onStatus: (t, s) => void updateTask(db, t.id, { status: s }),
    }),
    [db, onOpen, onDelete],
  );
  const baseCols = useMemo<Columns>(() => {
    const c: Columns = { notStarted: [], started: [], completed: [] };
    for (const t of tasks) c[t.status].push(t.id);
    return c;
  }, [tasks]);
  const [dragCols, setDragCols] = useState<Columns | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const cols = dragCols ?? baseCols;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findColumn = (id: string, c: Columns): TaskStatus | null => {
    if (id.startsWith("col:")) return id.slice(4) as TaskStatus;
    return STATUS_ORDER.find((s) => c[s].includes(id)) ?? null;
  };

  function onDragStart(e: DragStartEvent): void {
    setActiveId(String(e.active.id));
    setDragCols(baseCols);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(10);
  }

  function onDragOver(e: DragOverEvent): void {
    if (view !== "board" || !e.over) return;
    const activeKey = String(e.active.id);
    const overKey = String(e.over.id);
    setDragCols((cur) => {
      const c = cur ?? baseCols;
      const from = findColumn(activeKey, c);
      const to = findColumn(overKey, c);
      if (!from || !to || from === to) return cur;
      const target = c[to];
      const overIndex = overKey.startsWith("col:") ? target.length : target.indexOf(overKey);
      const at = overIndex < 0 ? target.length : overIndex;
      return {
        ...c,
        [from]: c[from].filter((id) => id !== activeKey),
        [to]: [...target.slice(0, at), activeKey, ...target.slice(at)],
      };
    });
  }

  function onDragEnd(e: DragEndEvent): void {
    const id = String(e.active.id);
    const preview = dragCols ?? baseCols;
    setActiveId(null);
    setDragCols(null);
    if (!e.over) return;
    const overKey = String(e.over.id);

    if (view === "list") {
      const order = tasks.map((t) => t.id);
      const from = order.indexOf(id);
      const to = overKey.startsWith("col:") ? order.length - 1 : order.indexOf(overKey);
      if (from < 0 || to < 0 || from === to) return;
      void moveTask(db, id, tasks, to);
      return;
    }

    const status = STATUS_ORDER.find((s) => preview[s].includes(id));
    if (!status) return;
    const list = [...preview[status]];
    // same-column reorder: dnd-kit only updates the preview on over, so apply the final over position here
    const current = byId.get(id);
    if (current && current.status === status && overKey !== id && !overKey.startsWith("col:")) {
      const from = list.indexOf(id);
      const to = list.indexOf(overKey);
      if (from >= 0 && to >= 0) {
        list.splice(from, 1);
        list.splice(to, 0, id);
      }
    }
    const index = list.indexOf(id);
    const siblings = (baseCols[status] ?? []).map((sid) => byId.get(sid)).filter((t): t is TaskDoc => !!t);
    const changedStatus = current && current.status !== status;
    const sameSpot = !changedStatus && baseCols[status].indexOf(id) === index;
    if (sameSpot) return;
    void moveTask(db, id, siblings, index, changedStatus ? status : undefined);
  }

  const active = activeId ? byId.get(activeId) : undefined;
  const overlay = active ? <TaskCard task={active} seq={seqById.get(active.id) ?? 0} overlay /> : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setDragCols(null);
      }}
    >
      {view === "board" ? (
        <div className="scroll-hidden -mx-1 flex snap-x snap-mandatory gap-5 overflow-x-auto px-1 pb-2 lg:grid lg:grid-cols-3 lg:overflow-visible">
          {STATUS_ORDER.map((s) => (
            <Column key={s} status={s} ids={cols[s]} byId={byId} seqById={seqById} actions={actions} onAdd={onAddInColumn} />
          ))}
        </div>
      ) : (
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="w-full space-y-3" data-testid="task-list">
            {tasks.map((t) => (
              <SortableCard key={t.id} task={t} seq={seqById.get(t.id) ?? 0} listView actions={actions} />
            ))}
          </div>
        </SortableContext>
      )}
      <DragOverlay dropAnimation={{ duration: 180 }}>{overlay}</DragOverlay>
    </DndContext>
  );
}
