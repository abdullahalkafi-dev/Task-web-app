"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, RefreshCw, Trash2 } from "lucide-react";
import { useSyncOnline } from "@/hooks/useOnline";
import { keysApi, type ApiKey } from "@/lib/keys-api";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { Dialog } from "../ui/Dialog";
import { FormError, Input } from "../ui/Field";
import { useToast } from "../ui/Toast";
import { cn } from "../ui/cn";

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full border border-line-strong transition",
        checked ? "bg-primary" : "bg-surface-muted",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0.5 top-0.5 h-4 w-4 rounded-full transition-transform",
          checked ? "translate-x-5 bg-primary-ink" : "bg-ink-2",
        )}
      />
    </button>
  );
}

const fmt = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

export function ApiKeysDialog({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const online = useSyncOnline();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [name, setName] = useState("");
  const [write, setWrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ name: string; value: string } | null>(
    null,
  );
  const [toDelete, setToDelete] = useState<ApiKey | null>(null);

  const fail = useCallback((err: unknown) => {
    setError(err instanceof Error ? err.message : "Please try again.");
  }, []);

  const load = useCallback(async () => {
    try {
      setKeys((await keysApi.list()).keys);
    } catch (err) {
      setKeys((cur) => cur ?? []);
      fail(err);
    }
  }, [fail]);

  useEffect(() => {
    if (online) void load();
  }, [online, load]);

  const replace = (key: ApiKey) =>
    setKeys((cur) => (cur ?? []).map((k) => (k.id === key.id ? key : k)));

  const create = async () => {
    const next = name.trim();
    if (!next) return;
    setBusy(true);
    setError(null);
    try {
      const res = await keysApi.create(next, write);
      setKeys((cur) => [res.key, ...(cur ?? [])]);
      setSecret({ name: res.key.name, value: res.secret });
      setName("");
      setWrite(false);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (key: ApiKey, next: boolean) => {
    setError(null);
    replace({ ...key, write: next });
    try {
      replace((await keysApi.patch(key.id, { write: next })).key);
    } catch (err) {
      replace(key);
      fail(err);
      toast.show("Could not change the key", "error");
    }
  };

  const rotate = async (key: ApiKey) => {
    setBusy(true);
    setError(null);
    try {
      const res = await keysApi.rotate(key.id);
      replace(res.key);
      setSecret({ name: res.key.name, value: res.secret });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (key: ApiKey) => {
    setError(null);
    try {
      await keysApi.remove(key.id);
      setKeys((cur) => (cur ?? []).filter((k) => k.id !== key.id));
      toast.show("Key deleted");
    } catch (err) {
      fail(err);
    }
  };

  const copy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret.value);
      toast.show("Key copied");
    } catch {
      toast.show("Could not copy. Select the key and copy it.", "error");
    }
  };

  return (
    <>
      <Dialog open onClose={onClose} title="API keys" maxWidth="max-w-[560px]">
        <div className="space-y-4">
          <p className="text-sm text-ink-2">
            API keys let your AI agent use your account. A key works as you, so
            never share it or paste it anywhere public. Keys are read only unless
            you turn on Allow changes.
          </p>
          {!online ? (
            <p
              role="status"
              className="rounded-input bg-surface-muted px-3 py-2 text-sm text-ink-2"
            >
              You are offline. Connect to the internet to manage API keys.
            </p>
          ) : (
            <>
              {secret && (
                <div
                  role="status"
                  className="space-y-2 rounded-input border border-line-strong bg-surface-muted p-3"
                >
                  <p className="text-sm font-medium text-ink">
                    New key for {secret.name}
                  </p>
                  <code
                    data-testid="api-key-secret"
                    className="block break-all rounded-input bg-surface px-3 py-2 font-mono text-[13px] text-ink"
                  >
                    {secret.value}
                  </code>
                  <p className="text-[13px] text-ink-2">
                    This is the only time you will see this key.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      icon={<Copy size={14} />}
                      onClick={() => void copy()}
                    >
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSecret(null)}
                    >
                      Done
                    </Button>
                    <Link
                      href="/api-docs"
                      target="_blank"
                      className="text-[13px] font-medium text-ink underline"
                    >
                      Read the API guide
                    </Link>
                  </div>
                </div>
              )}
              <form
                className="space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void create();
                }}
              >
                <Input
                  label="New key name"
                  value={name}
                  maxLength={60}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="For example: My assistant"
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Switch
                    checked={write}
                    onChange={setWrite}
                    label="Allow changes for the new key"
                  />
                  <span className="text-[13px] text-ink-2">
                    Allow changes (off = read only)
                  </span>
                  <Button
                    type="submit"
                    loading={busy}
                    disabled={!name.trim()}
                    className="ml-auto"
                  >
                    Create key
                  </Button>
                </div>
              </form>
              <FormError message={error} />
              {keys === null ? (
                <p className="text-sm text-ink-3">Loading keys</p>
              ) : keys.length === 0 ? (
                <p className="text-sm text-ink-3">No keys yet.</p>
              ) : (
                <ul className="space-y-2" aria-label="Your API keys">
                  {keys.map((key) => (
                    <li
                      key={key.id}
                      className="space-y-2 rounded-input border border-line px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p
                          className="truncate text-sm font-medium"
                          title={key.name}
                        >
                          {key.name}
                        </p>
                        <p className="text-xs text-ink-2">
                          <span className="font-mono">{key.prefix}…</span> ·
                          Created {fmt(key.createdAt)} ·{" "}
                          {key.lastUsedAt
                            ? `Last used ${fmt(key.lastUsedAt)}`
                            : "Never used"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Switch
                          checked={key.write}
                          onChange={(next) => void toggle(key, next)}
                          label={`Allow changes for ${key.name}`}
                        />
                        <span className="text-[13px] text-ink-2">
                          Allow changes (off = read only)
                        </span>
                        <div className="ml-auto flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            icon={<RefreshCw size={14} />}
                            aria-label={`Rotate ${key.name}`}
                            onClick={() => void rotate(key)}
                          >
                            Rotate
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<Trash2 size={14} />}
                            aria-label={`Delete ${key.name}`}
                            onClick={() => setToDelete(key)}
                          >
                            Delete
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[13px] text-ink-2">
                <Link
                  href="/api-docs"
                  target="_blank"
                  className="font-medium text-ink underline"
                >
                  Read the API guide
                </Link>
              </p>
            </>
          )}
        </div>
      </Dialog>
      <ConfirmDialog
        open={toDelete !== null}
        title="Delete key"
        message={`Delete "${toDelete?.name ?? ""}"? Anything using it will stop working.`}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && void remove(toDelete)}
      />
    </>
  );
}
