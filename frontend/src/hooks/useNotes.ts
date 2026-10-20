"use client";

import { useLiveQuery } from "dexie-react-hooks";
import type { NoteDoc } from "@/lib/types";
import { useData } from "./useData";

export function useNotes(): NoteDoc[] | undefined {
  const { db, userId } = useData();
  return useLiveQuery(async () => {
    const rows = await db.notes.where("userId").equals(userId).toArray();
    return rows.filter((n) => !n.deletedAt).sort((a, b) => a.orderIndex - b.orderIndex);
  }, [db, userId]);
}

export function useNote(id: string | null): NoteDoc | null | undefined {
  const { db } = useData();
  return useLiveQuery(async () => {
    if (!id) return null;
    const n = await db.notes.get(id);
    return n && !n.deletedAt ? n : null;
  }, [db, id]);
}
