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
export function teamDueDate(
  startedAt: string | null,
  estimatedDays: number | null,
): string | null {
  return startedAt && estimatedDays
    ? dayjs(startedAt)
        .tz("Asia/Dhaka")
        .startOf("day")
        .add(estimatedDays, "day")
        .format("YYYY-MM-DD")
    : null;
}
export function teamOverdue(
  task: Pick<TeamTask, "startedAt" | "estimatedDays" | "status">,
  now = new Date(),
): boolean {
  const due = teamDueDate(task.startedAt, task.estimatedDays);
  return (
    task.status === "in_progress" &&
    !!due &&
    dayjs(now).tz("Asia/Dhaka").format("YYYY-MM-DD") > due
  );
}
export function filterTeamTasks(
  tasks: TeamTask[],
  assignee: string,
): TeamTask[] {
  return assignee === "all"
    ? tasks
    : tasks.filter((t) => t.assigneeId === assignee);
}
export function asBoardTask(task: TeamTask): TaskDoc {
  return {
    id: task.id,
    userId: task.createdBy,
    title: task.title,
    descriptionHtml: "",
    descriptionText: task.descriptionText,
    status: toPersonalStatus[task.status],
    orderIndex: task.orderIndex,
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
