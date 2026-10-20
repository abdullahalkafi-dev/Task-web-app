"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, EllipsisVertical, Trash2 } from "lucide-react";
import { useData } from "@/hooks/useData";
import { useNote } from "@/hooks/useNotes";
import { deleteNote, updateNote } from "@/lib/repo";
import { formatDhaka } from "@/lib/time";
import type { NoteDoc } from "@/lib/types";
import { RichTextEditor } from "../editor/RichTextEditor";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Menu } from "../ui/Menu";
import { Skeleton } from "../ui/Skeleton";
import { useToast } from "../ui/Toast";

type SaveState = "saved" | "saving";

function NoteEditor({ note, onBack }: { note: NoteDoc; onBack: () => void }) {
  const { db } = useData();
  const toast = useToast();
  const [title, setTitle] = useState(note.title);
  const [html, setHtml] = useState(note.descriptionHtml);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pending = useRef<{ title: string; html: string } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    await updateNote(db, note.id, { title: p.title, descriptionHtml: p.html });
    setSaveState(pending.current ? "saving" : "saved");
  }, [db, note.id]);

  const queue = useCallback(
    (next: { title: string; html: string }) => {
      pending.current = next;
      setSaveState("saving");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 800); // 800ms debounce autosave
    },
    [flush],
  );

  // Never lose the last keystrokes when navigating away.
  useEffect(() => {
    return () => {
      if (pending.current) {
        const p = pending.current;
        pending.current = null;
        void updateNote(db, note.id, { title: p.title, descriptionHtml: p.html });
      }
      if (timer.current) clearTimeout(timer.current);
    };
  }, [db, note.id]);

  return (
    <div className="flex min-h-full flex-col rounded-panel bg-surface p-4 shadow-sm2 md:p-8" data-testid="note-editor">
      <div className="mb-4 flex items-center gap-2">
        <Button variant="soft" size="sm" icon={<ArrowLeft size={16} />} onClick={() => void flush().then(onBack)}>
          Back to Today
        </Button>
        <span aria-live="polite" data-testid="save-indicator" className="ml-auto text-xs text-ink-3">
          {saveState === "saving" ? "Saving…" : "Saved"}
        </span>
        <Menu
          label="Note actions"
          items={[{ label: "Delete note", icon: <Trash2 size={16} />, danger: true, onSelect: () => setConfirmDelete(true) }]}
          trigger={({ toggle, ref }) => (
            <button ref={ref} type="button" aria-label="Note actions" onClick={toggle} className="grid h-11 w-11 place-items-center rounded-full text-ink-2 transition hover:bg-surface-muted">
              <EllipsisVertical size={20} strokeWidth={1.75} />
            </button>
          )}
        />
      </div>

      <input
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          queue({ title: e.target.value, html });
        }}
        placeholder="Untitled note"
        aria-label="Note title"
        maxLength={300}
        className="w-full border-0 bg-transparent text-3xl font-bold tracking-tight text-ink outline-none placeholder:text-ink-3"
      />
      <p className="mb-5 mt-2 text-[13px] text-ink-3" data-testid="note-meta">
        Created {formatDhaka(note.createdAt)} · Last updated {formatDhaka(note.updatedAt)}
      </p>

      <RichTextEditor
        value={html}
        onChange={(h) => {
          setHtml(h);
          queue({ title, html: h });
        }}
        entity="note"
        entityId={note.id}
        placeholder="Start writing…"
        minHeight={320}
        className="flex-1"
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this note?"
        message="Delete this note? This can't be undone."
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          pending.current = null;
          void deleteNote(db, note.id).then(() => {
            toast.show("Note deleted");
            onBack();
          });
        }}
      />
    </div>
  );
}

export function NoteEditorPanel({ id, onBack }: { id: string; onBack: () => void }) {
  const note = useNote(id);
  if (note === undefined) return <Skeleton className="h-[60vh]" />;
  if (note === null) {
    return (
      <div className="grid place-items-center rounded-panel bg-surface p-12 text-center shadow-sm2">
        <p className="mb-4 text-ink-2">This note no longer exists.</p>
        <Button variant="soft" icon={<ArrowLeft size={16} />} onClick={onBack}>
          Back to Today
        </Button>
      </div>
    );
  }
  return <NoteEditor key={note.id} note={note} onBack={onBack} />;
}
