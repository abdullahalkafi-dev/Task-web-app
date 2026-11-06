"use client";
import { useTeamResource } from "@/hooks/useTeams";
import { teamsApi } from "@/lib/teams-api";
import { personName } from "@/lib/team-utils";
import { formatDhaka } from "@/lib/time";
const labels: Record<string, string> = {
  todo: "To do",
  in_progress: "In progress",
  completed: "Done",
};
export function TaskTimeline({
  teamId,
  taskId,
}: {
  teamId: string;
  taskId: string;
}) {
  const { data, error, loading } = useTeamResource(
    `timeline:${teamId}:${taskId}`,
    () => teamsApi.events(teamId, taskId),
  );
  if (error)
    return (
      <p role="alert" className="pt-3 text-sm text-ink-2">
        {error.message}
      </p>
    );
  return (
    <ol className="space-y-3 pt-3 text-sm">
      {loading && <li className="text-ink-2">Loading timeline…</li>}
      {data?.events.map((event) => (
        <li key={event.id} className="border-l-2 border-line pl-3">
          <p>
            <span className="font-medium">
              {event.actorId
                ? personName(data.people, event.actorId)
                : "Dayflow"}
            </span>{" "}
            {event.type === "created"
              ? "created this task"
              : event.type === "status_changed"
                ? `changed status from ${labels[event.from ?? ""] ?? event.from} to ${labels[event.to ?? ""] ?? event.to}`
                : event.type === "assigned"
                  ? `assigned this task to ${personName(data.people, event.to)}`
                  : event.type === "edited"
                    ? "edited the task"
                    : event.type === "removed"
                      ? "removed the task"
                      : event.type === "restored"
                        ? "restored the task"
                        : "moved the completed task to History"}
            .
          </p>
          <time className="text-xs text-ink-3" dateTime={event.at}>
            {formatDhaka(event.at, "D MMM YYYY · h:mm A")}
          </time>
        </li>
      ))}
    </ol>
  );
}
