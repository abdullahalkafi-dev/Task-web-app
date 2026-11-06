"use client";
import { useState } from "react";
import type {
  TeamDetail,
  TeamStatus,
  TeamTask,
  TeamTaskInput,
} from "@dayflow/shared";
import { ApiError } from "@/lib/api";
import { useTeamResource } from "@/hooks/useTeams";
import { teamsApi, refreshTeams } from "@/lib/teams-api";
import { personName, teamDueDate } from "@/lib/team-utils";
import { formatDateKey, formatDhaka } from "@/lib/time";
import { RichTextEditor } from "../editor/RichTextEditor";
import { RichContent } from "../editor/RichContent";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { FormError, Input } from "../ui/Field";
import { PillTabs } from "../ui/PillTabs";
import { InfoBanner } from "../ui/InfoBanner";
import { AssigneePicker } from "./AssigneePicker";
import { TaskChat } from "./TaskChat";
import { TaskTimeline } from "./TaskTimeline";

export function TeamTaskEditor({
  team,
  task,
  defaultStatus = "todo",
  initialChat = false,
  disabled,
  onClose,
  onRemove,
  onSaved,
}: {
  team: TeamDetail;
  task: TeamTask | null;
  defaultStatus?: TeamStatus;
  initialChat?: boolean;
  disabled: boolean;
  onClose: () => void;
  onRemove: (task: TeamTask) => void;
  onSaved: () => void;
}) {
  const [base, setBase] = useState(task);
  const [title, setTitle] = useState(task?.title ?? "");
  const [html, setHtml] = useState(task?.descriptionHtml ?? "");
  const [assignee, setAssignee] = useState(task?.assigneeId ?? null);
  const [estimate, setEstimate] = useState(
    task?.estimatedDays?.toString() ?? "",
  );
  const [status, setStatus] = useState<TeamStatus>(
    task?.status ?? defaultStatus,
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<TeamTask | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [chat, setChat] = useState(initialChat);
  const [timeline, setTimeline] = useState(false);
  const latest = useTeamResource(
    `task:${team.id}:${task?.id ?? "new"}`,
    () => teamsApi.task(team.id, task!.id),
    !!task,
  );
  const current = latest.data?.task ?? task;
  const history = !!(current?.removedAt || current?.archivedAt);
  const readonly = disabled || history || !!latest.error;
  const due = teamDueDate(
    current?.startedAt ?? null,
    estimate ? Number(estimate) : null,
  );
  const save = async () => {
    if (!title.trim()) {
      setError("Give your task a title.");
      return;
    }
    if (
      estimate &&
      (!Number.isInteger(Number(estimate)) || Number(estimate) < 1)
    ) {
      setError("Use a whole number of days, starting at 1.");
      return;
    }
    setBusy(true);
    setError(null);
    const input: TeamTaskInput = {
      title: title.trim(),
      descriptionHtml: html,
      assigneeId: assignee,
      estimatedDays: estimate ? Number(estimate) : null,
      status,
    };
    try {
      if (base)
        await teamsApi.patch(team.id, base.id, {
          ...input,
          version: base.version,
        });
      else await teamsApi.createTask(team.id, input);
      refreshTeams();
      onSaved();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.code === "TASK_CONFLICT") {
        const details = err.details as { task: TeamTask };
        setConflict(details.task);
      }
      setError(
        err instanceof Error
          ? err.message
          : "Could not save. Your changes are kept here.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      dismissOnBackdrop={false}
      title={`${task ? "Task" : "New task"} · ${team.name}`}
    >
      <div className="space-y-4">
        <FormError message={error ?? latest.error?.message ?? null} />
        {!conflict &&
          current &&
          base &&
          current.version !== base.version &&
          !history && (
            <p className="text-sm text-ink-2">
              This task changed elsewhere. Your edits are kept; saving will ask
              you to review the latest version.
            </p>
          )}
        {history && (
          <InfoBanner title="This task is in History.">
            Restore it from the History page to make changes.
          </InfoBanner>
        )}
        {conflict && (
          <div className="space-y-3 rounded-input border border-line bg-surface-muted p-4">
            <p className="text-sm font-semibold">Review the latest version</p>
            <p className="break-words text-sm">{conflict.title}</p>
            <p className="text-xs text-ink-2">
              Assigned to {personName(team.members, conflict.assigneeId)} ·{" "}
              {conflict.status.replace("_", " ")} ·{" "}
              {conflict.estimatedDays
                ? `${conflict.estimatedDays} days`
                : "No estimate"}
            </p>
            <RichContent
              html={conflict.descriptionHtml}
              className="max-h-32 overflow-y-auto !text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setBase(conflict);
                  setTitle(conflict.title);
                  setHtml(conflict.descriptionHtml);
                  setAssignee(conflict.assigneeId);
                  setEstimate(conflict.estimatedDays?.toString() ?? "");
                  setStatus(conflict.status);
                  setEditorKey((key) => key + 1);
                  setConflict(null);
                  setError(null);
                }}
              >
                Use latest
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setBase(conflict);
                  setConflict(null);
                  setError(null);
                }}
              >
                Keep my edits
              </Button>
            </div>
          </div>
        )}
        <Input
          data-autofocus
          label="Task title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={200}
          disabled={readonly || busy}
          placeholder="What needs to be done?"
        />
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-2">
            Description
          </p>
          {readonly ? (
            <div className="rounded-input border border-line p-4">
              <RichContent html={html || "<p>No description.</p>"} />
            </div>
          ) : (
            <RichTextEditor
              key={editorKey}
              boxed
              entity="task"
              entityId={task?.id ?? "new-team-task"}
              value={html}
              onChange={setHtml}
              uploadImage={(file) => teamsApi.upload(team.id, file)}
              minHeight={130}
              placeholder="Add details, links or images…"
            />
          )}
        </div>
        <AssigneePicker
          members={team.members}
          value={assignee}
          onChange={setAssignee}
          disabled={readonly || busy}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Estimate (days)"
            type="number"
            min={1}
            max={36500}
            step={1}
            value={estimate}
            onChange={(event) => setEstimate(event.target.value)}
            disabled={readonly || busy}
            placeholder="No estimate"
          />
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink-2">Status</p>
            {readonly ? (
              <p className="py-3 text-sm">
                {status === "todo"
                  ? "To do"
                  : status === "in_progress"
                    ? "In progress"
                    : "Done"}
              </p>
            ) : (
              <PillTabs
                label="Team task status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "todo", label: "To do" },
                  { value: "in_progress", label: "In progress" },
                  { value: "completed", label: "Done" },
                ]}
                className="w-full [&>button]:flex-1 [&>button]:justify-center [&>button]:px-2"
              />
            )}
          </div>
        </div>
        {task && (
          <div className="space-y-4 border-t border-line pt-4">
            <dl className="grid gap-2 text-xs text-ink-2 sm:grid-cols-2">
              <div>
                <dt className="inline">Created by </dt>
                <dd className="inline font-medium text-ink">
                  {personName(team.people, task.createdBy)}
                </dd>
              </div>
              <div>
                <dt className="inline">Created </dt>
                <dd className="inline">
                  {formatDhaka(task.createdAt, "D MMM YYYY · h:mm A")}
                </dd>
              </div>
              <div>
                <dt className="inline">Started </dt>
                <dd className="inline">
                  {current?.startedAt
                    ? formatDhaka(current.startedAt, "D MMM YYYY · h:mm A")
                    : "Not started"}
                </dd>
              </div>
              <div>
                <dt className="inline">Due </dt>
                <dd className="inline">
                  {due
                    ? formatDateKey(due, "D MMM YYYY")
                    : "Set after starting with an estimate"}
                </dd>
              </div>
            </dl>
            <div>
              <button
                type="button"
                aria-expanded={chat}
                onClick={() => setChat(!chat)}
                className="flex min-h-11 w-full items-center justify-between text-sm font-semibold"
              >
                <span>
                  Chat
                  {current?.messageCount ? ` · ${current.messageCount}` : ""}
                </span>
                <span aria-hidden>{chat ? "−" : "+"}</span>
              </button>
              {chat && (
                <TaskChat
                  teamId={team.id}
                  taskId={task.id}
                  disabled={readonly}
                />
              )}
            </div>
            <div className="border-t border-line pt-2">
              <button
                type="button"
                aria-expanded={timeline}
                onClick={() => setTimeline(!timeline)}
                className="flex min-h-11 w-full items-center justify-between text-sm text-ink-2"
              >
                <span>{timeline ? "Hide timeline" : "Show timeline"}</span>
                <span aria-hidden>{timeline ? "−" : "+"}</span>
              </button>
              {timeline && <TaskTimeline teamId={team.id} taskId={task.id} />}
            </div>
          </div>
        )}
      </div>
      <div className="safe-bottom sticky bottom-0 -mx-5 mt-5 flex flex-wrap items-center gap-2 border-t border-line bg-surface px-5 py-3 md:-mx-6 md:px-6">
        {task && !history && (
          <Button
            size="sm"
            variant="ghost"
            disabled={readonly || busy}
            onClick={() => onRemove(current ?? task)}
            className="!text-red-700 dark:!text-red-300"
          >
            Remove
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="soft" disabled={busy} onClick={onClose}>
            {history ? "Close" : "Cancel"}
          </Button>
          {!history && (
            <Button
              disabled={readonly || !!conflict || !title.trim()}
              loading={busy}
              onClick={() => void save()}
            >
              Save task
            </Button>
          )}
        </div>
      </div>
    </Dialog>
  );
}
