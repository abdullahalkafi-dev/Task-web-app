"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Search } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useData } from "@/hooks/useData";
import { useNotes } from "@/hooks/useNotes";
import { createNote, moveNote } from "@/lib/repo";
import { relativeFromNow } from "@/lib/time";
import { displayName, type NoteDoc } from "@/lib/types";
import { SidebarHeader } from "../layout/SidebarHeader";
import { cn } from "../ui/cn";
import { ProfileCard } from "../ui/ProfileCard";
import { Skeleton } from "../ui/Skeleton";

function useMinuteTick(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function NoteRow({ note, active, now, draggable, onSelect }: { note: NoteDoc; active: boolean; now: number; draggable: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: note.id, disabled: !draggable });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid="note-row"
      className={cn(
        "group flex items-center gap-1 rounded-2xl transition-colors",
        active ? "bg-surface-muted" : "hover:bg-surface-muted/60",
        isDragging && "z-10 scale-[1.02] bg-surface shadow-drag",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Drag to reorder ${note.title}`}
        disabled={!draggable}
        className="grid h-11 w-8 shrink-0 cursor-grab place-items-center text-ink-3 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 disabled:hidden [@media(hover:none)]:opacity-100"
        {...attributes}
        {...listeners}
      >
        <GripVertical size={16} strokeWidth={1.75} />
      </button>
      <button type="button" onClick={onSelect} aria-current={active ? "true" : undefined} className="min-h-[52px] min-w-0 flex-1 py-2 pr-3 text-left">
        <span className="block truncate text-[15px] font-medium text-ink">{note.title || "Untitled note"}</span>
        <span className="block truncate text-xs text-ink-3">Updated {relativeFromNow(note.updatedAt, now)}</span>
      </button>
    </li>
  );
}

/** Notes list: header + count badge, title quick-find, drag-reorder, and the profile card. */
export function NotesSidebar({
  activeId,
  onSelect,
  showHeader = false,
}: {
  activeId: string | null;
  onSelect: (id: string) => void;
  showHeader?: boolean;
}) {
  const { db, userId } = useData();
  const { user } = useAuth();
  const notes = useNotes();
  const now = useMinuteTick();
  const [query, setQuery] = useState("");
  const filtering = query.trim().length > 0;

  const visible = useMemo(() => {
    if (!notes) return [];
    const q = query.trim().toLowerCase();
    return q ? notes.filter((n) => n.title.toLowerCase().includes(q)) : notes;
  }, [notes, query]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e: DragEndEvent): void {
    if (!notes || !e.over || e.active.id === e.over.id) return;
    const to = notes.findIndex((n) => n.id === e.over?.id);
    if (to < 0) return;
    void moveNote(db, String(e.active.id), notes, to);
  }

  async function add(): Promise<void> {
    const n = await createNote(db, userId);
    onSelect(n.id);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 rounded-panel bg-surface p-4 shadow-sm2">
      {showHeader && <SidebarHeader />}

      <label className="relative block">
        <span className="sr-only">Search notes by title</span>
        <Search size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search notes…"
          className="h-11 w-full rounded-input bg-surface-muted pl-10 pr-3 text-sm text-ink outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-accent-blue/30"
        />
      </label>

      <div className="flex items-center gap-2 px-1">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-3">Notes</h2>
        <span className="grid h-5 min-w-5 place-items-center rounded-md bg-accent-teal px-1.5 text-[11px] font-semibold text-white" data-testid="notes-count">
          {notes?.length ?? 0}
        </span>
        <button
          type="button"
          onClick={() => void add()}
          aria-label="New note"
          title="New note"
          className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-surface-muted text-ink transition hover:bg-surface-hover active:scale-95"
        >
          <Plus size={18} strokeWidth={2} />
        </button>
      </div>

      <div className="scroll-hidden -mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {!notes ? (
          <div className="space-y-2">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : visible.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-ink-3">{filtering ? "No notes match." : "No notes yet. Tap + to write one."}</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={visible.map((n) => n.id)} strategy={verticalListSortingStrategy}>
              <ul className="space-y-1">
                {visible.map((n) => (
                  <NoteRow key={n.id} note={n} active={n.id === activeId} now={now} draggable={!filtering} onSelect={() => onSelect(n.id)} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}
      </div>

      <ProfileCard
        name={displayName(user)}
        subtitle={user?.role === "superadmin" ? "Super Admin" : (user?.email ?? "Member")}
      />
    </div>
  );
}
