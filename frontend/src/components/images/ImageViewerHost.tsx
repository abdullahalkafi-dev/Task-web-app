"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  PenLine,
  Minus,
  Plus,
  X,
} from "lucide-react";
import {
  downloadName,
  fetchVersions,
  storedImagePath,
  uploadMarkup,
  type ImageVersion,
} from "@/lib/image-tools";
import { formatDhaka } from "@/lib/time";
import { useToast } from "../ui/Toast";
import { cn } from "../ui/cn";
import { ImageMarkup } from "./ImageMarkup";

/** Fired on an editor's DOM when a marked-up image replaces one of its images. */
export const IMAGE_REPLACE_EVENT = "dayflow:image-replace";
export interface ImageReplaceDetail {
  from: string;
  to: string;
  node: Element | null;
}

interface Session {
  items: string[];
  index: number;
  scope: Element;
  editable: boolean;
  nodes: Element[];
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input,[tabindex]:not([tabindex="-1"])';
const MIN_SCALE = 1;
const MAX_SCALE = 6;
const control =
  "grid h-11 w-11 shrink-0 place-items-center rounded-full text-white transition hover:bg-white/15 disabled:opacity-40";

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function Viewer({
  session,
  onClose,
  onReplaced,
}: {
  session: Session;
  onClose: () => void;
  onReplaced: (index: number, url: string) => void;
}) {
  const toast = useToast();
  const root = useRef<HTMLDivElement | null>(null);
  const stage = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(session.index);
  const [shown, setShown] = useState(session.items[session.index]);
  const [versions, setVersions] = useState<ImageVersion[]>([]);
  const [markup, setMarkup] = useState(false);
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [failed, setFailed] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ distance: number; scale: number } | null>(null);
  const latest = session.items[index];
  const stored = !!storedImagePath(latest);
  const canMark =
    session.editable && stored && shown === latest && navigator.onLine;

  useEffect(() => {
    setShown(latest);
    setView({ scale: 1, x: 0, y: 0 });
    setFailed(false);
    setVersions([]);
    let cancelled = false;
    void fetchVersions(latest)
      .then((rows) => {
        if (!cancelled) setVersions(rows);
      })
      .catch(() => {
        /* versions are optional */
      });
    return () => {
      cancelled = true;
    };
  }, [latest]);

  useEffect(() => {
    setView({ scale: 1, x: 0, y: 0 });
    setFailed(false);
  }, [shown]);

  const zoomTo = useCallback((next: number) => {
    setView((old) => {
      const scale = clamp(next, MIN_SCALE, MAX_SCALE);
      return scale === 1 ? { scale, x: 0, y: 0 } : { ...old, scale };
    });
  }, []);
  const go = useCallback(
    (step: number) => {
      setMarkup(false);
      setIndex((old) => clamp(old + step, 0, session.items.length - 1));
    },
    [session.items.length],
  );

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    root.current
      ?.querySelector<HTMLElement>("[data-autofocus]")
      ?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const node = root.current;
      if (!node) return;
      const typing = (event.target as HTMLElement | null)?.tagName === "INPUT";
      if (event.key === "Escape") {
        if (typing) return;
        event.stopPropagation();
        event.preventDefault();
        if (!markup) onClose();
        return;
      }
      if (markup || typing) {
        if (event.key === "Tab" && !typing) trap(event, node);
        return;
      }
      if (event.key === "ArrowLeft") go(-1);
      else if (event.key === "ArrowRight") go(1);
      else if (event.key === "+" || event.key === "=") zoomTo(view.scale * 1.4);
      else if (event.key === "-") zoomTo(view.scale / 1.4);
      else if (event.key === "Tab") trap(event, node);
    };
    // Capture so dialogs underneath never see keys meant for the viewer.
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [go, markup, onClose, view.scale, zoomTo]);

  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomTo(view.scale * (event.deltaY < 0 ? 1.15 : 1 / 1.15));
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [view.scale, zoomTo, markup]);

  const pointerDown = (event: ReactPointerEvent) => {
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      gesture.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale: view.scale,
      };
    }
    setDragging(true);
  };
  const pointerMove = (event: ReactPointerEvent) => {
    const old = pointers.current.get(event.pointerId);
    if (!old) return;
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pointers.current.size === 2 && gesture.current) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      zoomTo(gesture.current.scale * (distance / gesture.current.distance));
    } else if (view.scale > 1) {
      const dx = event.clientX - old.x;
      const dy = event.clientY - old.y;
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  };
  const pointerUp = (event: ReactPointerEvent) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (!pointers.current.size) setDragging(false);
  };

  const label = (position: number): string =>
    position === 0
      ? "Latest"
      : position === versions.length - 1
        ? "Original"
        : `Edit ${versions.length - 1 - position}`;

  return (
    <div
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
      data-testid="image-viewer"
      className="fixed inset-0 z-[85] flex animate-fade-in flex-col bg-black text-white"
    >
      <div className="flex items-center gap-1 px-2 py-1.5">
        <span className="px-3 text-sm text-white/80" aria-live="polite">
          {session.items.length > 1
            ? `${index + 1} / ${session.items.length}`
            : "Image"}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {!markup && (
            <>
              <button
                type="button"
                aria-label="Zoom out"
                title="Zoom out"
                disabled={view.scale <= MIN_SCALE}
                onClick={() => zoomTo(view.scale / 1.4)}
                className={control}
              >
                <Minus size={18} />
              </button>
              <button
                type="button"
                aria-label="Zoom in"
                title="Zoom in"
                disabled={view.scale >= MAX_SCALE}
                onClick={() => zoomTo(view.scale * 1.4)}
                className={control}
              >
                <Plus size={18} />
              </button>
              {canMark && (
                <button
                  type="button"
                  onClick={() => setMarkup(true)}
                  className="flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-white hover:bg-white/15"
                >
                  <PenLine size={16} /> Mark up
                </button>
              )}
              <a
                href={shown}
                download={downloadName(shown)}
                aria-label="Download image"
                title="Download"
                className={control}
              >
                <Download size={18} />
              </a>
            </>
          )}
          <button
            type="button"
            data-autofocus
            aria-label="Close image viewer"
            title="Close"
            onClick={() => (markup ? setMarkup(false) : onClose())}
            className={control}
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {markup ? (
        <ImageMarkup
          src={latest}
          onCancel={() => setMarkup(false)}
          onSave={async (blob) => {
            const result = await uploadMarkup(latest, blob);
            const detail: ImageReplaceDetail = {
              from: latest,
              to: result.url,
              node: session.nodes[index] ?? null,
            };
            session.scope.dispatchEvent(
              new CustomEvent(IMAGE_REPLACE_EVENT, { detail }),
            );
            onReplaced(index, result.url);
            setMarkup(false);
            toast.show("Image updated. The original is kept in its versions.");
          }}
        />
      ) : (
        <>
          <div
            ref={stage}
            className={cn(
              "relative grid min-h-0 flex-1 touch-none place-items-center overflow-hidden",
              view.scale > 1 ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in",
            )}
            onPointerDown={pointerDown}
            onPointerMove={pointerMove}
            onPointerUp={pointerUp}
            onPointerCancel={pointerUp}
            onDoubleClick={() => zoomTo(view.scale > 1 ? 1 : 2.5)}
          >
            {failed ? (
              <p className="px-6 text-center text-sm text-white/80">
                This image could not be loaded.
              </p>
            ) : (
              <img
                key={shown}
                src={shown}
                alt="Full-size image"
                draggable={false}
                onError={() => setFailed(true)}
                className="max-h-full max-w-full select-none object-contain"
                style={{
                  transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                  transition: dragging ? "none" : "transform 120ms ease-out",
                }}
              />
            )}
            {session.items.length > 1 && index > 0 && (
              <button
                type="button"
                aria-label="Previous image"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => go(-1)}
                className={cn(control, "absolute left-2 top-1/2 -translate-y-1/2 bg-black/50")}
              >
                <ChevronLeft size={22} />
              </button>
            )}
            {session.items.length > 1 && index < session.items.length - 1 && (
              <button
                type="button"
                aria-label="Next image"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => go(1)}
                className={cn(control, "absolute right-2 top-1/2 -translate-y-1/2 bg-black/50")}
              >
                <ChevronRight size={22} />
              </button>
            )}
          </div>
          {versions.length > 1 && (
            <div
              role="group"
              aria-label="Image versions"
              className="safe-bottom border-t border-white/10 px-3 py-2"
            >
              <p className="mb-1.5 text-xs text-white/70">
                Earlier versions are kept. Pick one to view or download it.
              </p>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {versions.map((version, position) => (
                  <button
                    key={version.url}
                    type="button"
                    aria-pressed={shown === version.url}
                    aria-label={`Show ${label(position)} version, ${formatDhaka(version.createdAt, "D MMM YYYY h:mm A")}`}
                    onClick={() => setShown(version.url)}
                    className={cn(
                      "shrink-0 rounded-lg border-2 p-0.5 text-left transition",
                      shown === version.url
                        ? "border-white"
                        : "border-transparent opacity-70 hover:opacity-100",
                    )}
                  >
                                        <img
                      src={version.url}
                      alt=""
                      className="h-14 w-auto max-w-32 rounded-md object-cover"
                    />
                    <span className="mt-0.5 block text-[11px] font-medium leading-tight">
                      {label(position)}
                    </span>
                    <span className="block text-[10px] leading-tight text-white/60">
                      {formatDhaka(version.createdAt, "D MMM, h:mm A")}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function trap(event: KeyboardEvent, node: HTMLElement): void {
  const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null,
  );
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Opens any image inside rich text (descriptions, notes, chat, history) in a full-screen viewer.
 * Mounted once; clicks are handled in the capture phase so cards and editors underneath do not react.
 */
export function ImageViewerHost() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const target = event.target as Element | null;
      const img = target?.closest?.("img");
      if (!img) return;
      const scope = img.closest(".ProseMirror, .rich");
      if (!scope || img.closest("[data-image-viewer-ignore]")) return;
      const nodes = Array.from(scope.querySelectorAll("img")).filter((node) =>
        node.getAttribute("src"),
      );
      const index = nodes.indexOf(img);
      if (index < 0) return;
      event.preventDefault();
      event.stopPropagation();
      setSession({
        items: nodes.map((node) => node.getAttribute("src") as string),
        index,
        scope,
        editable:
          scope.classList.contains("ProseMirror") &&
          scope.getAttribute("contenteditable") === "true",
        nodes,
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  if (!session || typeof document === "undefined") return null;
  return createPortal(
    <Viewer
      session={session}
      onClose={() => setSession(null)}
      onReplaced={(position, url) =>
        setSession((old) =>
          old
            ? {
                ...old,
                items: old.items.map((item, i) => (i === position ? url : item)),
              }
            : old,
        )
      }
    />,
    document.body,
  );
}
