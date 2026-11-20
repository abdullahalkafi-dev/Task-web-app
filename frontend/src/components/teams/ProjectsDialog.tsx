"use client";
import { useState } from "react";
import type { TeamDetail, TeamProject } from "@dayflow/shared";
import { refreshTeams, teamsApi } from "@/lib/teams-api";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { FormError, Input } from "../ui/Field";
import { useToast } from "../ui/Toast";

export function ProjectsDialog({
  team,
  disabled,
  onClose,
}: {
  team: TeamDetail;
  disabled: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = team.projects.filter((p) => !p.archivedAt);
  const archived = team.projects.filter((p) => p.archivedAt);
  const run = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
      refreshTeams();
      toast.show(success);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const row = (project: TeamProject) => (
    <li
      key={project.id}
      className="flex min-w-0 flex-wrap items-center gap-2 rounded-input border border-line px-3 py-2"
    >
      {editing?.id === project.id ? (
        <form
          className="flex min-w-0 flex-1 basis-48 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const next = editing.name.trim();
            if (!next) return;
            void run(
              () => teamsApi.patchProject(team.id, project.id, { name: next }),
              "Project renamed",
            ).then((ok) => ok && setEditing(null));
          }}
        >
          <input
            aria-label={`Rename project ${project.name}`}
            value={editing.name}
            maxLength={100}
            onChange={(event) =>
              setEditing({ id: project.id, name: event.target.value })
            }
            className="h-10 min-w-0 flex-1 rounded-input border border-line bg-surface px-3 text-sm"
          />
          <Button size="sm" type="submit" loading={busy} disabled={disabled}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </form>
      ) : (
        <>
          <span
            className="min-w-0 flex-1 basis-40 truncate text-sm font-medium"
            title={project.name}
          >
            {project.name}
          </span>
          {project.archivedAt ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={disabled || busy}
              onClick={() =>
                void run(
                  () =>
                    teamsApi.patchProject(team.id, project.id, {
                      archived: false,
                    }),
                  "Project restored",
                )
              }
            >
              Restore
            </Button>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                disabled={disabled || busy}
                aria-label={`Rename ${project.name}`}
                onClick={() => setEditing({ id: project.id, name: project.name })}
              >
                Rename
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={disabled || busy}
                aria-label={`Archive ${project.name}`}
                onClick={() =>
                  void run(
                    () =>
                      teamsApi.patchProject(team.id, project.id, {
                        archived: true,
                      }),
                    "Project archived",
                  )
                }
              >
                Archive
              </Button>
            </>
          )}
        </>
      )}
    </li>
  );
  return (
    <Dialog open onClose={onClose} title="Projects" maxWidth="max-w-[520px]">
      <div className="space-y-4">
        <p className="text-sm text-ink-2">
          A project is usually a client. Tasks can belong to one project or none.
          Archiving keeps its tasks and labels.
        </p>
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const next = name.trim();
            if (!next) return;
            void run(
              () => teamsApi.createProject(team.id, next),
              "Project added",
            ).then((ok) => ok && setName(""));
          }}
        >
          <div className="min-w-0 flex-1">
            <Input
              label="New project"
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              placeholder="Client or project name"
              disabled={disabled}
            />
          </div>
          <Button
            type="submit"
            loading={busy}
            disabled={disabled || !name.trim()}
            className="mb-0.5"
          >
            Add
          </Button>
        </form>
        <FormError message={error} />
        {active.length ? (
          <ul className="space-y-2" aria-label="Active projects">
            {active.map(row)}
          </ul>
        ) : (
          <p className="text-sm text-ink-3">No projects yet.</p>
        )}
        {archived.length > 0 && (
          <div className="space-y-2">
            <p className="text-[13px] font-medium text-ink-2">Archived</p>
            <ul className="space-y-2" aria-label="Archived projects">
              {archived.map(row)}
            </ul>
          </div>
        )}
      </div>
    </Dialog>
  );
}
