import { expect, test, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { apiLogin, createUser, uiLogin } from "./helpers";

async function paste(editor: Locator, text: string, html = "") {
  await editor.evaluate(
    (el, data) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData("text/plain", data.text);
      if (data.html) clipboardData.setData("text/html", data.html);
      el.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData,
          bubbles: true,
          cancelable: true,
        }),
      );
    },
    { text, html },
  );
}
const markdown = `| Timeline | What we’ll work on | What you’ll receive |
| --- | --- | --- |
| **Month 1 — Design & Foundation** | Finalize the launch features, complete UI/UX design within the first 2–3 weeks, and start mobile and backend development. | Approved Figma design and an early demo of the core app flow. |
| **Month 2 — Core Development** | Develop voice rooms, profiles, chat, gifts, wallet, and the admin panel. | A working app build to review and provide feedback. |
| **Month 3 — Integration & Testing** | Complete the agreed game/event integrations and remaining launch features. Use the final two weeks for focused testing and fixes. | A tested version for your final review before launch. |
| **Month 4 — Launch & Stabilization** | Submit the app to the agreed app stores, roll out production, complete the marketing landing page, and address initial feedback. | Public launch, subject to store approval, followed by monitoring and fixes. |
| **After Launch — Ongoing Improvements** | Prioritize improvements and additional features based on user feedback under the ongoing support plan. | Regular updates based on agreed priorities. |`;

test("Markdown table paste survives note autosave, offline edits, sync and responsive themes", async ({
  page,
  request,
}, testInfo) => {
  const creds = await createUser(request, "table-note");
  const session = await apiLogin(request, creds);
  await uiLogin(page, creds);
  await page.getByRole("button", { name: "New note" }).click();
  await page.getByLabel("Note title").fill("Launch timeline");
  const editor = page.locator(".ProseMirror");
  await editor.click();
  await paste(editor, markdown);
  await expect(editor.locator("tr")).toHaveCount(6);
  await expect(editor.locator("th")).toHaveCount(3);
  await expect(editor.locator("strong").first()).toHaveText(
    "Month 1 — Design & Foundation",
  );
  // One undo removes the paste; redo restores it.
  await page.keyboard.press("Control+z");
  await expect(editor.locator("table")).toHaveCount(0);
  await page.keyboard.press("Control+Shift+z");
  await expect(editor.locator("tr")).toHaveCount(6);
  await expect
    .poll(async () => {
      const body = await (
        await request.get("/api/sync/pull", {
          headers: { Authorization: `Bearer ${session.token}` },
        })
      ).json();
      return body.notes[0]?.descriptionHtml;
    })
    .toContain("<table>");
  for (const width of [360, 768, 1440])
    for (const dark of [false, true]) {
      await page.setViewportSize({ width, height: 900 });
      await page.evaluate(
        (value) =>
          document.documentElement.setAttribute(
            "data-theme",
            value ? "dark" : "light",
          ),
        dark,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      if (width === 360) {
        expect(
          await editor
            .locator("th")
            .first()
            .evaluate((el) => el.getBoundingClientRect().width),
        ).toBeGreaterThanOrEqual(170);
        expect(
          await editor
            .locator(".tableWrapper")
            .evaluate((el) => el.scrollWidth > el.clientWidth),
        ).toBe(true);
      }
      await page.screenshot({
        path: testInfo.outputPath(
          `table-${width}-${dark ? "dark" : "light"}.png`,
        ),
      });
    }
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        failure: n.failureSummary,
      })),
    })),
  ).toEqual([]);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.context().setOffline(true);
  await editor.locator("td").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" offline edit");
  await expect(page.getByTestId("save-indicator")).toHaveText(
    "Saved on this device",
  );
  await page.reload();
  await expect(editor.locator("table")).toBeVisible();
  await expect(editor).toContainText("offline edit");
  await page.context().setOffline(false);
  await expect
    .poll(
      async () => {
        const body = await (
          await request.get("/api/sync/pull", {
            headers: { Authorization: `Bearer ${session.token}` },
          })
        ).json();
        return body.notes[0]?.descriptionHtml;
      },
      { timeout: 30000 },
    )
    .toContain("offline edit");
  await page.reload();
  await expect(editor.locator("tr")).toHaveCount(6);
});

test("HTML task tables, cell paste, table actions, literal paste and oversized fallback", async ({
  page,
  request,
}) => {
  const creds = await createUser(request, "table-task");
  await uiLogin(page, creds);
  await page.getByTestId("add-task").click();
  await page.getByLabel("Task title").fill("Table task");
  const editor = page.locator(".ProseMirror");
  await editor.click();
  await paste(
    editor,
    "Heading A B",
    '<p>Before</p><table style="width:99999px"><tr><th>A</th><th>B</th></tr><tr><td><strong>One</strong></td><td>Two</td></tr></table><p>After</p>',
  );
  await expect(editor.locator("tr")).toHaveCount(2);
  await expect(editor).toContainText("Before");
  await expect(editor).toContainText("After");
  await editor.locator("td").first().click();
  await page
    .getByRole("button", { name: "Table actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Add row below", exact: true })
    .click();
  await expect(editor.locator("tr")).toHaveCount(3);
  await paste(editor, "X\tY\nZ\tW");
  await expect(editor.locator("table table")).toHaveCount(0);
  await expect(editor).toContainText("X");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  const card = page.getByTestId("task-card").filter({ hasText: "Table task" });
  await expect(card).toBeVisible();
  await expect(card.locator("table")).toHaveCount(0);
  await card.getByRole("button", { name: "Table task", exact: true }).click();
  await expect(editor.locator("table")).toBeVisible();
  await editor.press("Control+End");
  const before = await editor.innerHTML();
  await paste(editor, "a".repeat(500001));
  await expect(page.getByText(/This paste is too large/)).toBeVisible();
  expect(await editor.innerHTML()).toBe(before);
  await editor.press("Control+Shift+V");
  await paste(editor, "| Literal | Text |\n| --- | --- |\n| A | B |");
  await expect(editor.locator("table")).toHaveCount(1);
  await expect(editor).toContainText("| Literal | Text |");
});

test("team task tables persist through the API and reopen", async ({
  page,
  request,
}) => {
  const creds = await createUser(request, "table-team");
  const session = await apiLogin(request, creds);
  const response = await request.post("/api/teams", {
    headers: { Authorization: `Bearer ${session.token}` },
    data: { name: "Table team" },
  });
  const { team } = await response.json();
  await uiLogin(page, creds);
  await page.goto(`/teams/${team.id}`);
  await page
    .getByRole("button", { name: "Add task", exact: true })
    .first()
    .click();
  await page.getByLabel("Task title").fill("Team timeline");
  const editor = page.locator(".ProseMirror");
  await editor.click();
  await paste(editor, markdown);
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  const card = page
    .getByTestId("task-card")
    .filter({ hasText: "Team timeline" });
  await card
    .getByRole("button", { name: "Team timeline", exact: true })
    .click();
  await expect(editor.locator("tr")).toHaveCount(6);
  await editor.locator("td").first().click();
  await page.keyboard.press("End");
  await page.keyboard.type(" updated");
  await page.getByRole("button", { name: "Save task", exact: true }).click();
  await page.reload();
  await card
    .getByRole("button", { name: "Team timeline", exact: true })
    .click();
  await expect(editor).toContainText("updated");
  await expect(editor.locator("tr")).toHaveCount(6);
});

test("empty tables survive saving and column-limit actions leave existing contents intact", async ({
  page,
  request,
}) => {
  const creds = await createUser(request, "table-empty");
  const session = await apiLogin(request, creds);
  await uiLogin(page, creds);
  await page.getByRole("button", { name: "New note" }).click();
  const editor = page.locator(".ProseMirror");
  await editor.click();
  await page
    .getByRole("button", { name: "Table actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Insert table", exact: true })
    .click();
  await expect(editor.locator("tr")).toHaveCount(3);
  await expect
    .poll(async () => {
      const data = await (
        await request.get("/api/sync/pull", {
          headers: { Authorization: `Bearer ${session.token}` },
        })
      ).json();
      return data.notes[0]?.descriptionHtml;
    })
    .toContain("<table>");
  await page.reload();
  await expect(editor.locator("tr")).toHaveCount(3);
  await editor.press("Control+a");
  await paste(
    editor,
    "",
    `<table><tr>${"<th>Header</th>".repeat(40)}</tr><tr>${"<td>Preserved</td>".repeat(40)}</tr></table>`,
  );
  await expect(editor.locator("th")).toHaveCount(40);
  await editor.locator("th").first().click();
  const before = await editor.innerHTML();
  await page
    .getByRole("button", { name: "Table actions", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Add column after", exact: true })
    .click();
  await expect(page.getByText(/Table limit reached/)).toBeVisible();
  expect(await editor.innerHTML()).toBe(before);
});
