import { _electron as electron, expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(path.join(process.cwd(), "package.json"));
const origin = "http://localhost:3100";
let app: ElectronApplication;
let profile: string;
let page: Page;
async function launch(): Promise<void> {
  const env: Record<string, string> = { DAYFLOW_DEV_URL: origin, DAYFLOW_USER_DATA: profile };
  for (const [key, value] of Object.entries(process.env)) if (value !== undefined && key !== "ELECTRON_RUN_AS_NODE") env[key] = value;
  delete env.ELECTRON_RUN_AS_NODE;
  app = await electron.launch({ executablePath: require("electron") as string, args: ["."], cwd: process.cwd(), env });
  await app.firstWindow();
  await expect.poll(() => app.windows().some((p) => p.url().startsWith(origin)), { timeout: 30_000 }).toBe(true);
  page = app.windows().find((p) => p.url().startsWith(origin))!;
  await page.waitForLoadState("domcontentloaded");
  await app.evaluate(({ shell }) => { shell.openExternal = async (url: string) => { (globalThis as typeof globalThis & { authUrl?: string }).authUrl = url; }; });
}
async function close(): Promise<void> {
  await app.evaluate(({ app }) => { app.exit(0); });
  await app.close().catch(() => undefined);
}
test.beforeEach(async () => { profile = await mkdtemp(path.join(os.tmpdir(), "dayflow-desktop-e2e-")); await launch(); });
test.afterEach(async () => { if (app) await close().catch(() => undefined); await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); });

test("native settings validation, shortcut conflicts, single instance, and renderer isolation", async () => {
  await expect(page.getByRole("button", { name: "Sign in with your browser" })).toBeVisible();
  await expect(page.evaluate(() => window.dayflowDesktop!.settings({ pinned: "yes" } as never))).rejects.toThrow("Invalid setting");
  await app.evaluate(({ globalShortcut }) => { globalShortcut.register("Control+Alt+Shift+F12", () => undefined); });
  const previous = await page.evaluate(() => window.dayflowDesktop!.getState());
  await expect(page.evaluate(() => window.dayflowDesktop!.settings({ shortcut: "Control+Alt+Shift+F12" }))).rejects.toThrow("unavailable");
  expect((await page.evaluate(() => window.dayflowDesktop!.getState())).shortcut).toBe(previous.shortcut);
  await app.evaluate(({ globalShortcut }) => { globalShortcut.unregister("Control+Alt+Shift+F12"); });
  await page.evaluate(() => window.dayflowDesktop!.collapse());
  await app.evaluate(({ app }) => { app.emit("second-instance", {}, [], process.cwd(), {}); });
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().startsWith("http://localhost"))?.isVisible())).toBe(true);
  const info = await page.evaluate(() => {
    const globals = window as unknown as { require?: unknown; process?: unknown };
    return { require: typeof globals.require, process: typeof globals.process, bridge: Object.keys(window.dayflowDesktop!) };
  });
  expect(info.require).toBe("undefined"); expect(info.process).toBe("undefined");
  expect(info.bridge).not.toContain("ipcRenderer");
});

test("browser handoff, live sync, bubble, retained drafts, isolation, and offline restart", async ({ browser, request }) => {
  await expect(page.getByRole("button", { name: "Sign in with your browser" })).toBeVisible();
  await page.getByRole("button", { name: "Sign in with your browser" }).click();
  await expect.poll(() => app.evaluate(() => (globalThis as typeof globalThis & { authUrl?: string }).authUrl)).toContain("desktop/connect");
  const url = await app.evaluate(() => (globalThis as typeof globalThis & { authUrl?: string }).authUrl!);
  const context = await browser.newContext();
  const browserPage = await context.newPage();
  await context.route("https://accounts.google.com/gsi/client", (route) => route.fulfill({ contentType: "text/javascript", body: `window.google={accounts:{id:{initialize(o){this.callback=o.callback},renderButton(el){const b=document.createElement('button');b.textContent='Continue with Google';b.onclick=()=>this.callback({credential:'e2e-credential:desktop-main:desktop-main@e2e.test'});el.appendChild(b)}}}};` }));
  await browserPage.goto(url);
  await browserPage.getByRole("link", { name: "Sign in with Google" }).click();
  await browserPage.getByRole("button", { name: "Continue with Google" }).click();
  await expect(browserPage.getByRole("button", { name: "Codes match — connect desktop" })).toBeVisible();
  await browserPage.getByRole("button", { name: "Codes match — connect desktop" }).click();
  await expect(page.getByTestId("today-date")).toBeVisible();
  await expect(page.locator('[data-desktop-mode="compact"]')).toBeVisible();
  // No Google UI is embedded in the Electron renderer.
  expect(await page.locator('script[src*="accounts.google.com"]').count()).toBe(0);
  await browserPage.goto(origin);
  // Immediate collapse must flush the draft, rather than waiting for its 1s autosave timer.
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task title").fill("Desktop draft survives");
  await page.evaluate(() => window.dayflowDesktop!.expand());
  await expect(page.getByLabel("Task title")).toHaveValue("Desktop draft survives");
  await page.evaluate(() => window.dayflowDesktop!.collapse());
  await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().includes("bubble.html"))?.isVisible())).toBe(true);
  const bubble = app.windows().find((p) => p.url().includes("bubble.html"))!;
  await bubble.getByRole("button", { name: "Open Dayflow" }).click();
  await expect(page.getByLabel("Task title")).toHaveValue("Desktop draft survives");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(browserPage.getByTestId("task-card").filter({ hasText: "Desktop draft survives" })).toBeVisible({ timeout: 8000 });
  await browserPage.getByRole("button", { name: "Start: Desktop draft survives" }).click();
  await browserPage.getByRole("button", { name: "Complete: Desktop draft survives" }).click();
  await expect(page.getByRole("button", { name: "Reopen: Desktop draft survives" })).toBeVisible({ timeout: 8000 });
  await browserPage.getByRole("button", { name: "New note" }).click();
  await browserPage.getByLabel("Note title").fill("Shared note");
  await browserPage.locator(".ProseMirror").fill("Note from the browser");
  await expect(browserPage.getByTestId("save-indicator")).toHaveText("Saved on this device");
  const noteUrl = browserPage.url();
  await page.goto(noteUrl);
  await expect(page.getByLabel("Note title")).toHaveValue("Shared note");
  await expect(page.locator(".ProseMirror")).toContainText("Note from the browser");
  await browserPage.getByLabel("Note title").fill("Updated shared note");
  await expect(page.getByLabel("Note title")).toHaveValue("Updated shared note", { timeout: 8000 });
  await page.getByLabel("Note title").fill("Desktop note flush");
  await page.evaluate(() => window.dayflowDesktop!.compact());
  await expect(browserPage.getByLabel("Note title")).toHaveValue("Desktop note flush", { timeout: 8000 });
  await page.getByTestId("editor-image-input").setInputFiles({ name: "pixel.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64") });
  await expect.poll(() => page.locator(".ProseMirror img").evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  await expect(browserPage.locator(".ProseMirror img")).toBeVisible({ timeout: 8000 });
  await page.getByRole("button", { name: "Back to Today" }).click();
  await browserPage.getByRole("button", { name: "Back to Today" }).click();
  // Fresh user/session must not receive another account's tasks.
  const other = await request.post("/api/auth/google", { data: { credential: "e2e-credential:desktop-other:desktop-other@e2e.test" } });
  const session = await other.json() as { token: string };
  const pull = await request.get("/api/sync/pull", { headers: { Authorization: `Bearer ${session.token}` } });
  expect((await pull.json() as { tasks: unknown[] }).tasks).toHaveLength(0);
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.evaluate(() => window.dayflowDesktop!.expand());
  await page.screenshot({ path: "test-results/desktop-expanded.png" });
  await page.evaluate(() => window.dayflowDesktop!.compact());
  await page.screenshot({ path: "test-results/desktop-compact.png" });
  const urlBefore = page.url();
  await page.evaluate(() => { window.location.href = "https://example.com/"; });
  await page.waitForTimeout(200);
  expect(page.url()).toBe(urlBefore);
  expect(await page.evaluate(() => typeof (window as unknown as { require?: unknown }).require)).toBe("undefined");
  await close();
  // Restart with the same persistent session, while requests to the hosted origin fail.
  await launch();
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByTestId("task-card").filter({ hasText: "Desktop draft survives" })).toBeVisible();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task title").fill("Offline desktop task");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await expect(page.getByTestId("task-card").filter({ hasText: "Offline desktop task" })).toBeVisible();
  await page.context().setOffline(false);
  await expect(browserPage.getByTestId("task-card").filter({ hasText: "Offline desktop task" })).toBeVisible({ timeout: 10000 });
  await context.close();
});
