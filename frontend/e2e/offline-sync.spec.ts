import { expect, test } from "@playwright/test";
import { addTask, apiLogin, createUser, uiLogin } from "./helpers";

test("offline → online: changes made offline sync automatically and reach a second device", async ({ browser, request }) => {
  const creds = await createUser(request);
  const context = await browser.newContext();
  const page = await context.newPage();
  await uiLogin(page, creds);

  const pill = page.getByTestId("sync-pill").first();
  await expect(pill).toHaveAttribute("data-state", "synced");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  // go offline: create + edit tasks and a note, nothing may be lost
  await context.setOffline(true);
  await expect(pill).toHaveAttribute("data-state", "offline");
  await addTask(page, "Offline task A");
  await addTask(page, "Offline task B");
  await expect(pill).toContainText("pending");
  await expect(page.getByText("You’re offline —")).toBeVisible();

  // come back online: Offline → Syncing → Synced
  await context.setOffline(false);
  await expect(pill).toHaveAttribute("data-state", "synced", { timeout: 30_000 });
  await expect(pill).not.toContainText("pending");

  // the server has both tasks
  const { token } = await apiLogin(request, creds);
  const pull = await request.get("/api/sync/pull", { headers: { Authorization: `Bearer ${token}` } });
  const titles = ((await pull.json()) as { tasks: { title: string }[] }).tasks.map((t) => t.title).sort();
  expect(titles).toEqual(["Offline task A", "Offline task B"]);

  // a second device (fresh browser profile) sees them after signing in
  const device2 = await (await browser.newContext()).newPage();
  await uiLogin(device2, creds);
  await expect(device2.getByTestId("task-card").filter({ hasText: "Offline task A" })).toBeVisible({ timeout: 30_000 });
  await expect(device2.getByTestId("task-card").filter({ hasText: "Offline task B" })).toBeVisible();
});

test("changes survive closing the browser while offline", async ({ browser, request }) => {
  const creds = await createUser(request);
  const context = await browser.newContext();
  const page = await context.newPage();
  await uiLogin(page, creds);
  await expect(page.getByTestId("sync-pill").first()).toHaveAttribute("data-state", "synced");
  // Complete the first online shell installation before cutting the network.
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });

  await context.setOffline(true);
  await addTask(page, "Written offline");
  // reload while offline: the app opens from the service worker + cached session
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect(page.getByTestId("task-card").filter({ hasText: "Written offline" })).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByTestId("sync-pill").first()).toHaveAttribute("data-state", "synced", { timeout: 30_000 });
  const { token } = await apiLogin(request, creds);
  await expect.poll(async () => {
    const pull = await request.get("/api/sync/pull", { headers: { Authorization: `Bearer ${token}` } });
    return ((await pull.json()) as { tasks: { title: string }[] }).tasks.map((t) => t.title);
  }, { timeout: 30_000 }).toContain("Written offline");
});
