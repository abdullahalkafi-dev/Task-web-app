import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import type { TeamStatus, TeamTask, TeamPerson } from "@dayflow/shared";
import type { TaskDoc, TaskStatus } from "./types";
dayjs.extend(utc);
dayjs.extend(timezone);
export const TEAM_STATUS_LABEL = {
  notStarted: "To do",
  started: "In progress",
  completed: "Done",
};
export const toPersonalStatus: Record<TeamStatus, TaskStatus> = {
  todo: "notStarted",
  in_progress: "started",
  completed: "completed",
};
export const toTeamStatus: Record<TaskStatus, TeamStatus> = {
  notStarted: "todo",
  started: "in_progress",
  completed: "completed",
};
export function dhakaToday(now = new Date()): string {
  return dayjs(now).tz("Asia/Dhaka").format("YYYY-MM-DD");
}
/** Planned delivery has passed (Dhaka day) and the task is not delivered. */
export function teamOverdue(
  task: Pick<TeamTask, "plannedDeliveryDate" | "deliveredAt">,
  now = new Date(),
): boolean {
  return (
    !!task.plannedDeliveryDate &&
    !task.deliveredAt &&
    dhakaToday(now) > task.plannedDeliveryDate
  );
}
/** Work is Done but the client has not received it yet. */
export function awaitingDelivery(
  task: Pick<TeamTask, "status" | "deliveredAt">,
): boolean {
  return task.status === "completed" && !task.deliveredAt;
}
export type TeamScope = "board" | "awaiting" | "overdue";
export function scopeTasks(
  tasks: TeamTask[],
  scope: TeamScope,
  now = new Date(),
): TeamTask[] {
  if (scope === "board") return tasks;
  const rows =
    scope === "awaiting"
      ? tasks.filter(awaitingDelivery)
      : tasks.filter((t) => teamOverdue(t, now));
  // Soonest promise first; tasks without a planned date go last.
  return [...rows].sort((x, y) =>
    (x.plannedDeliveryDate ?? "9999").localeCompare(
      y.plannedDeliveryDate ?? "9999",
    ),
  );
}
export function filterByProject(tasks: TeamTask[], project: string): TeamTask[] {
  return project === "all"
    ? tasks
    : project === "none"
      ? tasks.filter((t) => !t.projectId)
      : tasks.filter((t) => t.projectId === project);
}
export function filterTeamTasks(
  tasks: TeamTask[],
  assignee: string,
): TeamTask[] {
  return assignee === "all"
    ? tasks
    : tasks.filter((t) => t.assigneeId === assignee);
}
export function asBoardTask(task: TeamTask, orderIndex = task.orderIndex): TaskDoc {
  return {
    id: task.id,
    userId: task.createdBy,
    title: task.title,
    descriptionHtml: "",
    descriptionText: task.descriptionText,
    status: toPersonalStatus[task.status],
    orderIndex,
    estimatedMinutes: 0,
    taskDate: "",
    copiedFromDate: null,
    copiedFromTaskId: null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    deletedAt: null,
  };
}
export function personName(people: TeamPerson[], id: string | null): string {
  return id
    ? (people.find((p) => p.id === id)?.name ?? "Former member")
    : "Unassigned";
}
