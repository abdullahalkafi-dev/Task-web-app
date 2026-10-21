import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, nativeImage, screen, shell, Tray } from "electron";
import type { IpcMainInvokeEvent, IpcMainEvent } from "electron";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { cancelSignIn, startSignIn } from "./auth";
import { fitBounds, resolveOrigin, safeExternal, trustedPage } from "./policy";
import { readPreferences, savePreferences } from "./preferences";
import type { Preferences } from "./preferences";
import type { DesktopState } from "../../frontend/src/lib/desktop-contract";

app.setAppUserModelId("com.dayflow.desktop");
const profileOverride = app.commandLine.getSwitchValue("user-data-dir") || (!app.isPackaged ? process.env.DAYFLOW_USER_DATA : undefined);
if (profileOverride) app.setPath("userData", path.resolve(profileOverride));
const origin = resolveOrigin(app.isPackaged, process.env.DAYFLOW_DEV_URL);
const assets = path.join(__dirname, "../assets");
let workspace: BrowserWindow;
let bubble: BrowserWindow;
let tray: Tray;
let preferences: Preferences;
let file: string;
let mode: DesktopState["mode"] = "compact";
let quitting = false;
let ready = false;
let flushing: Promise<void> | null = null;
const flushes = new Map<string, (ok: boolean) => void>();
const save = (): void => savePreferences(file, preferences);
const state = (): DesktopState => ({ version: 1, mode, pinned: preferences.pinned, shortcut: preferences.shortcut, startAtLogin: preferences.startAtLogin, bubbleVisible: preferences.bubbleVisible });
function sendState(): void {
  if (workspace && !workspace.isDestroyed()) workspace.webContents.send("desktop:state", state());
  if (tray) tray.setContextMenu(trayMenu());
}
function trusted(event: IpcMainInvokeEvent | IpcMainEvent): boolean {
  return event.sender === workspace?.webContents && event.senderFrame === workspace.webContents.mainFrame && trustedPage(event.senderFrame.url, origin);
}
async function flush(): Promise<void> {
  if (!ready || !trustedPage(workspace.webContents.getURL(), origin)) return;
  if (flushing) return flushing;
  flushing = new Promise<void>((resolve, reject) => {
    const id = randomUUID();
    const timer = setTimeout(() => { flushes.delete(id); reject(new Error("Local saving did not finish. Keep Dayflow open and try again.")); }, 8000);
    flushes.set(id, (ok) => { clearTimeout(timer); flushes.delete(id); if (ok) resolve(); else reject(new Error("Local saving failed. Please keep Dayflow open and try again.")); });
    workspace.webContents.send("desktop:flush", id);
  });
  try { await flushing; } finally { flushing = null; }
}
function showBubble(): void { if (preferences.bubbleVisible) bubble.showInactive(); }
async function collapse(): Promise<void> { await flush(); workspace.hide(); showBubble(); }
function areaForBubble(): Electron.Rectangle { return screen.getDisplayMatching(bubble.getBounds()).workArea; }
function snapBubble(): void {
  const b = bubble.getBounds(); const area = areaForBubble();
  const x = b.x + b.width / 2 < area.x + area.width / 2 ? area.x + 8 : area.x + area.width - b.width - 8;
  bubble.setBounds(fitBounds({ ...b, x }, area)); preferences.bubble = bubble.getBounds(); save();
}
function showWorkspace(): void {
  bubble.hide();
  if (mode === "compact") {
    const b = bubble.getBounds(); const area = areaForBubble();
    const right = b.x + b.width + 8;
    workspace.setBounds(fitBounds({ x: right + 440 <= area.x + area.width ? right : b.x - 448, y: b.y - 250, width: 440, height: 640 }, area));
  }
  workspace.setAlwaysOnTop(mode === "compact" && preferences.pinned);
  if (workspace.isMinimized()) workspace.restore();
  workspace.show(); workspace.focus(); sendState();
}
async function changeMode(next: DesktopState["mode"]): Promise<void> {
  await flush();
  if (next === "compact" && mode === "expanded" && !workspace.isMaximized() && !workspace.isFullScreen()) preferences.expanded = workspace.getBounds();
  mode = next;
  if (workspace.isFullScreen()) workspace.setFullScreen(false);
  if (workspace.isMaximized()) workspace.unmaximize();
  if (next === "expanded") {
    const area = screen.getDisplayMatching(workspace.getBounds()).workArea;
    workspace.setBounds(fitBounds(preferences.expanded ?? { x: area.x + 60, y: area.y + 40, width: 1100, height: 800 }, area));
  }
  save(); showWorkspace();
}
function report(error: unknown): void { void dialog.showMessageBox(workspace, { type: "error", title: "Dayflow", message: error instanceof Error ? error.message : "Something went wrong. Please try again." }); }
async function quit(): Promise<void> {
  try { await flush(); cancelSignIn(); save(); quitting = true; app.quit(); } catch (error) { showWorkspace(); report(error); }
}
function trayMenu(): Electron.Menu {
  return Menu.buildFromTemplate([
    { label: "Open Dayflow", click: showWorkspace },
    { label: "Expand workspace", click: () => { void changeMode("expanded").catch(report); } },
    { label: "Compact panel", click: () => { void changeMode("compact").catch(report); } },
    { type: "separator" },
    { label: "Show floating bubble", type: "checkbox", checked: preferences.bubbleVisible, click: (item) => { preferences.bubbleVisible = item.checked; if (!item.checked) bubble.hide(); else if (!workspace.isVisible()) showBubble(); save(); sendState(); } },
    { label: "Start with Windows", type: "checkbox", checked: preferences.startAtLogin, click: (item) => { preferences.startAtLogin = item.checked; app.setLoginItemSettings({ openAtLogin: item.checked }); save(); sendState(); } },
    { label: `Shortcut: ${preferences.shortcut}`, enabled: false },
    { type: "separator" },
    { label: "Quit Dayflow", click: () => { void quit(); } },
  ]);
}
function registerShortcut(value: string): boolean {
  try { return globalShortcut.register(value, () => { if (workspace.isVisible()) void collapse().catch(report); else showWorkspace(); }); } catch { return false; }
}
function installIpc(): void {
  const handle = (channel: string, fn: (value: unknown) => unknown): void => {
    ipcMain.handle(channel, (event, value: unknown) => { if (!trusted(event)) throw new Error("Untrusted desktop request"); return fn(value); });
  };
  handle("desktop:state", () => { ready = true; return state(); });
  handle("desktop:expand", () => changeMode("expanded"));
  handle("desktop:compact", () => changeMode("compact"));
  handle("desktop:collapse", collapse);
  handle("desktop:signin", () => startSignIn(origin, (value) => { workspace.webContents.send("desktop:session", value); showWorkspace(); }, (message) => workspace.webContents.send("desktop:auth-error", message)));
  handle("desktop:cancel-signin", cancelSignIn);
  handle("desktop:settings", (value) => {
    if (!value || typeof value !== "object") throw new Error("Invalid settings");
    const v = value as Record<string, unknown>;
    for (const key of Object.keys(v)) if (!["shortcut", "pinned", "startAtLogin", "bubbleVisible"].includes(key)) throw new Error("Unknown setting");
    for (const key of ["pinned", "startAtLogin", "bubbleVisible"] as const) if (v[key] !== undefined && typeof v[key] !== "boolean") throw new Error("Invalid setting");
    if (v.shortcut !== undefined) {
      if (typeof v.shortcut !== "string" || v.shortcut.length > 80 || !/(Control|Alt|Shift|Super|Command)/.test(v.shortcut)) throw new Error("Use a shortcut with a modifier, such as Control+Alt+D");
      if (v.shortcut !== preferences.shortcut) {
        if (!registerShortcut(v.shortcut)) throw new Error("This shortcut is unavailable. Choose a different shortcut.");
        globalShortcut.unregister(preferences.shortcut); preferences.shortcut = v.shortcut;
      }
    }
    for (const key of ["pinned", "startAtLogin", "bubbleVisible"] as const) if (typeof v[key] === "boolean") preferences[key] = v[key];
    if (v.startAtLogin !== undefined) app.setLoginItemSettings({ openAtLogin: preferences.startAtLogin });
    workspace.setAlwaysOnTop(mode === "compact" && preferences.pinned);
    if (!preferences.bubbleVisible) bubble.hide(); else if (!workspace.isVisible()) showBubble();
    save(); sendState(); return state();
  });
  ipcMain.on("desktop:flushed", (event, id: unknown, ok: unknown) => { if (trusted(event) && typeof id === "string" && typeof ok === "boolean") flushes.get(id)?.(ok); });
  const isBubble = (e: IpcMainEvent): boolean => e.sender === bubble?.webContents && e.senderFrame === bubble.webContents.mainFrame;
  ipcMain.on("bubble:open", (event) => { if (isBubble(event)) showWorkspace(); });
  ipcMain.on("bubble:menu", (event) => { if (isBubble(event)) trayMenu().popup({ window: bubble }); });
  ipcMain.on("bubble:move", (event, x: unknown, y: unknown) => {
    if (!isBubble(event) || typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 2000 || Math.abs(y) > 2000) return;
    const b = bubble.getBounds(); bubble.setPosition(Math.round(b.x + x), Math.round(b.y + y));
  });
  ipcMain.on("bubble:snap", (event) => { if (isBubble(event)) snapBubble(); });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => { if (workspace) showWorkspace(); });
  void app.whenReady().then(async () => {
    file = path.join(app.getPath("userData"), "preferences.json"); preferences = readPreferences(file);
    const first = !preferences.initialized;
    const icon = nativeImage.createFromPath(path.join(assets, "icon.png"));
    workspace = new BrowserWindow({ width: 440, height: 640, minWidth: 360, minHeight: 420, show: false, title: "Dayflow", icon, backgroundColor: "#eeeeee", webPreferences: { preload: path.join(__dirname, "preload.js"), partition: "persist:dayflow", sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
    bubble = new BrowserWindow({ width: 64, height: 64, show: false, frame: false, transparent: true, resizable: false, skipTaskbar: true, alwaysOnTop: true, hasShadow: false, webPreferences: { preload: path.join(__dirname, "bubble-preload.js"), sandbox: true, contextIsolation: true, nodeIntegration: false } });
    const area = screen.getPrimaryDisplay().workArea;
    bubble.setBounds(fitBounds(preferences.bubble ?? { x: area.x + area.width - 80, y: area.y + area.height / 2, width: 64, height: 64 }, area));
    bubble.setFocusable(false);
    const session = workspace.webContents.session;
    session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    session.setPermissionCheckHandler(() => false);
    session.on("will-download", (event) => event.preventDefault());
    workspace.webContents.setWindowOpenHandler(({ url }) => { if (safeExternal(url)) void shell.openExternal(url); return { action: "deny" }; });
    const navigation = (event: Electron.Event, url: string): void => { if (!trustedPage(url, origin)) { event.preventDefault(); if (safeExternal(url)) void shell.openExternal(url); } };
    workspace.webContents.on("will-navigate", navigation);
    workspace.webContents.on("will-redirect", navigation);
    workspace.webContents.on("will-attach-webview", (event) => event.preventDefault());
    bubble.webContents.on("will-navigate", (event) => event.preventDefault());
    bubble.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    workspace.webContents.on("did-start-navigation", (_event, _url, inPlace, mainFrame) => { if (mainFrame && !inPlace) ready = false; });
    workspace.webContents.on("did-fail-load", (_event, code, _description, url, mainFrame) => { if (mainFrame && code !== -3 && trustedPage(url, origin)) void workspace.loadFile(path.join(assets, "offline.html")); });
    workspace.on("close", (event) => { if (!quitting) { event.preventDefault(); void collapse().catch(report); } });
    workspace.on("maximize", () => { mode = "expanded"; workspace.setAlwaysOnTop(false); sendState(); });
    workspace.on("enter-full-screen", () => { mode = "expanded"; workspace.setAlwaysOnTop(false); sendState(); });
    workspace.on("resized", () => { if (mode === "expanded" && !workspace.isMaximized() && !workspace.isFullScreen()) { preferences.expanded = workspace.getBounds(); save(); } });
    const relocate = (): void => { bubble.setBounds(fitBounds(bubble.getBounds(), screen.getDisplayMatching(bubble.getBounds()).workArea)); workspace.setBounds(fitBounds(workspace.getBounds(), screen.getDisplayMatching(workspace.getBounds()).workArea)); };
    screen.on("display-removed", relocate); screen.on("display-metrics-changed", relocate);
    installIpc();
    tray = new Tray(icon.resize({ width: 20, height: 20 })); tray.setToolTip("Dayflow"); tray.on("click", showWorkspace); tray.setContextMenu(trayMenu());
    if (!registerShortcut(preferences.shortcut)) void dialog.showMessageBox({ type: "info", message: "Dayflow’s shortcut is already in use. You can change it in desktop settings; the bubble and tray still work." });
    await bubble.loadFile(path.join(assets, "bubble.html"));
    await workspace.loadURL(origin).catch(() => undefined);
    preferences.initialized = true; save();
    if (first) showWorkspace(); else showBubble();
  }).catch((error: unknown) => { dialog.showErrorBox("Dayflow could not start", error instanceof Error ? error.message : "Unexpected startup error"); quitting = true; app.quit(); });
  app.on("before-quit", (event) => { if (!quitting && workspace && !workspace.isDestroyed()) { event.preventDefault(); void quit(); } });
  app.on("will-quit", () => { globalShortcut.unregisterAll(); cancelSignIn(); });
  app.on("window-all-closed", () => { /* Tray owns application lifetime. */ });
}
