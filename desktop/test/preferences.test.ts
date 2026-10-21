import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, expect, it } from "vitest";
import { defaults, readPreferences, savePreferences } from "../src/preferences";
describe("persistent settings", () => {
  it("recovers corrupt preferences and rejects invalid values without losing valid fields", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "dayflow-settings-"));
    const file = path.join(directory, "preferences.json");
    try {
      writeFileSync(file, "not JSON"); expect(readPreferences(file)).toEqual(defaults);
      writeFileSync(file, JSON.stringify({ pinned: false, startAtLogin: "yes", expanded: { x: 0, y: 0, width: -1, height: 100 } }));
      const settings = readPreferences(file); expect(settings.pinned).toBe(false); expect(settings.startAtLogin).toBe(false); expect(settings.expanded).toBeUndefined();
      savePreferences(file, { ...settings, initialized: true });
      expect(JSON.parse(readFileSync(file, "utf8"))).toMatchObject({ initialized: true, pinned: false });
    } finally { rmSync(directory, { recursive: true, force: true }); }
  });
});
