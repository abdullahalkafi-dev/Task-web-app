"use client";

import { useEffect, useState } from "react";
import { useOptionalData } from "@/hooks/useData";
import { containsLocalImages, hydrateLocalImages } from "@/lib/html";
import { cn } from "../ui/cn";

/** Read-only rendering of stored (sanitized) rich text. Offline images get fresh blob URLs. */
export function RichContent({ html, className }: { html: string; className?: string }) {
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

  return <div className={cn("rich", className)} dangerouslySetInnerHTML={{ __html: shown }} />;
}
