"use client";

import { useLiveQuery } from "dexie-react-hooks";
import type { TaskDoc } from "@/lib/types";
import { useData } from "./useData";

/** Live, ordered, non-deleted tasks for one Dhaka day (read from IndexedDB). `undefined` while loading. */
export function useTasks(date: string): TaskDoc[] | undefined {
  const { db, userId } = useData();
  return useLiveQuery(async () => {
    const rows = await db.tasks.where("[userId+taskDate]").equals([userId, date]).toArray();
    return rows.filter((t) => !t.deletedAt).sort((a, b) => a.orderIndex - b.orderIndex);
  }, [db, userId, date]);
}

/** Days of a month (YYYY-MM) that have at least one task, from IndexedDB. */
export function useTaskDates(month: string): Set<string> | undefined {
  const { db, userId } = useData();
  return useLiveQuery(async () => {
    const rows = await db.tasks.where("userId").equals(userId).filter((t) => !t.deletedAt && t.taskDate.startsWith(month)).toArray();
    return new Set(rows.map((t) => t.taskDate));
  }, [db, userId, month]);
}
