"use client";
import { useEffect, useState } from "react";
import { Maximize2, Minimize2, Minus, Pin, Settings } from "lucide-react";
import type { DesktopState } from "@/lib/desktop-contract";
import { Dialog } from "../ui/Dialog";
import { Button, IconButton } from "../ui/Button";
import { useData } from "@/hooks/useData";
import { getMeta } from "@/lib/db";

export function DesktopToolbar({ state }: { state: DesktopState }) {
  const [open, setOpen] = useState(false);
  const [shortcut, setShortcut] = useState(state.shortcut);
  const [error, setError] = useState<string | null>(null);
  const [offlineReady, setOfflineReady] = useState(false);
  const { db } = useData();
  useEffect(() => {
    if (!open || !("serviceWorker" in navigator) || !("caches" in window)) return;
    let active = true;
    void Promise.all([navigator.serviceWorker.ready, getMeta<string>(db, "lastSyncedAt")]).then(async ([registration, synced]) => {
      const cached = await caches.match("/", { ignoreSearch: true });
      if (active) setOfflineReady(Boolean(registration.active && synced && cached));
    }).catch(() => undefined);
    return () => { active = false; };
  }, [open, db]);
  const update = async (value: Parameters<NonNullable<Window["dayflowDesktop"]>["settings"]>[0]) => {
    try { await window.dayflowDesktop?.settings(value); setError(null); } catch (e) { setError(e instanceof Error ? e.message : "Could not change settings"); }
  };
  const action = async (name: "expand" | "compact" | "collapse") => {
    try { await window.dayflowDesktop?.[name](); } catch (e) { setError(e instanceof Error ? e.message : "Please wait for local saving to finish"); }
  };
  return <>
    <div className="flex items-center gap-1 border-b border-line bg-surface px-3 py-1" aria-label="Desktop controls">
      <span className="mr-auto text-sm font-semibold">Dayflow <span className="ml-1 font-normal text-ink-3">{state.mode === "compact" ? "Quick view" : "Workspace"}</span></span>
      {state.mode === "compact" && <IconButton label={state.pinned ? "Unpin panel" : "Keep panel on top"} onClick={() => void update({ pinned: !state.pinned })}><Pin size={16} fill={state.pinned ? "currentColor" : "none"} /></IconButton>}
      <IconButton label="Desktop settings" onClick={() => { setShortcut(state.shortcut); setOpen(true); }}><Settings size={16} /></IconButton>
      <IconButton label={state.mode === "compact" ? "Expand workspace" : "Compact panel"} onClick={() => void action(state.mode === "compact" ? "expand" : "compact")}>{state.mode === "compact" ? <Maximize2 size={16} /> : <Minimize2 size={16} />}</IconButton>
      <IconButton label="Collapse to bubble" onClick={() => void action("collapse")}><Minus size={16} /></IconButton>
    </div>
    {error && <p role="alert" className="bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <Dialog open={open} onClose={() => setOpen(false)} title="Desktop settings">
      <div className="space-y-5 py-2">
        <label className="flex items-center gap-3"><input type="checkbox" checked={state.startAtLogin} onChange={(e) => void update({ startAtLogin: e.target.checked })} />Start with Windows</label>
        <label className="flex items-center gap-3"><input type="checkbox" checked={state.bubbleVisible} onChange={(e) => void update({ bubbleVisible: e.target.checked })} />Show floating bubble when collapsed</label>
        <label className="block text-sm">Global shortcut<input className="mt-2 w-full rounded-input border border-line bg-surface-muted p-3" value={shortcut} onChange={(e) => setShortcut(e.target.value)} placeholder="Control+Alt+D" /></label>
        <Button onClick={() => void update({ shortcut })}>Save shortcut</Button>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <p className="text-sm text-ink-3">Closing the window keeps Dayflow in the tray. To exit completely, choose Quit Dayflow from the tray menu.</p>
        <p role="status" className="text-sm text-ink-3">{offlineReady ? "Offline setup is ready. Previously loaded tasks and notes are available without internet." : "Offline setup needs an online sync and a cached interface. Keep Dayflow online to finish setup."}</p>
      </div>
    </Dialog>
  </>;
}
