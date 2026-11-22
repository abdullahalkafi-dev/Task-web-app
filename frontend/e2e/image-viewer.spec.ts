import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createRequire } from "node:module";
import path from "node:path";
import { apiLogin, createUser, uiLogin } from "./helpers";

test("images open full screen, can be marked up, and earlier versions stay viewable", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const require = createRequire(path.resolve("../backend/package.json"));
  const sharp = require("sharp") as (options: unknown) => {
    png(): { toBuffer(): Promise<Buffer> };
  };
  const png = await sharp({
    create: {
      width: 600,
      height: 400,
      channels: 3,
      background: { r: 40, g: 120, b: 200 },
    },
  })
    .png()
    .toBuffer();

  const creds = await createUser(request, "viewer");
  await uiLogin(page, creds);
  await page.getByRole("button", { name: "New note" }).click();
  await expect(page.getByTestId("note-editor")).toBeVisible();
  await page
    .getByTestId("editor-image-input")
    .setInputFiles({ name: "shot.png", mimeType: "image/png", buffer: png });
  const image = page.locator(".ProseMirror img").first();
  await expect(image).toBeVisible();
  const originalSrc = (await image.getAttribute("src"))!;
  expect(originalSrc).toMatch(/^\/uploads\/[\w-]+\/[\w-]+\.webp$/);
  await expect(page.getByTestId("save-indicator")).toHaveText(
    "Saved on this device",
    { timeout: 10_000 },
  );

  // Click opens the full-screen viewer with download and mark up; no versions yet.
  await image.click();
  const viewer = page.getByRole("dialog", { name: "Image viewer" });
  await expect(viewer).toBeVisible();
  await expect(viewer.getByRole("link", { name: "Download image" })).toHaveAttribute(
    "href",
    originalSrc,
  );
  await expect(viewer.getByRole("group", { name: "Image versions" })).toHaveCount(0);
  const results = await new AxeBuilder({ page })
    .include('[data-testid="image-viewer"]')
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);

  // Mark up: draw a stroke and save.
  await viewer.getByRole("button", { name: "Mark up" }).click();
  const markup = page.getByTestId("image-markup");
  const canvas = markup.locator("canvas");
  await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width)).toBe(600);
  await expect(markup.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, { steps: 8 });
  await page.mouse.up();
  await markup.getByRole("button", { name: "Arrow" }).click();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5, { steps: 6 });
  await page.mouse.up();
  await markup.getByRole("button", { name: "Save", exact: true }).click();

  // Back in the viewer: the edited image is shown and the original is kept as a version.
  const versions = viewer.getByRole("group", { name: "Image versions" });
  await expect(versions).toBeVisible();
  await expect(versions.getByRole("button")).toHaveCount(2);
  await viewer.getByRole("button", { name: "Close image viewer" }).click();
  await expect(viewer).toHaveCount(0);

  // The description now points at the edited image; the original is hidden from it.
  await expect(page.getByTestId("save-indicator")).toHaveText(
    "Saved on this device",
    { timeout: 10_000 },
  );
  const editedSrc = (await page.locator(".ProseMirror img").first().getAttribute("src"))!;
  expect(editedSrc).not.toBe(originalSrc);
  await expect(page.locator(".ProseMirror img")).toHaveCount(1);

  // Survives a reload; the gallery shows both and the original can be viewed and downloaded.
  await page.reload();
  await page.locator(".ProseMirror img").first().click();
  await expect(viewer).toBeVisible();
  const gallery = viewer.getByRole("group", { name: "Image versions" });
  await expect(gallery.getByRole("button")).toHaveCount(2);
  await gallery.getByRole("button", { name: /Show Original version/ }).click();
  await expect(viewer.locator("img[alt='Full-size image']")).toHaveAttribute(
    "src",
    originalSrc,
  );
  await expect(viewer.getByRole("link", { name: "Download image" })).toHaveAttribute(
    "href",
    originalSrc,
  );
  // An older version is view/download only.
  await expect(viewer.getByRole("button", { name: "Mark up" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
});

test("team task images can be marked up and the original stays in the team's versions", async ({
  page,
  request,
}) => {
  test.setTimeout(120000);
  const require = createRequire(path.resolve("../backend/package.json"));
  const sharp = require("sharp") as (options: unknown) => {
    png(): { toBuffer(): Promise<Buffer> };
  };
  const png = await sharp({
    create: { width: 500, height: 300, channels: 3, background: { r: 200, g: 90, b: 40 } },
  })
    .png()
    .toBuffer();
  const creds = await createUser(request, "teamviewer");
  const session = await apiLogin(request, creds);
  const headers = { Authorization: `Bearer ${session.token}` };
  const team = (
    await (
      await request.post("/api/teams", { headers, data: { name: "Shots" } })
    ).json()
  ).team as { id: string };
  const uploaded = await (
    await request.post(`/api/teams/${team.id}/uploads`, {
      headers,
      multipart: { file: { name: "a.png", mimeType: "image/png", buffer: png } },
    })
  ).json();
  const originalUrl = uploaded.url as string;
  const created = await request.post(`/api/teams/${team.id}/tasks`, {
    headers,
    data: {
      title: "Check the screenshot",
      descriptionHtml: `<p>See below</p><img src="${originalUrl}">`,
      status: "todo",
      assigneeId: null,
    },
  });
  expect(created.ok()).toBeTruthy();
  const task = (await created.json()).task as { id: string };

  await uiLogin(page, creds);
  await page.goto(`/teams/${team.id}`);
  await page.getByRole("button", { name: "Check the screenshot", exact: true }).click();
  await page.locator(".ProseMirror img").first().click();
  const viewer = page.getByRole("dialog", { name: "Image viewer" });
  await viewer.getByRole("button", { name: "Mark up" }).click();
  const canvas = page.getByTestId("image-markup").locator("canvas");
  await expect.poll(() => canvas.evaluate((c: HTMLCanvasElement) => c.width)).toBe(500);
  const box = (await canvas.boundingBox())!;
  await page.getByRole("button", { name: "Rectangle" }).click();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.7, { steps: 6 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(viewer.getByRole("group", { name: "Image versions" })).toBeVisible();
  await viewer.getByRole("button", { name: "Close image viewer" }).click();
  await page.getByRole("button", { name: "Save task" }).click();
  await expect(page.getByRole("button", { name: "Save task" })).toHaveCount(0);

  const saved = (
    await (await request.get(`/api/teams/${team.id}/tasks/${task.id}`, { headers })).json()
  ).task as { descriptionHtml: string };
  expect(saved.descriptionHtml).not.toContain(originalUrl);
  const editedUrl = /src="(\/uploads\/teams\/[^"]+)"/.exec(saved.descriptionHtml)![1];
  const versions = (
    await (
      await request.get(
        `/api/teams/${team.id}/uploads/${editedUrl.split("/").pop()}/versions`,
        { headers },
      )
    ).json()
  ).versions as { url: string }[];
  expect(versions.map((v) => v.url)).toEqual([editedUrl, originalUrl]);
  // The original file is still served to the team.
  expect((await request.get(originalUrl, { headers })).status()).toBe(200);
});
