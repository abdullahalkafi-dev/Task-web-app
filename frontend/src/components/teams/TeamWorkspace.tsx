"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  History,
  LayoutGrid,
  List,
  MoreHorizontal,
  UsersRound,
  X,
} from "lucide-react";
import type { TeamTask, TeamStatus } from "@dayflow/shared";
import { useData } from "@/hooks/useData";
import { useTeams, useTeamResource } from "@/hooks/useTeams";
import { useSyncOnline } from "@/hooks/useOnline";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { ApiError } from "@/lib/api";
import { refreshTeams, teamsApi } from "@/lib/teams-api";
import {
  asBoardTask,
  filterTeamTasks,
  personName,
  TEAM_STATUS_LABEL,
  teamOverdue,
  toTeamStatus,
} from "@/lib/team-utils";
import { computeMove } from "@/lib/order";
import { formatDhaka } from "@/lib/time";
import type { TaskDoc, TaskStatus } from "@/lib/types";
import { TaskBoard } from "../tasks/TaskBoard";
import { BoardSkeleton } from "../tasks/BoardSkeleton";
import { Avatar } from "../ui/Avatar";
import { Button, IconButton } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { FormError, Input, inputClass } from "../ui/Field";
import { InfoBanner } from "../ui/InfoBanner";
import { Menu } from "../ui/Menu";
import { PillTabs } from "../ui/PillTabs";
import { useToast } from "../ui/Toast";
import { cn } from "../ui/cn";
import { MembersDialog } from "./MembersDialog";
import { TeamTaskEditor } from "./TeamTaskEditor";

function DropdownChevron({ open }: { open: boolean }) {
  return (
    <ChevronDown
      size={14}
      strokeWidth={1.75}
      aria-hidden
      className={cn(
        "shrink-0 text-ink-3 transition-transform duration-150",
        open && "rotate-180",
      )}
    />
  );
}

export function TeamWorkspace({
  historyPage = false,
}: {
  historyPage?: boolean;
}) {
  const { teamId } = useParams<{ teamId: string }>();
  const { userId } = useData();
  const { teams } = useTeams();
  const router = useRouter();
  const toast = useToast();
  const online = useSyncOnline();
  const wide = useMediaQuery("(min-width: 768px)");
  const resource = useTeamResource(`workspace:${teamId}`, async () => {
    const [a, b] = await Promise.all([
      teamsApi.get(teamId),
      teamsApi.tasks(teamId),
    ]);
    return { team: a.team, tasks: b.tasks };
  });
  const [view, setView] = useState<"board" | "list" | null>(null);
  const [filter, setFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");
  const [showMembers, setShowMembers] = useState(false);
  const [action, setAction] = useState<"leave" | "delete" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<{
    task: TeamTask | null;
    status: TeamStatus;
    chat?: boolean;
  } | null>(null);
  const [removing, setRemoving] = useState<TeamTask | null>(null);
  const [showHint, setShowHint] = useState(true);
  const [kind, setKind] = useState<"completed" | "removed">("completed");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query);
      setPage(0);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  const history = useTeamResource(
    `history:${teamId}:${kind}:${page}:${search}`,
    () => teamsApi.history(teamId, kind, page, search),
    historyPage,
  );
  useEffect(() => {
    try {
      setShowHint(
        localStorage.getItem(`dayflow:team-hint:${teamId}`) !== "dismissed",
      );
    } catch {
      /* optional preference */
    }
  }, [teamId]);
  const team = resource.data?.team;
  const tasks = useMemo(() => resource.data?.tasks ?? [], [resource.data]);
  const accessLost =
    resource.error instanceof ApiError &&
    [401, 403, 404].includes(resource.error.status);
  const disabled = !online || !!resource.error || busy;
  const run = useCallback(
    async (operation: () => Promise<unknown>, success?: string) => {
      setBusy(true);
      try {
        await operation();
        refreshTeams();
        if (success) toast.show(success);
      } catch (err) {
        toast.show(
          err instanceof Error
            ? err.message
            : "Could not save. Please try again.",
          "error",
        );
        refreshTeams();
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );
  const add = useCallback(
    (status: TaskStatus = "notStarted") => {
      if (!disabled && team)
        setEditor({ task: null, status: toTeamStatus[status] });
    },
    [disabled, team],
  );
  useEffect(() => {
    const onAdd = () => {
      if (historyPage) router.push(`/teams/${teamId}`);
      else add();
    };
    window.addEventListener("dayflow:team-add", onAdd);
    return () => window.removeEventListener("dayflow:team-add", onAdd);
  }, [add, historyPage, router, teamId]);
  const byId = useMemo(
    () => new Map(tasks.map((task) => [task.id, task])),
    [tasks],
  );
  const selectedMember = team?.members.find(
    (member) => member.id === memberFilter,
  );
  const visible = filterTeamTasks(
    tasks,
    filter === "mine" ? userId : (selectedMember?.id ?? "all"),
  );
  const boardTasks = visible.map(asBoardTask);
  const seq = new Map(
    [...tasks]
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .map((task, index) => [task.id, index + 1]),
  );
  const controller = useMemo(
    () => ({
      disabled,
      labels: TEAM_STATUS_LABEL,
      openChat: (task: TaskDoc) => {
        const original = byId.get(task.id);
        if (original)
          setEditor({ task: original, status: original.status, chat: true });
      },
      meta: (task: TaskDoc) => {
        const original = byId.get(task.id)!;
        return {
          assignee: original.assigneeId
            ? personName(team?.members ?? [], original.assigneeId)
            : null,
          estimatedDays: original.estimatedDays,
          overdue: teamOverdue(original),
          messageCount: original.messageCount,
          unread: original.unread,
        };
      },
      update: (task: TaskDoc, status: TaskStatus) => {
        const original = byId.get(task.id);
        if (original)
          void run(() =>
            teamsApi.patch(teamId, original.id, {
              version: original.version,
              status: toTeamStatus[status],
            }),
          );
      },
      move: (
        task: TaskDoc,
        siblings: TaskDoc[],
        index: number,
        status?: TaskStatus,
      ) => {
        void run(async () => {
          const moves = computeMove(siblings, task.id, index);
          for (const move of moves) {
            const original = byId.get(move.id);
            if (original)
              await teamsApi.patch(teamId, original.id, {
                version: original.version,
                orderIndex: move.orderIndex,
                ...(move.id === task.id && status
                  ? { status: toTeamStatus[status] }
                  : {}),
              });
          }
        });
      },
    }),
    [disabled, byId, team?.members, teamId, run],
  );
  const openTask = useCallback(
    (task: TaskDoc) => {
      const original = byId.get(task.id);
      if (original) setEditor({ task: original, status: original.status });
    },
    [byId],
  );
  const removeTask = useCallback(
    (task: TaskDoc) => {
      const original = byId.get(task.id);
      if (original && !disabled) setRemoving(original);
    },
    [byId, disabled],
  );

  if (accessLost)
    return (
      <Dialog
        open
        title="Team access changed"
        onClose={() => router.replace("/teams")}
        footer={
          <Button onClick={() => router.replace("/teams")}>
            Back to teams
          </Button>
        }
      >
        <p className="text-sm text-ink-2">
          This team is no longer available to your account. Your personal tasks
          and notes are safe.
        </p>
      </Dialog>
    );
  if (!team)
    return resource.error ? (
      <div className="space-y-4">
        <FormError message={resource.error.message} />
        <Button variant="secondary" onClick={() => void resource.reload()}>
          Try again
        </Button>
        <Link href="/teams" className="ml-4 text-sm underline">
          Back to teams
        </Link>
      </div>
    ) : (
      <BoardSkeleton />
    );

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="space-y-1">
        <nav
          aria-label="Breadcrumb"
          className="flex min-h-8 items-center text-[13px] font-medium text-ink-2"
        >
          <Link
            href={historyPage ? `/teams/${teamId}` : "/teams"}
            aria-label={historyPage ? "Back to team board" : "Back to teams"}
            className="inline-flex min-h-8 items-center rounded-md transition hover:text-ink"
          >
            {historyPage ? "Team board" : "Teams"}
          </Link>
        </nav>
        <header className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1 basis-40">
            <h1
              aria-label={team.name}
              className="min-w-0 text-2xl font-bold tracking-tight md:text-[28px]"
              title={team.name}
            >
              {teams.length > 1 ? (
                <Menu
                  label="Switch team"
                  selection
                  align="left"
                  items={teams.map((item) => ({
                    id: item.id,
                    label: item.name,
                    active: item.id === teamId,
                    onSelect: () => router.push(`/teams/${item.id}`),
                  }))}
                  trigger={({ ref, toggle, open }) => (
                    <button
                      type="button"
                      ref={ref}
                      onClick={toggle}
                      aria-haspopup="menu"
                      aria-expanded={open}
                      aria-label={`Switch team: ${team.name}`}
                      className="-ml-2 inline-flex max-w-[calc(100%+8px)] items-center gap-2 rounded-input px-2 py-1 text-left transition hover:bg-surface-hover"
                    >
                      <span className="min-w-0 truncate">{team.name}</span>
                      <DropdownChevron open={open} />
                    </button>
                  )}
                />
              ) : (
                <span className="block truncate">{team.name}</span>
              )}
            </h1>
            {historyPage && (
              <p className="mt-0.5 text-sm text-ink-2">Team history</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowMembers(true)}
            className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-surface px-3 text-sm text-ink-2"
            aria-label={`Members (${team.members.length})`}
          >
            <span className="hidden items-center -space-x-1 sm:flex">
              {team.members.slice(0, 3).map((member) => (
                <span
                  key={member.id}
                  role="img"
                  aria-label={member.name}
                  title={member.name}
                >
                  <Avatar name={member.name} size={26} />
                </span>
              ))}
            </span>
            <UsersRound size={17} className="sm:hidden" />
            <span>
              Members
              {team.members.length > 3 ? ` +${team.members.length - 3}` : ""}
            </span>
          </button>
          <Menu
            label="Team options"
            items={[
              {
                label: historyPage ? "Board" : "History",
                icon: <History size={16} />,
                onSelect: () =>
                  router.push(
                    historyPage
                      ? `/teams/${teamId}`
                      : `/teams/${teamId}/history`,
                  ),
              },
              {
                label: team.creatorId === userId ? "Delete team" : "Leave team",
                danger: true,
                onSelect: () => {
                  setAction(team.creatorId === userId ? "delete" : "leave");
                  setActionError(null);
                  setConfirmation("");
                },
              },
            ]}
            trigger={({ ref, toggle, open }) => (
              <IconButton
                ref={ref}
                label="Team options"
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={toggle}
              >
                <MoreHorizontal size={20} />
              </IconButton>
            )}
          />
          {!historyPage && (
            <Button plus disabled={disabled} onClick={() => add()}>
              Add task
            </Button>
          )}
        </header>
      </div>
      {(!online || resource.error) && (
        <InfoBanner title="Reconnect to make changes to this team.">
          Your personal tasks continue to work offline.
        </InfoBanner>
      )}
      {!historyPage && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <PillTabs
                className="[&>button]:h-10"
                label="Team task filter"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All tasks" },
                  { value: "mine", label: "Assigned to me" },
                ]}
              />
              {filter === "all" && (
                <div
                  className={cn(
                    "inline-flex h-10 max-w-[220px] items-center rounded-full border border-line bg-surface text-[13px] font-medium text-ink-2 transition hover:border-line-strong",
                    selectedMember && "border-line-strong text-ink",
                  )}
                >
                  <Menu
                    label="Filter by assignee"
                    align="left"
                    selection
                    items={[
                      {
                        id: "all",
                        label: "All members",
                        active: !selectedMember,
                        onSelect: () => setMemberFilter("all"),
                      },
                      ...team.members.map((member) => ({
                        id: member.id,
                        label: member.name,
                        icon: <Avatar name={member.name} size={24} />,
                        active: member.id === memberFilter,
                        onSelect: () => setMemberFilter(member.id),
                      })),
                    ]}
                    trigger={({ ref, toggle, open }) => (
                      <button
                        ref={ref}
                        type="button"
                        onClick={toggle}
                        aria-haspopup="menu"
                        aria-expanded={open}
                        aria-label={`Filter by assignee: ${selectedMember?.name ?? "All members"}`}
                        className={cn(
                          "flex h-full min-w-0 items-center gap-2 rounded-full px-3.5 text-left transition hover:bg-surface-hover",
                          selectedMember && "pr-2",
                        )}
                      >
                        <span className="min-w-0 truncate">
                          {selectedMember?.name ?? "Assignee"}
                        </span>
                        <DropdownChevron open={open} />
                      </button>
                    )}
                  />
                  {selectedMember && (
                    <button
                      type="button"
                      aria-label="Clear assignee filter"
                      title="Clear assignee filter"
                      onClick={(event) => {
                        setMemberFilter("all");
                        event.currentTarget.parentElement
                          ?.querySelector<HTMLButtonElement>(
                            '[aria-haspopup="menu"]',
                          )
                          ?.focus();
                      }}
                      className="mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-ink-3 transition hover:bg-surface-muted hover:text-ink"
                    >
                      <X size={14} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              )}
            </div>
            <PillTabs
              className="[&>button]:h-10"
              label="View"
              value={view ?? (wide ? "board" : "list")}
              onChange={setView}
              options={[
                {
                  value: "board",
                  label: "Board",
                  icon: <LayoutGrid size={15} />,
                },
                { value: "list", label: "List", icon: <List size={15} /> },
              ]}
            />
          </div>
          {showHint && (
            <InfoBanner
              title="A little different from your daily board."
              action={
                <IconButton
                  label="Dismiss team board explanation"
                  onClick={() => {
                    setShowHint(false);
                    try {
                      localStorage.setItem(
                        `dayflow:team-hint:${teamId}`,
                        "dismissed",
                      );
                    } catch {
                      /* optional preference */
                    }
                  }}
                >
                  <X size={16} />
                </IconButton>
              }
            >
              Team tasks stay until someone removes them. Completed tasks move
              to History after 24 hours.
            </InfoBanner>
          )}
          {visible.length ? (
            <TaskBoard
              tasks={boardTasks}
              view={view ?? (wide ? "board" : "list")}
              seqById={seq}
              onOpen={openTask}
              onDelete={removeTask}
              onAddInColumn={add}
              controller={controller}
            />
          ) : (
            <div className="grid place-items-center rounded-panel bg-surface px-6 py-16 text-center shadow-sm2">
              <p className="text-sm text-ink-2">
                {filter === "mine"
                  ? "Nothing is assigned to you in this team."
                  : selectedMember
                    ? "No tasks are assigned to this member."
                    : "No tasks yet. Add the first one."}
              </p>
              {filter === "all" && !selectedMember && (
                <Button
                  plus
                  className="mt-5"
                  disabled={disabled}
                  onClick={() => add()}
                >
                  Add task
                </Button>
              )}
            </div>
          )}
        </>
      )}
      {historyPage && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PillTabs
              label="History type"
              value={kind}
              onChange={(value) => {
                setKind(value);
                setPage(0);
              }}
              options={[
                { value: "completed", label: "Completed" },
                { value: "removed", label: "Removed" },
              ]}
            />
            <input
              aria-label="Search team history"
              placeholder="Search by title…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className={`${inputClass} max-w-xs`}
            />
          </div>
          {history.error && <FormError message={history.error.message} />}
          {history.loading ? (
            <BoardSkeleton />
          ) : (
            <div className="space-y-3">
              {history.data?.tasks.map((task) => (
                <article
                  key={task.id}
                  className="flex min-w-0 flex-wrap items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-sm2"
                >
                  <button
                    type="button"
                    onClick={() => setEditor({ task, status: task.status })}
                    className="min-w-0 flex-1 basis-48 text-left"
                  >
                    <h2 className="line-clamp-2 break-words text-[15px] font-semibold">
                      {task.title}
                    </h2>
                    <p className="mt-1 text-xs text-ink-2">
                      {personName(history.data?.people ?? [], task.assigneeId)}
                    </p>
                    <p className="mt-1 break-words text-xs text-ink-3">
                      {task.removedAt
                        ? `Removed by ${personName(history.data?.people ?? [], task.removedBy)}`
                        : `Completed by ${personName(history.data?.people ?? [], task.completedBy)}`}{" "}
                      ·{" "}
                      {formatDhaka(
                        task.removedAt ?? task.completedAt ?? task.updatedAt,
                        "D MMM YYYY · h:mm A",
                      )}
                    </p>
                  </button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={disabled}
                    onClick={() =>
                      void run(
                        () => teamsApi.restore(teamId, task),
                        "Task restored to To do",
                      )
                    }
                  >
                    Restore
                  </Button>
                </article>
              ))}
              {!history.data?.tasks.length && (
                <p className="rounded-panel bg-surface px-6 py-12 text-center text-sm text-ink-2">
                  {search
                    ? "No tasks match your search."
                    : kind === "removed"
                      ? "No removed tasks."
                      : "Completed tasks appear here after 24 hours."}
                </p>
              )}
            </div>
          )}
          {(page > 0 || history.data?.hasMore) && (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="text-xs text-ink-2">Page {page + 1}</span>
              <Button
                variant="ghost"
                disabled={!history.data?.hasMore}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
      {showMembers && (
        <MembersDialog
          team={team}
          disabled={disabled}
          onClose={() => setShowMembers(false)}
          onLeave={() => {
            setAction("leave");
            setActionError(null);
          }}
        />
      )}
      {editor && (
        <TeamTaskEditor
          key={`${teamId}:${editor.task?.id ?? `new:${editor.status}`}`}
          team={team}
          task={editor.task}
          defaultStatus={editor.status}
          initialChat={editor.chat}
          disabled={disabled}
          onClose={() => setEditor(null)}
          onRemove={(task) => setRemoving(task)}
          onSaved={refreshTeams}
        />
      )}
      <ConfirmDialog
        open={!!removing}
        title="Remove this task?"
        message="The task and its conversation will stay in team History. Any member can restore it."
        confirmLabel="Remove task"
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) {
            const task = removing;
            void run(async () => {
              await teamsApi.removeTask(teamId, task);
              setEditor(null);
            }, "Task moved to History");
          }
        }}
      />
      <Dialog
        open={!!action}
        title={action === "delete" ? "Delete team?" : "Leave team?"}
        onClose={() => {
          if (!busy) setAction(null);
        }}
        maxWidth="max-w-[460px]"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink-2">
            {action === "delete"
              ? "This permanently deletes the team, its tasks, conversations, history, and images for everyone."
              : "You will lose access to this team. Your tasks will become unassigned."}
          </p>
          {action === "delete" && (
            <Input
              label={`Type “${team.name}” to confirm`}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          )}
          <FormError message={actionError} />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setAction(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              disabled={
                disabled || (action === "delete" && confirmation !== team.name)
              }
              onClick={() => {
                setBusy(true);
                setActionError(null);
                void (
                  action === "delete"
                    ? teamsApi.delete(teamId, confirmation)
                    : teamsApi.leave(teamId)
                )
                  .then(() => {
                    refreshTeams();
                    router.replace("/teams");
                  })
                  .catch((err: unknown) =>
                    setActionError(
                      err instanceof Error ? err.message : "Please try again.",
                    ),
                  )
                  .finally(() => setBusy(false));
              }}
            >
              {action === "delete" ? "Delete team" : "Leave team"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
