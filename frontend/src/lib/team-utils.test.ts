import { describe, expect, it } from "vitest";
import type { TeamTask } from "@dayflow/shared";
import { teamDueDate, teamOverdue, filterTeamTasks } from "./team-utils";
describe("team day estimates and filters", () => {
  it("uses the Dhaka calendar day, including UTC midnight boundaries", () => {
    expect(teamDueDate("2026-11-05T20:30:00Z", 3)).toBe("2026-11-09");
    expect(teamDueDate("2026-12-31T18:30:00Z", 1)).toBe("2027-01-02");
    expect(teamDueDate(null, 3)).toBeNull();
    expect(teamDueDate("2026-11-05T20:30:00Z", null)).toBeNull();
  });
  it("becomes overdue only after the due day passes in Dhaka, while in progress", () => {
    const task = {
      startedAt: "2026-11-05T20:30:00Z",
      estimatedDays: 1,
      status: "in_progress" as const,
    };
    expect(teamOverdue(task, new Date("2026-11-07T17:59:59Z"))).toBe(false);
    expect(teamOverdue(task, new Date("2026-11-07T18:00:00Z"))).toBe(true);
    expect(
      teamOverdue({ ...task, status: "completed" }, new Date("2026-11-09")),
    ).toBe(false);
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
