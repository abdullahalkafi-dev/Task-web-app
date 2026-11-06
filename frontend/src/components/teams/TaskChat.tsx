"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Send, X } from "lucide-react";
import type { TeamMessage, TeamPerson } from "@dayflow/shared";
import { useData } from "@/hooks/useData";
import { useTeamResource } from "@/hooks/useTeams";
import { refreshTeams, teamsApi } from "@/lib/teams-api";
import { personName } from "@/lib/team-utils";
import { formatDhaka } from "@/lib/time";
import { RichContent } from "../editor/RichContent";
import { Button } from "../ui/Button";
import { FormError } from "../ui/Field";
export function TaskChat({
  teamId,
  taskId,
  disabled,
}: {
  teamId: string;
  taskId: string;
  disabled: boolean;
}) {
  const { userId } = useData();
  const resource = useTeamResource(`chat:${teamId}:${taskId}`, () =>
    teamsApi.messages(teamId, taskId),
  );
  const [older, setOlder] = useState<TeamMessage[]>([]);
  const [oldPeople, setOldPeople] = useState<TeamPerson[]>([]);
  const [hasOlder, setHasOlder] = useState<boolean | undefined>();
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paging, setPaging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const readId = useRef<string | null>(null);
  const messageId = useRef<string | null>(null);
  const messages = useMemo(
    () =>
      [
        ...new Map(
          [...older, ...(resource.data?.messages ?? [])].map((m) => [m.id, m]),
        ).values(),
      ].sort(
        (a, b) =>
          a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
      ),
    [older, resource.data],
  );
  const people = [...oldPeople, ...(resource.data?.people ?? [])];
  const last = messages[messages.length - 1];
  useEffect(() => {
    if (
      !last ||
      readId.current === last.id ||
      document.visibilityState !== "visible"
    )
      return;
    readId.current = last.id;
    void teamsApi
      .read(teamId, taskId, last.id)
      .then(refreshTeams)
      .catch(() => {
        readId.current = null;
      });
  }, [last, taskId, teamId]);
  const send = async () => {
    if (!text.trim() && !images.length) return;
    setBusy(true);
    setError(null);
    messageId.current ??= crypto.randomUUID();
    try {
      await teamsApi.send(teamId, taskId, {
        id: messageId.current,
        bodyText: text.trim(),
        bodyHtml: images
          .map((url) => `<p><img src="${url}" alt="Shared image"></p>`)
          .join(""),
      });
      setText("");
      setImages([]);
      messageId.current = null;
      refreshTeams();
      await resource.reload();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Message could not be sent. Your draft is kept.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3 pt-3">
      {(hasOlder ?? resource.data?.hasMore) && (
        <Button
          size="sm"
          variant="ghost"
          loading={paging}
          onClick={() => {
            setPaging(true);
            void teamsApi
              .messages(teamId, taskId, messages[0]?.id)
              .then((result) => {
                setOlder((items) => [...result.messages, ...items]);
                setOldPeople((items) => [...items, ...result.people]);
                setHasOlder(result.hasMore);
              })
              .catch((err: unknown) =>
                setError(
                  err instanceof Error
                    ? err.message
                    : "Could not load messages.",
                ),
              )
              .finally(() => setPaging(false));
          }}
        >
          Earlier messages
        </Button>
      )}
      <div
        role="log"
        aria-label="Task messages"
        aria-live="polite"
        aria-relevant="additions"
        className="max-h-80 space-y-3 overflow-y-auto rounded-input bg-surface-muted p-3"
      >
        {resource.loading && (
          <p className="text-sm text-ink-2">Loading messages…</p>
        )}
        {!resource.loading && !messages.length && (
          <p className="py-3 text-center text-sm text-ink-2">
            Start the conversation.
          </p>
        )}
        {messages.map((message) => (
          <article key={message.id} className="rounded-input bg-surface p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-1 text-xs">
              <span className="font-semibold">
                {message.authorId === userId
                  ? "You"
                  : personName(people, message.authorId)}
              </span>
              <time className="text-ink-3" dateTime={message.createdAt}>
                {formatDhaka(message.createdAt, "D MMM · h:mm A")}
              </time>
            </div>
            {message.bodyText && (
              <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                {message.bodyText}
              </p>
            )}
            {message.bodyHtml && (
              <RichContent
                html={message.bodyHtml}
                className="mt-2 !text-sm [&_img]:max-h-60 [&_img]:w-auto"
              />
            )}
          </article>
        ))}
      </div>
      <FormError message={error ?? resource.error?.message ?? null} />
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((url) => (
            <span
              key={url}
              className="inline-flex items-center gap-1 rounded-chip bg-surface-muted px-2 py-1 text-xs"
            >
              Image attached
              <button
                type="button"
                aria-label="Remove attached image"
                disabled={busy}
                onClick={() =>
                  setImages((items) => items.filter((item) => item !== url))
                }
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      )}
      <label className="block text-[13px] font-medium text-ink-2">
        Message
        <textarea
          className="mt-1.5 block min-h-20 w-full resize-y rounded-input bg-surface-muted p-3 text-sm text-ink disabled:opacity-60"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            messageId.current = null;
          }}
          maxLength={10000}
          disabled={disabled || busy}
          placeholder="Write a message…"
        />
      </label>
      <div className="flex items-center justify-between gap-2">
        <Button
          size="sm"
          variant="ghost"
          icon={<ImagePlus size={16} />}
          disabled={disabled || busy}
          onClick={() => fileInput.current?.click()}
        >
          Image
        </Button>
        <Button
          size="sm"
          icon={<Send size={15} />}
          disabled={disabled || busy || (!text.trim() && !images.length)}
          loading={busy}
          onClick={() => void send()}
        >
          Send
        </Button>
      </div>
      <input
        ref={fileInput}
        aria-label="Attach chat image"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setBusy(true);
          setError(null);
          void teamsApi
            .upload(teamId, file)
            .then(({ url }) => {
              setImages((items) => [...items, url]);
              messageId.current = null;
            })
            .catch((err: unknown) =>
              setError(
                err instanceof Error ? err.message : "Could not upload image.",
              ),
            )
            .finally(() => setBusy(false));
        }}
      />
    </div>
  );
}
