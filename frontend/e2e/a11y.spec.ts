import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { addTask, createUser, uiLogin } from "./helpers";

async function scan(page: Page, label: string): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(summary, `${label} accessibility violations`).toEqual([]);
}

for (const theme of ["light", "dark"] as const) {
  test(`accessibility: no WCAG A/AA violations (${theme})`, async ({ page, request }) => {
    const creds = await createUser(request);
    await page.addInitScript((t) => localStorage.setItem("dayflow-theme", t), theme);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await uiLogin(page, creds);
    await scan(page, "empty home");

    await addTask(page, "Plan the week");
    await addTask(page, "Ship the report");
    await page.getByRole("button", { name: "Start: Ship the report" }).click();
    await page.getByRole("button", { name: "Complete: Ship the report" }).click();
    await expect(page.getByTestId("column-completed")).toContainText("Ship the report");
    await scan(page, "home with tasks");

    await page.getByTestId("add-task").click();
    await page.waitForTimeout(500); // let the open animation finish
    await scan(page, "task editor dialog");
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "New note" }).click();
    await expect(page.getByTestId("note-editor")).toBeVisible();
    await scan(page, "note editor");

    await page.getByRole("link", { name: "History" }).click();
    await expect(page.getByTestId("calendar")).toBeVisible();
    await scan(page, "history");
  });
}
