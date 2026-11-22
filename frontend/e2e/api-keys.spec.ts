import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createUser, uiLogin } from "./helpers";

const bearer = (secret: string) => ({ Authorization: `Bearer ${secret}` });

function taskPush(title: string) {
  const now = new Date().toISOString();
  const taskDate = new Date(Date.now() + 6 * 3_600_000).toISOString().slice(0, 10); // Asia/Dhaka day
  return {
    changes: [
      {
        entity: "task",
        op: "upsert",
        doc: {
          id: randomUUID(),
          taskDate,
          title,
          descriptionHtml: "",
          estimatedMinutes: 0,
          status: "notStarted",
          orderIndex: 1,
          copiedFromDate: null,
          copiedFromTaskId: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      },
    ],
  };
}

test("api keys: create, read-only vs write, rotate, delete", async ({ page, request, browser }) => {
  const creds = await createUser(request, "keys");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await uiLogin(page, creds);

  await page.getByRole("button", { name: "API keys" }).click();
  const dialog = page.getByRole("dialog", { name: "API keys" });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(500); // let the open animation finish

  await dialog.getByLabel("New key name").fill("E2E agent");
  await dialog.getByRole("button", { name: "Create key" }).click();
  const secretBox = dialog.getByTestId("api-key-secret");
  await expect(secretBox).toBeVisible();
  await expect(dialog).toContainText("This is the only time you will see this key");
  await expect(dialog.getByRole("link", { name: "Read the API guide" }).first()).toHaveAttribute("href", "/api-docs");
  const secret = (await secretBox.innerText()).trim();
  expect(secret.length).toBeGreaterThan(16);

  const accessibility = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(accessibility.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);

  const toggle = dialog.getByRole("switch", { name: "Allow changes for E2E agent" });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(dialog).toContainText("Never used");

  // Read-only key: reads work, writes are refused.
  const me = await request.get("/api/agent/me", { headers: bearer(secret) });
  expect(me.ok()).toBeTruthy();
  expect(((await me.json()) as { auth: { mode: string } }).auth.mode).toBe("read");
  const refused = await request.post("/api/sync/push", { headers: bearer(secret), data: taskPush("Blocked") });
  expect(refused.status()).toBe(403);
  expect(JSON.stringify(await refused.json())).toContain("KEY_READ_ONLY");

  // Allow changes in the UI, then the same write succeeds.
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await expect
    .poll(async () => {
      const res = await request.get("/api/agent/me", { headers: bearer(secret) });
      return ((await res.json()) as { auth: { mode: string } }).auth.mode;
    })
    .toBe("write");
  const allowed = await request.post("/api/sync/push", { headers: bearer(secret), data: taskPush("Allowed") });
  expect(allowed.ok()).toBeTruthy();

  // Rotate: the new secret replaces the old one.
  await dialog.getByRole("button", { name: "Rotate E2E agent" }).click();
  await expect(secretBox).not.toHaveText(secret);
  const rotated = (await secretBox.innerText()).trim();
  expect(rotated).not.toBe(secret);
  expect((await request.get("/api/agent/me", { headers: bearer(secret) })).status()).toBe(401);
  expect((await request.get("/api/agent/me", { headers: bearer(rotated) })).ok()).toBeTruthy();

  // Delete: the rotated secret stops working.
  await dialog.getByRole("button", { name: "Delete E2E agent" }).click();
  await page.getByRole("dialog", { name: "Delete key" }).getByRole("button", { name: "Delete", exact: true }).click();
  await expect(dialog.getByRole("list", { name: "Your API keys" })).toHaveCount(0);
  expect((await request.get("/api/agent/me", { headers: bearer(rotated) })).status()).toBe(401);

  // The guide is public.
  const fresh = await browser.newContext();
  const guide = await fresh.newPage();
  await guide.goto("/api-docs");
  await expect(guide.getByRole("heading", { name: "Dayflow API guide", exact: true })).toBeVisible();
  await expect(guide.getByRole("button", { name: "Copy as text" })).toBeEnabled();
  await fresh.close();
});
