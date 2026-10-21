import { readFileSync, writeFileSync, renameSync } from "node:fs";
import type { Bounds } from "./policy";
export interface Preferences {
  pinned: boolean; startAtLogin: boolean; shortcut: string; bubbleVisible: boolean;
  bubble?: Bounds; expanded?: Bounds; initialized: boolean;
}
export const defaults: Preferences = { pinned: true, startAtLogin: false, shortcut: "Control+Alt+D", bubbleVisible: true, initialized: false };
export function readPreferences(file: string): Preferences {
  try {
    const p: unknown = JSON.parse(readFileSync(file, "utf8"));
    if (!p || typeof p !== "object") return { ...defaults };
    const v = p as Partial<Preferences>;
    const result = { ...defaults };
    for (const key of ["pinned", "startAtLogin", "bubbleVisible", "initialized"] as const) if (typeof v[key] === "boolean") result[key] = v[key];
    if (typeof v.shortcut === "string" && v.shortcut.length < 100) result.shortcut = v.shortcut;
    for (const key of ["bubble", "expanded"] as const) {
      const b = v[key];
      if (b && [b.x, b.y, b.width, b.height].every(Number.isFinite) && b.width > 0 && b.height > 0) result[key] = b;
    }
    return result;
  } catch { return { ...defaults }; }
}
export function savePreferences(file: string, preferences: Preferences): void {
  writeFileSync(`${file}.tmp`, JSON.stringify(preferences, null, 2));
  renameSync(`${file}.tmp`, file);
}
