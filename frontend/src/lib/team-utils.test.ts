import { describe, expect, it } from "vitest";
import type { TeamTask } from "@dayflow/shared";
import {
  awaitingDelivery,
  filterByProject,
  filterTeamTasks,
  scopeTasks,
  teamOverdue,
} from "./team-utils";
const task = (over: Partial<TeamTask>): TeamTask =>
  ({
    id: "t",
    status: "completed",
    plannedDeliveryDate: null,
    deliveredAt: null,
    projectId: null,
    ...over,
  }) as TeamTask;
describe("team delivery and filters", () => {
  it("is overdue only after the planned Dhaka day passes and until delivered", () => {
    const t = task({ plannedDeliveryDate: "2026-11-12" });
    expect(teamOverdue(t, new Date("2026-11-12T17:59:59Z"))).toBe(false);
    expect(teamOverdue(t, new Date("2026-11-12T18:00:00Z"))).toBe(true);
    expect(
      teamOverdue({ ...t, deliveredAt: "2026-11-12T01:00:00Z" }, new Date("2026-11-20")),
    ).toBe(false);
    expect(teamOverdue(task({}), new Date("2030-01-01"))).toBe(false);
  });
  it("treats Done work as awaiting delivery until delivered", () => {
    expect(awaitingDelivery(task({}))).toBe(true);
    expect(awaitingDelivery(task({ deliveredAt: "2026-11-12T01:00:00Z" }))).toBe(false);
    expect(awaitingDelivery(task({ status: "in_progress" }))).toBe(false);
  });
  it("orders awaiting and overdue views by planned date, undated last", () => {
    const rows = [
      task({ id: "c", plannedDeliveryDate: null }),
      task({ id: "b", plannedDeliveryDate: "2026-11-16" }),
      task({ id: "a", plannedDeliveryDate: "2026-11-12" }),
    ];
    expect(scopeTasks(rows, "awaiting").map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(
      scopeTasks(rows, "overdue", new Date("2026-11-14T12:00:00Z")).map((t) => t.id),
    ).toEqual(["a"]);
    expect(scopeTasks(rows, "board")).toHaveLength(3);
  });
  it("filters by project, including tasks without a project", () => {
    const rows = [task({ id: "1", projectId: "p" }), task({ id: "2" })];
    expect(filterByProject(rows, "p").map((t) => t.id)).toEqual(["1"]);
    expect(filterByProject(rows, "none").map((t) => t.id)).toEqual(["2"]);
    expect(filterByProject(rows, "all")).toHaveLength(2);
  });
  it("filters assignments without mixing unassigned tasks with a member's tasks", () => {
    const tasks = [
      { id: "1", assigneeId: "a" },
      { id: "2", assigneeId: null },
      { id: "3", assigneeId: "b" },
    ] as TeamTask[];
    expect(filterTeamTasks(tasks, "a").map((t) => t.id)).toEqual(["1"]);
    expect(filterTeamTasks(tasks, "all")).toHaveLength(3);
  });
});
