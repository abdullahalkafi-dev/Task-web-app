"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { UsersRound } from "lucide-react";
import { useTeams } from "@/hooks/useTeams";
import { refreshTeams, teamsApi } from "@/lib/teams-api";
import { useSyncOnline as useOnline } from "@/hooks/useOnline";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { FormError, Input } from "../ui/Field";
import { InfoBanner } from "../ui/InfoBanner";
import { Skeleton } from "../ui/Skeleton";
import { useToast } from "../ui/Toast";
export function TeamsHome() {
  const { teams, invites, loading, error } = useTeams();
  const online = useOnline();
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const respond = async (id: string, accept: boolean) => {
    setBusy(true);
    try {
      await teamsApi.respond(id, accept);
      refreshTeams();
      toast.show(accept ? "You joined the team" : "Invitation declined");
    } catch (err) {
      toast.show(
        err instanceof Error ? err.message : "Could not respond.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-5 md:space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-[28px]">
            Teams
          </h1>
          <p className="mt-0.5 text-sm text-ink-2">
            A shared place to get things done.
          </p>
        </div>
        <Button
          plus
          disabled={!online}
          onClick={() => {
            setCreating(true);
            setMessage(null);
          }}
        >
          New team
        </Button>
      </header>
      {!online && (
        <InfoBanner title="You’re offline.">
          Reconnect to make changes to your teams.
        </InfoBanner>
      )}
      {error && online && <FormError message={error.message} />}
      {invites.map((invite) => (
        <InfoBanner
          key={invite.id}
          title={`${invite.invitedBy.name} invited you`}
          action={
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={busy || !online}
                onClick={() => void respond(invite.id, false)}
              >
                Decline
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={busy || !online}
                onClick={() => void respond(invite.id, true)}
              >
                Accept
              </Button>
            </div>
          }
        >
          <span className="break-words">to {invite.teamName}.</span>
        </InfoBanner>
      ))}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((id) => (
            <Skeleton key={id} className="h-40 rounded-card" />
          ))}
        </div>
      ) : teams.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/teams/${team.id}`}
              className="min-w-0 rounded-card border border-line bg-surface p-5 shadow-sm2 transition hover:shadow-md2"
            >
              <h2
                className="truncate text-base font-semibold"
                title={team.name}
              >
                {team.name}
              </h2>
              <p className="mt-1 text-sm text-ink-2">
                {team.openTaskCount} open{" "}
                {team.openTaskCount === 1 ? "task" : "tasks"}
              </p>
              <div className="mt-5 flex items-center gap-1.5">
                {team.members.slice(0, 4).map((member) => (
                  <span
                    key={member.id}
                    role="img"
                    aria-label={member.name}
                    title={member.name}
                  >
                    <Avatar name={member.name} size={28} />
                  </span>
                ))}
                {team.members.length > 4 && (
                  <span className="ml-1 text-xs text-ink-2">
                    +{team.members.length - 4}
                  </span>
                )}
                <span className="ml-auto text-xs text-ink-2">
                  {team.members.length}{" "}
                  {team.members.length === 1 ? "member" : "members"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        !error && (
          <div className="grid place-items-center rounded-panel bg-surface px-6 py-16 text-center shadow-sm2">
            <UsersRound
              size={30}
              strokeWidth={1.5}
              className="mb-4 text-ink-2"
            />
            <h2 className="text-lg font-semibold">Work together.</h2>
            <p className="mt-1 max-w-xs text-sm text-ink-2">
              Create a team and invite someone to share tasks.
            </p>
          </div>
        )
      )}
      <Dialog
        open={creating}
        onClose={() => {
          if (!busy) setCreating(false);
        }}
        title="New team"
        maxWidth="max-w-[440px]"
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            setMessage(null);
            void teamsApi
              .create(name.trim())
              .then(({ team }) => {
                refreshTeams();
                setCreating(false);
                setName("");
                router.push(`/teams/${team.id}`);
              })
              .catch((err: unknown) =>
                setMessage(
                  err instanceof Error ? err.message : "Could not create team.",
                ),
              )
              .finally(() => setBusy(false));
          }}
        >
          <Input
            data-autofocus
            label="Team name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            required
            placeholder="Design team"
          />
          <FormError message={message} />
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => setCreating(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={busy}
              disabled={!online || !name.trim()}
            >
              Create team
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
