import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { addTask, apiLogin, createUser, uiLogin } from "./helpers";
import type { TeamDetail, TeamTask } from "@dayflow/shared";
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const input = (title: string) => ({
  title,
  descriptionHtml: "<p>Details belong in the dialog.</p>",
  status: "todo",
  assigneeId: null,
  estimatedDays: 3,
});
async function createTeam(
  request: APIRequestContext,
  token: string,
  name = "Design team",
): Promise<TeamDetail> {
  const response = await request.post("/api/teams", {
    headers: auth(token),
    data: { name },
  });
  expect(response.ok()).toBeTruthy();
  return (await response.json()).team as TeamDetail;
}
async function assertFits(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= innerWidth &&
        document.body.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}
async function scan(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
}

test("teams: invite consent, assignment, live chat, conflict recovery, archive, restore and removal", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(180000);
  const owner = await createUser(request, "owner");
  const member = await createUser(request, "member");
  const session = await apiLogin(request, owner);
  const memberSession = await apiLogin(request, member);
  await uiLogin(page, owner);
  await addTask(page, "Personal task stays private");
  await page.getByRole("link", { name: "Teams", exact: true }).click();
  await page.getByRole("button", { name: "New team" }).click();
  await page.getByLabel("Team name").fill("Product team");
  await page.getByRole("button", { name: "Create team" }).click();
  await expect(
    page.getByRole("heading", { name: "Product team" }),
  ).toBeVisible();
  const teamId = page.url().split("/").pop()!;
  await expect(page.getByRole("complementary", { name: "Notes" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Members (1)" }).click();
  await page.getByLabel("Invite by email").fill(member.email);
  await page.getByRole("button", { name: "Send invitation" }).click();
  await expect(
    page.getByText("Invitation sent", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  expect(
    (
      await request.get(`/api/teams/${teamId}`, {
        headers: auth(memberSession.token),
      })
    ).status(),
  ).toBe(403);
  const memberContext = await browser.newContext();
  const other = await memberContext.newPage();
  try {
    await uiLogin(other, member);
    await other.goto("/teams");
    await expect(other.getByText(/invited you/)).toBeVisible();
    await other.getByRole("button", { name: "Accept", exact: true }).click();
    await other.getByRole("link", { name: /Product team/ }).click();
    await expect(
      other.getByRole("heading", { name: "Product team" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Add task", exact: true })
      .first()
      .click();
    await page.getByLabel("Task title").fill("Ship the team feature");
    await page.getByLabel("Estimate (days)").fill("3");
    await page.getByRole("button", { name: /^Assigned to/ }).click();
    await page
      .getByRole("combobox", { name: "Search team members" })
      .fill(member.email.split("@")[0]);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Save task" }).click();
    const card = page
      .getByTestId("task-card")
      .filter({ hasText: "Ship the team feature" });
    await expect(card).toContainText("3d");
    await other.getByRole("tab", { name: "Assigned to me" }).click();
    const otherCard = other
      .getByTestId("task-card")
      .filter({ hasText: "Ship the team feature" });
    await expect(otherCard).toBeVisible();
    await otherCard
      .getByRole("button", { name: "Ship the team feature", exact: true })
      .click();
    await other.getByRole("button", { name: "Chat", exact: true }).click();
    await other
      .getByLabel("Message", { exact: true })
      .fill("Ready to work on this together.");
    await other.getByRole("button", { name: "Send", exact: true }).click();
    await expect(other.getByRole("log")).toContainText(
      "Ready to work on this together.",
    );
    await other.getByRole("button", { name: "Close", exact: true }).click();
    await expect(
      card.getByRole("button", { name: /Open chat.*1 messages, unread/ }),
    ).toBeVisible();
    await card.getByRole("button", { name: /Open chat/ }).click();
    await expect(page.getByRole("log")).toContainText(
      "Ready to work on this together.",
    );
    await page.getByLabel("Task title").fill("My preserved edit");
    const task = (
      await (
        await request.get(`/api/teams/${teamId}/tasks`, {
          headers: auth(session.token),
        })
      ).json()
    ).tasks[0] as TeamTask;
    await request.patch(`/api/teams/${teamId}/tasks/${task.id}`, {
      headers: auth(memberSession.token),
      data: { version: task.version, title: "Teammate's change" },
    });
    await page.getByRole("button", { name: "Save task" }).click();
    await expect(
      page.getByText("Review the latest version", { exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Task title")).toHaveValue(
      "My preserved edit",
    );
    await page.getByRole("button", { name: "Keep my edits" }).click();
    await page.getByRole("button", { name: "Save task" }).click();
    await expect(page.getByTestId("task-card")).toContainText(
      "My preserved edit",
    );
    await page
      .getByRole("button", { name: "Start: My preserved edit" })
      .click();
    await page
      .getByRole("button", { name: "Complete: My preserved edit" })
      .click();
    await expect(page.getByTestId("column-completed")).toContainText(
      "My preserved edit",
    );
    // Age only the throwaway test task so lazy archive runs through the real endpoint/UI.
    const require = createRequire(path.resolve("../backend/package.json"));
    const mongoose = require("mongoose") as {
      createConnection(uri: string): {
        asPromise(): Promise<{
          collection(name: string): {
            updateOne(
              filter: Record<string, unknown>,
              update: Record<string, unknown>,
            ): Promise<unknown>;
          };
          close(): Promise<void>;
        }>;
      };
    };
    const runtime = JSON.parse(
      await readFile(path.resolve(".next/e2e-mongo.json"), "utf8"),
    ) as { uri: string };
    const connection = await mongoose.createConnection(runtime.uri).asPromise();
    try {
      await connection
        .collection("teamtasks")
        .updateOne(
          { _id: task.id },
          { $set: { completedAt: new Date(Date.now() - 86401000) } },
        );
    } finally {
      await connection.close();
    }
    await page
      .getByRole("button", { name: "Team options", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "History", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "My preserved edit" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Restore", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "My preserved edit" }),
    ).toHaveCount(0);
    await page.getByRole("link", { name: "Back to team board" }).click();
    await page
      .getByRole("button", { name: "Remove My preserved edit" })
      .click();
    await page
      .getByRole("button", { name: "Remove task", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Team options", exact: true })
      .click();
    await page.getByRole("menuitem", { name: "History", exact: true }).click();
    await page.getByRole("tab", { name: "Removed", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "My preserved edit" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Restore", exact: true }).click();
    await page.getByRole("button", { name: "Members (2)" }).click();
    await page.getByRole("button", { name: "Remove", exact: true }).click();
    await page
      .getByRole("button", { name: "Remove member", exact: true })
      .click();
    await expect(
      other.getByRole("dialog", { name: "Team access changed" }),
    ).toBeVisible();
    await other
      .getByRole("button", { name: "Back to teams", exact: true })
      .click();
    await expect(other).toHaveURL(/\/teams$/);
    await page.goto("/");
    await expect(page.getByTestId("task-card")).toContainText(
      "Personal task stays private",
    );
    await expect(page.getByTestId("today-date")).toContainText(
      "resets at midnight",
    );
  } finally {
    await memberContext.close();
  }
});

test("team layout: responsive, both themes, keyboard picker/menu, history, offline and empty filters", async ({
  page,
  request,
}, testInfo) => {
  test.setTimeout(180000);
  const creds = await createUser(request, "layout");
  const session = await apiLogin(request, creds);
  const team = await createTeam(
    request,
    session.token,
    "A very long team name that should truncate neatly without pushing controls off the screen",
  );
  for (let index = 0; index < 6; index++) {
    const member = await createUser(request, `A_long_member_name_${index}`);
    const memberSession = await apiLogin(request, member);
    const invitation = await (
      await request.post(`/api/teams/${team.id}/invites`, {
        headers: auth(session.token),
        data: { email: member.email },
      })
    ).json();
    expect(
      (
        await request.post(
          `/api/teams/invites/${invitation.invite.id}/accept`,
          { headers: auth(memberSession.token) },
        )
      ).ok(),
    ).toBeTruthy();
  }
  await request.post(`/api/teams/${team.id}/tasks`, {
    headers: auth(session.token),
    data: {
      ...input(
        "A long shared task title that should wrap without overflowing the board or list",
      ),
      descriptionHtml: `<p>${"Detailed context. ".repeat(100)}</p>`,
    },
  });
  for (let index = 0; index < 11; index++)
    await request.post(`/api/teams/${team.id}/tasks`, {
      headers: auth(session.token),
      data: {
        ...input(`Shared task ${index + 1}`),
        status: ["todo", "in_progress", "completed"][index % 3],
      },
    });
  await uiLogin(page, creds);
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate((value) => {
      localStorage.setItem("dayflow-theme", value);
      document.documentElement.setAttribute("data-theme", value);
    }, theme);
    for (const width of [360, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`/teams/${team.id}`);
      await expect(page.getByTestId("task-card").first()).toBeVisible();
      await assertFits(page);
      await scan(page);
      await page.screenshot({
        path: testInfo.outputPath(`team-${theme}-${width}.png`),
        fullPage: true,
      });
    }
  }
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByRole("button", { name: /^Assigned to/ }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("combobox", { name: "Search team members" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await scan(page);
  await page.screenshot({
    path: testInfo.outputPath("team-task-dialog.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Team options", exact: true }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("menuitem", { name: "History", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Team history", { exact: true })).toBeVisible();
  await scan(page);
  await assertFits(page);
  await page.getByRole("link", { name: "Back to team board" }).click();
  await page.getByRole("tab", { name: "Assigned to me" }).click();
  await expect(
    page.getByText("Nothing is assigned to you in this team."),
  ).toBeVisible();
  await page.context().setOffline(true);
  await expect(
    page.getByText("Reconnect to make changes to this team.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add task", exact: true }),
  ).toBeDisabled();
  await page.context().setOffline(false);
});
