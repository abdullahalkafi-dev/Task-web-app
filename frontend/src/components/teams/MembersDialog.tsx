"use client";
import { useState } from "react";
import type { TeamDetail, TeamMember } from "@dayflow/shared";
import { useData } from "@/hooks/useData";
import { refreshTeams, teamsApi } from "@/lib/teams-api";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { FormError, Input } from "../ui/Field";
import { useToast } from "../ui/Toast";
export function MembersDialog({
  team,
  onClose,
  onLeave,
  disabled,
}: {
  team: TeamDetail;
  onClose: () => void;
  onLeave: () => void;
  disabled: boolean;
}) {
  const { userId } = useData();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remove, setRemove] = useState<TeamMember | null>(null);
  const perform = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      refreshTeams();
      toast.show(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Dialog open onClose={onClose} title="Members" maxWidth="max-w-[520px]">
        <div className="space-y-5">
          <ul className="space-y-3">
            {team.members.map((member) => (
              <li key={member.id} className="flex min-w-0 items-center gap-3">
                <Avatar name={member.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-semibold"
                    title={member.name}
                  >
                    {member.name}
                    {member.id === userId ? " (you)" : ""}
                  </p>
                  <p className="truncate text-xs text-ink-2">
                    {member.id === team.creatorId ? "Creator" : member.email}
                  </p>
                </div>
                {userId === team.creatorId && member.id !== userId && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={disabled || busy}
                    onClick={() => setRemove(member)}
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <form
            className="space-y-3 border-t border-line pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              void perform(async () => {
                await teamsApi.invite(team.id, email.trim());
                setEmail("");
              }, "Invitation sent");
            }}
          >
            <Input
              label="Invite by email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@gmail.com"
              hint="Invite someone who already has a Dayflow account."
            />
            <Button
              variant="secondary"
              type="submit"
              loading={busy}
              disabled={disabled || !email.trim()}
            >
              Send invitation
            </Button>
          </form>
          <FormError message={error} />
          {team.invites.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-3">
                Pending invitations
              </p>
              {team.invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex min-w-0 items-center gap-2 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {invite.invitedUser.email}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy || disabled}
                    onClick={() =>
                      void perform(
                        () => teamsApi.cancel(team.id, invite.id),
                        "Invitation cancelled",
                      )
                    }
                  >
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          )}
          {userId !== team.creatorId && (
            <Button
              variant="ghost"
              disabled={disabled || busy}
              onClick={() => {
                onClose();
                onLeave();
              }}
            >
              Leave team
            </Button>
          )}
        </div>
      </Dialog>
      <ConfirmDialog
        open={!!remove}
        title="Remove member?"
        message={`${remove?.name ?? "This person"} will lose access. Their tasks will become unassigned.`}
        confirmLabel="Remove member"
        onClose={() => setRemove(null)}
        onConfirm={() => {
          if (remove)
            void perform(
              () => teamsApi.removeMember(team.id, remove.id),
              "Member removed",
            );
        }}
      />
    </>
  );
}
