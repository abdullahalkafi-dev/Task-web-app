"use client";
import { useEffect, useMemo, useState } from "react";
import MarkdownIt from "markdown-it";
import { Button } from "@/components/ui/Button";

// html is off, so raw HTML in the guide is escaped and link schemes are validated by markdown-it.
const md = new MarkdownIt({ html: false, linkify: true });

const prose =
  "text-sm leading-relaxed text-ink-2 [&_h1]:mb-3 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-ink " +
  "[&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_h3]:mb-1 [&_h3]:mt-4 [&_h3]:font-semibold [&_h3]:text-ink " +
  "[&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-ink [&_a]:underline " +
  "[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-input [&_pre]:bg-surface-muted [&_pre]:p-3 [&_pre]:text-[13px] [&_pre]:text-ink " +
  "[&_code]:font-mono [&_code]:text-[13px] [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-surface-muted [&_:not(pre)>code]:px-1 " +
  "[&_table]:my-3 [&_table]:block [&_table]:overflow-x-auto [&_th]:border [&_th]:border-line [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:text-ink " +
  "[&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1";

export default function ApiDocsPage() {
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    document.title = "Dayflow API guide";
    let active = true;
    fetch("/api/agent/docs")
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error("failed"))))
      .then((body) => active && setText(body))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
  }, []);
  const html = useMemo(() => (text ? md.render(text) : ""), [text]);
  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };
  return (
    <main id="main" className="mx-auto min-h-dvh w-full max-w-[820px] px-4 py-8 text-ink">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Dayflow API guide</h1>
        <div className="ml-auto flex items-center gap-3">
          <a href="/api/agent/docs" className="text-[13px] font-medium underline">
            Raw text
          </a>
          <Button size="sm" variant="secondary" disabled={!text} onClick={() => void copy()}>
            {copied ? "Copied" : "Copy as text"}
          </Button>
        </div>
      </header>
      {error ? (
        <p role="alert" className="text-sm text-ink-2">
          Could not load the guide. Check your connection and reload.
        </p>
      ) : text === null ? (
        <p role="status" className="text-sm text-ink-3">
          Loading the guide
        </p>
      ) : (
        <article className={prose} dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </main>
  );
}
