import { expect, test, type Page } from "@playwright/test";
import { addTask, createUser, uiLogin } from "./helpers";

const WIDTHS = [360, 768, 1024, 1440, 1920];

async function noHorizontalScroll(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth && document.body.scrollWidth <= window.innerWidth);
}

test("no horizontal page scroll at 360 / 768 / 1024 / 1440 / 1920", async ({ page, request }) => {
  const creds = await createUser(request);
  await page.setViewportSize({ width: 1440, height: 900 });
  await uiLogin(page, creds);
  await addTask(page, "A reasonably long task title that should wrap nicely on narrow screens without causing overflow");
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByTestId("today-date")).toBeVisible();
    expect(await noHorizontalScroll(page), `home @${width}`).toBe(true);
    await page.goto("/history");
    await expect(page.getByTestId("calendar")).toBeVisible();
    expect(await noHorizontalScroll(page), `history @${width}`).toBe(true);
  }
});

test("layout adapts: rail + sidebar on desktop, drawer on tablet, bottom tabs on mobile", async ({ page, request }) => {
  const creds = await createUser(request);
  await page.setViewportSize({ width: 1440, height: 900 });
  await uiLogin(page, creds);
  await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
  await expect(page.getByRole("complementary", { name: "Notes" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();

  await page.setViewportSize({ width: 900, height: 900 }); // tablet: notes sidebar becomes a drawer
  await expect(page.getByRole("complementary", { name: "Notes" })).toBeHidden();
  await page.getByRole("button", { name: "Open notes" }).click();
  await expect(page.getByRole("dialog", { name: "Notes" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.setViewportSize({ width: 390, height: 800 }); // mobile
  await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
  const tabs = page.getByRole("navigation", { name: "Primary" });
  await expect(tabs).toBeVisible();
  await expect(page.getByRole("tab", { name: "List" })).toHaveAttribute("aria-selected", "true"); // default view on mobile
  await tabs.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByLabel("Task title")).toBeVisible();
});
