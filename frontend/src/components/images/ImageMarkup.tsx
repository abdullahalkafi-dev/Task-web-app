"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  Circle,
  Highlighter,
  MoveUpRight,
  Pencil,
  Redo2,
  Square,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";
import { cn } from "../ui/cn";

type Tool = "pen" | "highlight" | "arrow" | "rect" | "ellipse" | "text";
type Point = [number, number];
type Stroke<T extends string> = { t: T; color: string; w: number; pts: Point[] };
type Box<T extends string> = { t: T; color: string; w: number; a: Point; b: Point };
type Shape =
  | Stroke<"pen">
  | Stroke<"highlight">
  | Box<"arrow">
  | Box<"rect">
  | Box<"ellipse">
  | { t: "text"; color: string; w: number; at: Point; text: string };

const COLORS = [
  { value: "#EF4444", label: "Red" },
  { value: "#F59E0B", label: "Orange" },
  { value: "#FACC15", label: "Yellow" },
  { value: "#22C55E", label: "Green" },
  { value: "#3B82F6", label: "Blue" },
  { value: "#111111", label: "Black" },
  { value: "#FFFFFF", label: "White" },
];
const SIZES = [
  { value: 1, label: "Thin" },
  { value: 2, label: "Medium" },
  { value: 3.5, label: "Thick" },
];
const TOOLS: { value: Tool; label: string; icon: typeof Pencil }[] = [
  { value: "pen", label: "Pen", icon: Pencil },
  { value: "highlight", label: "Highlighter", icon: Highlighter },
  { value: "arrow", label: "Arrow", icon: MoveUpRight },
  { value: "rect", label: "Rectangle", icon: Square },
  { value: "ellipse", label: "Circle", icon: Circle },
  { value: "text", label: "Text", icon: Type },
];

function draw(ctx: CanvasRenderingContext2D, shape: Shape): void {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = shape.color;
  ctx.fillStyle = shape.color;
  ctx.lineWidth = shape.w;
  if (shape.t === "pen" || shape.t === "highlight") {
    if (shape.t === "highlight") {
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = shape.w * 4;
    }
    ctx.beginPath();
    shape.pts.forEach(([x, y], index) => {
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    if (shape.pts.length === 1)
      ctx.lineTo(shape.pts[0][0] + 0.01, shape.pts[0][1]);
    ctx.stroke();
  } else if (shape.t === "rect") {
    ctx.strokeRect(
      Math.min(shape.a[0], shape.b[0]),
      Math.min(shape.a[1], shape.b[1]),
      Math.abs(shape.b[0] - shape.a[0]),
      Math.abs(shape.b[1] - shape.a[1]),
    );
  } else if (shape.t === "ellipse") {
    ctx.beginPath();
    ctx.ellipse(
      (shape.a[0] + shape.b[0]) / 2,
      (shape.a[1] + shape.b[1]) / 2,
      Math.max(1, Math.abs(shape.b[0] - shape.a[0]) / 2),
      Math.max(1, Math.abs(shape.b[1] - shape.a[1]) / 2),
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
  } else if (shape.t === "arrow") {
    const [x1, y1] = shape.a;
    const [x2, y2] = shape.b;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const head = Math.max(14, shape.w * 4.5);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - head * Math.cos(angle - Math.PI / 6),
      y2 - head * Math.sin(angle - Math.PI / 6),
    );
    ctx.lineTo(
      x2 - head * Math.cos(angle + Math.PI / 6),
      y2 - head * Math.sin(angle + Math.PI / 6),
    );
    ctx.closePath();
    ctx.fill();
  } else {
    const size = shape.w * 5;
    ctx.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textBaseline = "top";
    // Outline keeps text readable on any screenshot background.
    ctx.lineWidth = Math.max(2, size / 6);
    ctx.strokeStyle = shape.color === "#FFFFFF" ? "#111111" : "#FFFFFF";
    ctx.strokeText(shape.text, shape.at[0], shape.at[1]);
    ctx.fillText(shape.text, shape.at[0], shape.at[1]);
  }
  ctx.restore();
}

const iconButton =
  "grid h-11 w-11 shrink-0 place-items-center rounded-full text-white transition hover:bg-white/15 disabled:opacity-40 aria-pressed:bg-white aria-pressed:text-black";

export function ImageMarkup({
  src,
  onCancel,
  onSave,
}: {
  src: string;
  onCancel: () => void;
  onSave: (image: Blob) => Promise<void>;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const bitmapRef = useRef<ImageBitmap | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState(COLORS[0].value);
  const [size, setSize] = useState(SIZES[1].value);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [undone, setUndone] = useState<Shape[]>([]);
  const [draft, setDraft] = useState<Shape | null>(null);
  const [text, setText] = useState<{ at: Point; value: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(src, { credentials: "same-origin" });
        if (!response.ok) throw new Error("Could not load the image.");
        const bitmap = await createImageBitmap(await response.blob());
        if (cancelled) return;
        bitmapRef.current = bitmap;
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
        }
        setReady(true);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Could not load the image.",
          );
      }
    })();
    return () => {
      cancelled = true;
      bitmapRef.current?.close();
    };
  }, [src]);

  const paint = useCallback(() => {
    const canvas = canvasRef.current;
    const bitmap = bitmapRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !bitmap || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    for (const shape of shapes) draw(ctx, shape);
    if (draft) draw(ctx, draft);
  }, [shapes, draft]);
  useEffect(() => {
    if (ready) paint();
  }, [ready, paint]);

  const unit = () => Math.max(1, (canvasRef.current?.width ?? 800) / 800);
  const point = (event: ReactPointerEvent): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) * canvas.width) / rect.width,
      ((event.clientY - rect.top) * canvas.height) / rect.height,
    ];
  };
  const commit = (shape: Shape) => {
    setShapes((all) => [...all, shape]);
    setUndone([]);
  };
  const commitText = () => {
    if (text && text.value.trim())
      commit({
        t: "text",
        color,
        w: size * 3 * unit(),
        at: text.at,
        text: text.value.trim(),
      });
    setText(null);
  };
  const down = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!ready || busy || event.button !== 0) return;
    const at = point(event);
    if (tool === "text") {
      commitText();
      setText({ at, value: "" });
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    const w = size * 3 * unit();
    setDraft(
      tool === "pen" || tool === "highlight"
        ? { t: tool, color, w, pts: [at] }
        : { t: tool, color, w, a: at, b: at },
    );
  };
  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!draft) return;
    const at = point(event);
    setDraft(
      draft.t === "pen" || draft.t === "highlight"
        ? { ...draft, pts: [...draft.pts, at] }
        : draft.t === "text"
          ? draft
          : { ...draft, b: at },
    );
  };
  const up = () => {
    if (!draft) return;
    const tiny =
      draft.t !== "pen" &&
      draft.t !== "highlight" &&
      draft.t !== "text" &&
      Math.hypot(draft.b[0] - draft.a[0], draft.b[1] - draft.a[1]) < 4;
    if (!tiny) commit(draft);
    setDraft(null);
  };
  const undo = useCallback(() => {
    const last = shapes[shapes.length - 1];
    if (!last) return;
    setUndone((items) => [...items, last]);
    setShapes(shapes.slice(0, -1));
  }, [shapes]);
  const redo = useCallback(() => {
    const last = undone[undone.length - 1];
    if (!last) return;
    setShapes([...shapes, last]);
    setUndone(undone.slice(0, -1));
  }, [shapes, undone]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.tagName === "INPUT") return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || busy) return;
    commitText();
    setBusy(true);
    setError(null);
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (result) =>
            result ? resolve(result) : reject(new Error("Could not export.")),
          "image/png",
        ),
      );
      await onSave(blob);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the image.");
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="image-markup">
      <div
        role="toolbar"
        aria-label="Markup tools"
        className="flex flex-wrap items-center gap-1 border-b border-white/10 px-2 py-1.5"
      >
        {TOOLS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            aria-label={label}
            title={label}
            aria-pressed={tool === value}
            onClick={() => setTool(value)}
            className={iconButton}
          >
            <Icon size={18} strokeWidth={1.75} />
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-white/20" aria-hidden />
        <div role="group" aria-label="Color" className="flex items-center">
          {COLORS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-label={label}
              title={label}
              aria-pressed={color === value}
              onClick={() => setColor(value)}
              className="grid h-9 w-9 place-items-center rounded-full"
            >
              <span
                className={cn(
                  "h-5 w-5 rounded-full border border-white/40",
                  color === value && "ring-2 ring-white ring-offset-2 ring-offset-black",
                )}
                style={{ background: value }}
              />
            </button>
          ))}
        </div>
        <span className="mx-1 h-6 w-px bg-white/20" aria-hidden />
        <div role="group" aria-label="Size" className="flex items-center">
          {SIZES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-label={`${label} stroke`}
              title={label}
              aria-pressed={size === value}
              onClick={() => setSize(value)}
              className={iconButton}
            >
              <span
                className="rounded-full bg-current"
                style={{ width: 6 + value * 3, height: 6 + value * 3 }}
              />
            </button>
          ))}
        </div>
        <span className="mx-1 h-6 w-px bg-white/20" aria-hidden />
        <button
          type="button"
          aria-label="Undo"
          title="Undo"
          disabled={!shapes.length || busy}
          onClick={undo}
          className={iconButton}
        >
          <Undo2 size={18} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label="Redo"
          title="Redo"
          disabled={!undone.length || busy}
          onClick={redo}
          className={iconButton}
        >
          <Redo2 size={18} strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label="Clear all marks"
          title="Clear all marks"
          disabled={!shapes.length || busy}
          onClick={() => {
            setShapes([]);
            setUndone([]);
          }}
          className={iconButton}
        >
          <Trash2 size={18} strokeWidth={1.75} />
        </button>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="h-11 rounded-full px-4 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!ready || busy || (!shapes.length && !text?.value.trim())}
            onClick={() => void save()}
            className="h-11 rounded-full bg-white px-5 text-sm font-semibold text-black hover:bg-white/90 disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      {error && (
        <p role="alert" className="bg-red-950 px-4 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
      <div className="grid min-h-0 flex-1 place-items-center overflow-auto p-3">
        <div className="relative max-h-full max-w-full">
          <canvas
            ref={canvasRef}
            aria-label="Image to mark up"
            className={cn(
              "block touch-none rounded-sm bg-white/5",
              tool === "text" ? "cursor-text" : "cursor-crosshair",
              !ready && "min-h-40 min-w-40",
            )}
            style={{ maxWidth: "100%", maxHeight: "calc(100dvh - 150px)" }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={() => setDraft(null)}
          />
          {text && canvasRef.current && (
            <input
              autoFocus
              aria-label="Text to add to the image"
              value={text.value}
              maxLength={200}
              onChange={(event) =>
                setText({ at: text.at, value: event.target.value })
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") commitText();
                if (event.key === "Escape") {
                  event.stopPropagation();
                  setText(null);
                }
              }}
              onBlur={commitText}
              className="absolute min-w-24 rounded border border-white/60 bg-black/70 px-2 py-1 text-sm text-white outline-none"
              style={{
                left: `${(text.at[0] / canvasRef.current.width) * 100}%`,
                top: `${(text.at[1] / canvasRef.current.height) * 100}%`,
                color,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
