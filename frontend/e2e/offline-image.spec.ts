import { expect, test } from "@playwright/test";
import { apiLogin, createUser, uiLogin } from "./helpers";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("an image added to a task while offline uploads on reconnect and the HTML is rewritten", async ({ browser, request }) => {
  const creds = await createUser(request);
  const context = await browser.newContext();
  const page = await context.newPage();
  await uiLogin(page, creds);
  const pill = page.getByTestId("sync-pill").first();
  await expect(pill).toHaveAttribute("data-state", "synced");

  await context.setOffline(true);
  await expect(pill).toHaveAttribute("data-state", "offline");
  await page.getByTestId("add-task").click();
  await page.getByLabel("Task title").fill("Task with photo");
  await page.getByTestId("editor-image-input").setInputFiles({ name: "red.png", mimeType: "image/png", buffer: PNG });
  const img = page.locator(".ProseMirror img").first();
  await expect(img).toBeVisible();
  expect(await img.getAttribute("src")).toMatch(/^blob:/);
  expect(await img.getAttribute("data-local-id")).toBeTruthy();
  await page.getByRole("button", { name: "Save task" }).click();
  await expect(page.getByTestId("task-card").filter({ hasText: "Task with photo" })).toBeVisible();

  await context.setOffline(false);
  await expect(pill).toHaveAttribute("data-state", "synced", { timeout: 30_000 });
  await expect(pill).not.toContainText("pending");

  const { token } = await apiLogin(request, creds);
  const pull = await request.get("/api/sync/pull", { headers: { Authorization: `Bearer ${token}` } });
  const task = ((await pull.json()) as { tasks: { title: string; descriptionHtml: string }[] }).tasks.find((t) => t.title === "Task with photo");
  expect(task?.descriptionHtml).toMatch(/<img[^>]+src="\/uploads\/[\w-]+\/[\w-]+\.webp"/);
  expect(task?.descriptionHtml).not.toContain("blob:");
});
