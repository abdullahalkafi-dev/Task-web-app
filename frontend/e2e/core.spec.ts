import { expect, test, type Page } from "@playwright/test";
import { ADMIN, addTask, apiLogin, createUser, uiLogin } from "./helpers";

const dhakaKey = (ms: number): string => new Date(ms).toLocaleDateString("sv", { timeZone: "Asia/Dhaka" });

async function titles(page: Page): Promise<string[]> {
  return page.getByTestId("task-card").locator("h4").allTextContents();
}

test("tasks: create with 1h 30m, change status, reorder by drag (survives reload), delete", async ({ page, request }) => {
  await page.setViewportSize({ width: 1280, height: 1500 }); // keep every card on screen for the mouse drag
  const creds = await createUser(request);
  await uiLogin(page, creds);
  await expect(page.getByTestId("empty-day")).toBeVisible();

  await page.getByTestId("add-task").click();
  await page.getByLabel("Task title").fill("Alpha");
  await page.getByLabel("Hours").fill("1");
  await page.getByLabel("Minutes").fill("30");
  await page.getByRole("tab", { name: "Started", exact: true }).click();
  await page.getByRole("button", { name: "Save task" }).click();
  const alpha = page.getByTestId("task-card").filter({ hasText: "Alpha" });
  await expect(alpha).toContainText("1h 30m");
  await expect(page.getByTestId("column-started")).toContainText("Alpha");
  await expect(page.getByTestId("planned-time")).toContainText("1h 30m");

  await addTask(page, "Bravo");
  await addTask(page, "Charlie");

  // status via the chip dropdown
  await page.getByRole("button", { name: "Start: Bravo" }).click();
  await expect(page.getByTestId("column-started")).toContainText("Bravo");
  await page.getByRole("button", { name: "Complete: Bravo" }).click();
  await expect(page.getByTestId("column-completed")).toContainText("Bravo");

  // list view + drag Charlie above Alpha
  await page.getByRole("tab", { name: "List" }).click();
  await expect.poll(() => titles(page)).toEqual(["Alpha", "Charlie", "Bravo"]); // Bravo moved to the end when completed
  const handle = page.getByRole("button", { name: "Drag to reorder: Charlie" });
  const target = page.getByTestId("task-card").filter({ hasText: "Alpha" });
  const h = (await handle.boundingBox())!;
  const t = (await target.boundingBox())!;
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2, h.y - 20, { steps: 5 });
  await page.mouse.move(t.x + t.width / 2, t.y + 10, { steps: 15 });
  await page.mouse.up();
  await expect.poll(() => titles(page)).toEqual(["Charlie", "Alpha", "Bravo"]);

  await page.reload();
  await page.getByRole("tab", { name: "List" }).click();
  await expect.poll(() => titles(page)).toEqual(["Charlie", "Alpha", "Bravo"]);

  // delete asks for confirmation
  await page.getByRole("button", { name: "Delete Bravo" }).click();
  await expect(page.getByText("Delete this task? This can't be undone.")).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect.poll(() => titles(page)).toEqual(["Charlie", "Alpha"]);
});

test("board: column + preselects the status; Start / Complete / Reopen move the card", async ({ page, request }) => {
  const creds = await createUser(request);
  await uiLogin(page, creds);
  await page.getByTestId("add-task").click();
  await page.getByLabel("Task title").fill("First");
  await page.getByRole("button", { name: "Save task" }).click();
  await expect(page.getByTestId("column-notStarted")).toContainText("First");
  await expect(page.getByTestId("task-card").filter({ hasText: "First" })).toContainText("No estimate");

  await page.getByRole("button", { name: "Add task to Completed" }).click();
  await expect(page.getByRole("tab", { name: "Completed" })).toHaveAttribute("aria-selected", "true");
  await page.getByLabel("Task title").fill("Already done");
  await page.getByLabel("Hours").fill("0");
  await page.getByLabel("Minutes").fill("45");
  await page.getByRole("button", { name: "Save task" }).click();
  const done = page.getByTestId("column-completed").getByTestId("task-card").filter({ hasText: "Already done" });
  await expect(done).toContainText("45m");

  await page.getByRole("button", { name: "Reopen: Already done" }).click();
  await expect(page.getByTestId("column-started")).toContainText("Already done");
  await page.getByRole("button", { name: "Complete: Already done" }).click();
  await expect(page.getByTestId("column-completed")).toContainText("Already done");

  // edit via the pencil, keep the card in place
  await page.getByRole("button", { name: "Edit First" }).click();
  await page.getByLabel("Task title").fill("First (renamed)");
  await page.getByRole("button", { name: "Save task" }).click();
  await expect(page.getByTestId("column-notStarted")).toContainText("First (renamed)");
});

test("notes: create, edit, Dhaka timestamps, reorder persists, delete", async ({ page, request }) => {
  const creds = await createUser(request);
  await uiLogin(page, creds);

  await page.getByRole("button", { name: "New note" }).click();
  await page.getByLabel("Note title").fill("First note");
  await page.locator(".ProseMirror").click();
  await page.keyboard.type("Hello world");
  await expect(page.getByTestId("save-indicator")).toHaveText("Saved on this device", { timeout: 10_000 });
  await expect(page.getByTestId("note-meta")).toContainText(/Created \d{2} \w{3} \d{4}, \d{2}:\d{2} (AM|PM) · Last updated/);
  await page.getByRole("button", { name: "Back to Today" }).click();

  await page.getByRole("button", { name: "New note" }).click();
  await page.getByLabel("Note title").fill("Second note");
  await expect(page.getByTestId("save-indicator")).toHaveText("Saved on this device", { timeout: 10_000 });
  await page.getByRole("button", { name: "Back to Today" }).click();
  await expect(page.getByTestId("notes-count")).toHaveText("2");
  const rowTitles = () => page.getByTestId("note-row").locator("button.min-w-0 span.truncate:first-child").allTextContents();
  await expect.poll(rowTitles).toEqual(["Second note", "First note"]);

  // search filters by title
  await page.getByPlaceholder("Search notes…").fill("first");
  await expect(page.getByTestId("note-row")).toHaveCount(1);
  await page.getByPlaceholder("Search notes…").fill("");

  // reorder with the keyboard sensor
  await page.getByRole("button", { name: "Drag to reorder First note" }).focus();
  await page.keyboard.press("Space");
  await page.waitForTimeout(250);
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(250);
  await page.keyboard.press("Space");
  await expect.poll(rowTitles).toEqual(["First note", "Second note"]);
  await page.reload();
  await expect.poll(rowTitles).toEqual(["First note", "Second note"]);

  // delete from the editor menu
  await page.getByTestId("note-row").filter({ hasText: "Second note" }).locator("button.min-w-0").click();
  await page.getByRole("button", { name: "Note actions" }).click();
  await page.getByRole("menuitem", { name: "Delete note" }).click();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByTestId("notes-count")).toHaveText("1");
});

test("history: calendar dot, read-only card, Copy to Today leaves the original untouched", async ({ page, request }) => {
  const creds = await createUser(request);
  const { token } = await apiLogin(request, creds);
  const yesterday = dhakaKey(Date.now() - 86_400_000);
  const stamp = new Date().toISOString();
  const id = crypto.randomUUID();
  const res = await request.post("/api/sync/push", {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      changes: [
        {
          entity: "task",
          op: "upsert",
          doc: {
            id,
            taskDate: yesterday,
            title: "Yesterday's report",
            descriptionHtml: "<p>Some <strong>details</strong></p>",
            estimatedMinutes: 45,
            status: "completed",
            orderIndex: 1024,
            copiedFromDate: null,
            copiedFromTaskId: null,
            createdAt: stamp,
            updatedAt: stamp,
            deletedAt: null,
          },
        },
      ],
    },
  });
  expect(res.ok()).toBeTruthy();

  await uiLogin(page, creds);
  await expect(page.getByTestId("empty-day")).toBeVisible(); // yesterday's tasks never carry over
  await page.getByRole("link", { name: "History" }).click();
  if (yesterday.slice(0, 7) !== dhakaKey(Date.now()).slice(0, 7)) await page.getByRole("button", { name: "Previous month" }).click();
  const day = page.locator(`button[data-date="${yesterday}"]`);
  await expect(day).toHaveAccessibleName(/has tasks/);
  await expect(page.locator(`button[data-date="${dhakaKey(Date.now())}"]`)).toBeDisabled(); // today lives on Home
  await day.click();
  const card = page.getByTestId("history-task");
  await expect(card).toContainText("Yesterday's report");
  await card.getByRole("button", { name: "Show details" }).click();
  await expect(card.locator(".rich strong")).toHaveText("details");
  await card.getByRole("button", { name: "Copy to Today" }).click();
  await expect(page.getByText("Copied to today ✓")).toBeVisible();
  await expect(card.getByRole("button", { name: "Copied ✓" })).toBeVisible();
  await expect(card).toContainText("Completed"); // original unchanged

  await page.getByRole("link", { name: "Home" }).click();
  const copy = page.getByTestId("task-card").filter({ hasText: "Yesterday's report" });
  await expect(copy).toContainText("From");
  await expect(page.getByTestId("column-notStarted")).toContainText("Yesterday's report");
});

test("auth: Google sign-in; only superadmins get User Management and its numbers", async ({ page, request, browser }) => {
  const creds = await createUser(request);
  await uiLogin(page, creds);
  await expect(page.getByRole("link", { name: "User management" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Change password" })).toHaveCount(0);
  await addTask(page, "Counted task");
  await page.goto("/users");
  await expect(page).toHaveURL(/\/$/); // regular users are sent home

  const session = await apiLogin(request, creds);
  const forbidden = await request.get("/api/users/stats", { headers: { Authorization: `Bearer ${session.token}` } });
  expect(forbidden.status()).toBe(403);
  expect((await request.post("/api/auth/login", { data: {} })).status()).toBe(404);

  // admin UI: counts only
  const adminPage = await browser.newPage();
  await uiLogin(adminPage, ADMIN);
  await adminPage.getByRole("link", { name: "User management" }).click();
  await expect(adminPage.getByRole("heading", { name: "User Management" })).toBeVisible();
  const row = adminPage.getByTestId("user-row").filter({ hasText: creds.email });
  await expect(row).toContainText("Last login");
  await expect(row).toContainText("Tasks");
  await expect(adminPage.getByText("Counted task")).toHaveCount(0);
  await adminPage.close();
});

test("midnight rollover: the board flips to the new Dhaka day without a reload", async ({ page, request }) => {
  const creds = await createUser(request);
  // 23:59:45 in Dhaka on 20 Oct 2026 (= 17:59:45 UTC)
  await page.clock.install({ time: new Date("2026-10-20T17:59:45Z") });
  await uiLogin(page, creds);
  await expect(page.getByTestId("today-date")).toContainText("20 October");
  await addTask(page, "Before midnight");
  await page.clock.runFor(45_000); // -> 00:00:30 on 21 Oct (Dhaka)
  await expect(page.getByTestId("today-date")).toContainText("21 October");
  await expect(page.getByTestId("empty-day")).toBeVisible();
  await expect(page.getByText("Before midnight")).toHaveCount(0);
});
