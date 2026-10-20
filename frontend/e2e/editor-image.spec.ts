import { expect, test } from "@playwright/test";
import { apiLogin, createUser, uiLogin } from "./helpers";

// 1x1 red PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("an editor image loads through plain <img src> via the login cookie; others get 401/403", async ({ browser, request, playwright, baseURL }) => {
  const creds = await createUser(request);
  const other = await createUser(request, "other");
  const context = await browser.newContext();
  const page = await context.newPage();
  await uiLogin(page, creds);

  // create a note and add an image through the toolbar (online upload)
  await page.getByRole("button", { name: "New note" }).click();
  await expect(page.getByTestId("note-editor")).toBeVisible();
  await page.getByTestId("editor-image-input").setInputFiles({ name: "red.png", mimeType: "image/png", buffer: PNG });
  const img = page.locator(".ProseMirror img").first();
  await expect(img).toBeVisible();
  const src = await img.getAttribute("src");
  expect(src).toMatch(/^\/uploads\/[\w-]+\/[\w-]+\.webp$/);
  await expect(page.getByTestId("save-indicator")).toHaveText("Saved", { timeout: 10_000 });

  // reload: the image still renders (the httpOnly cookie authenticates the <img> request)
  await page.reload();
  const again = page.locator(".ProseMirror img").first();
  await expect(again).toBeVisible();
  await expect.poll(() => again.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);

  // logged out -> 401
  const clean = await playwright.request.newContext({ baseURL });
  const anon = await clean.get(src as string);
  expect(anon.status()).toBe(401);

  // another user's session -> 403
  const otherSession = await apiLogin(request, other);
  const foreign = await clean.get(src as string, { headers: { Authorization: `Bearer ${otherSession.token}` } });
  expect(foreign.status()).toBe(403);

  // CSRF: a cookie without the Authorization header cannot write
  const cookies = await context.cookies();
  const token = cookies.find((c) => c.name === "dayflow_token")?.value;
  expect(token).toBeTruthy();
  const csrf = await clean.post("/api/sync/push", {
    headers: { Cookie: `dayflow_token=${token}` },
    data: { changes: [] },
  });
  expect(csrf.status()).toBe(401);
});
