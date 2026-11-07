"use client";

import { useEffect, useState } from "react";
import { useOptionalData } from "@/hooks/useData";
import { containsLocalImages, hydrateLocalImages } from "@/lib/html";
import { cn } from "../ui/cn";

/** Read-only rendering of stored (sanitized) rich text. Offline images get fresh blob URLs. */
export function RichContent({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const db = useOptionalData()?.db ?? null;
  const [shown, setShown] = useState(html);

  useEffect(() => {
    let cancelled = false;
    if (!db || !containsLocalImages(html)) {
      setShown(html);
      return;
    }
    void hydrateLocalImages(html, db).then((h) => {
      if (!cancelled) setShown(h);
    });
    return () => {
      cancelled = true;
    };
  }, [html, db]);

  const wrapped = shown.replace(
    /<table\b[^>]*>([\s\S]*?)<\/table>/gi,
    (_table, body: string) => {
      const firstRow = /<tr\b[^>]*>([\s\S]*?)<\/tr>/i.exec(body)?.[1] ?? "";
      const columns = Array.from(
        firstRow.matchAll(/<(?:td|th)\b([^>]*)>/gi),
      ).reduce(
        (count, cell) =>
          count +
          Math.max(
            1,
            Math.min(40, Number(/colspan="(\d+)"/.exec(cell[1])?.[1] ?? 1)),
          ),
        0,
      );
      return `<div class="tableWrapper" tabindex="0" role="region" aria-label="Scrollable table"><table style="min-width:${Math.max(420, columns * 180)}px">${body}</table></div>`;
    },
  );
  return (
    <div
      className={cn("rich min-w-0", className)}
      dangerouslySetInnerHTML={{ __html: wrapped }}
    />
  );
}
