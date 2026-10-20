"use client";

import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { getUserDb, type DayflowDB } from "@/lib/db";
import { useAuth } from "./useAuth";
import { SyncEngine } from "@/lib/sync";

interface DataValue {
  db: DayflowDB;
  engine: SyncEngine;
  userId: string;
}

const DataContext = createContext<DataValue | null>(null);

/** Opens the per-user Dexie DB and runs the sync engine for as long as the user is signed in. */
export function DataProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const value = useMemo<DataValue>(() => {
    const db = getUserDb(userId);
    return { db, engine: new SyncEngine(db, userId), userId };
  }, [userId]);

  useEffect(() => {
    value.engine.start();
    return () => value.engine.stop();
  }, [value]);

  // A fresh token (after signing in again) lets a previously rejected engine resume.
  const { token } = useAuth();
  useEffect(() => {
    value.engine.clearUnauthorized();
  }, [token, value]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

/** Like useData, but returns null outside a DataProvider (e.g. the /dev/ui page). */
export function useOptionalData(): DataValue | null {
  return useContext(DataContext);
}

export function useData(): DataValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside <DataProvider>");
  return ctx;
}
