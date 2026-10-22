"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BubbleMenu, EditorContent, useEditor, type Editor } from "@tiptap/react";
import "@tiptap/starter-kit";
import "@tiptap/extension-link";
import "@tiptap/extension-underline";
import { Bold, Code, Heading, ImagePlus, Italic, Link as LinkIcon, List, ListOrdered, Quote, Underline as UnderlineIcon, Unlink } from "lucide-react";
import { useData } from "@/hooks/useData";
import { api, ApiError } from "@/lib/api";
import { containsLocalImages, hydrateLocalImages } from "@/lib/html";
import { queueImage } from "@/lib/repo";
import type { Entity } from "@/lib/types";
import { cn } from "../ui/cn";
import { Menu } from "../ui/Menu";
import { useToast } from "../ui/Toast";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, buildExtensions } from "./extensions";

function ToolButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full text-ink-2 transition hover:bg-surface hover:text-ink",
        active && "bg-surface text-ink shadow-sm2",
      )}
    >
      {children}
    </button>
  );
}

export interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  entity: Entity;
  entityId: string;
  placeholder?: string;
  autofocus?: boolean;
  className?: string;
  minHeight?: number;
  /** Bordered box with the toolbar inside it (task editor), instead of the floating pill toolbar. */
  boxed?: boolean;
}

export function RichTextEditor({ value, onChange, entity, entityId, placeholder = "Write something…", autofocus, className, minHeight = 160, boxed }: RichTextEditorProps) {
  const { db } = useData();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const editorRef = useRef<Editor | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const insertImage = useCallback(
    async (file: File) => {
      const editor = editorRef.current;
      if (!editor) return;
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.show("Only png, jpg, webp or gif images are allowed", "error");
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.show("Images must be 10 MB or smaller", "error");
        return;
      }
      const putLocal = async (): Promise<void> => {
        const { localId, blobUrl } = await queueImage(db, entity, entityId, file);
        editor.chain().focus().insertContent({ type: "image", attrs: { src: blobUrl, "data-local-id": localId } }).run();
        toast.show("Offline — image will upload when you are back online", "info");
      };
      if (!navigator.onLine) return putLocal();
      try {
        const res = await api.upload(file, file.name || "image.png");
        editor.chain().focus().insertContent({ type: "image", attrs: { src: res.url } }).run();
      } catch (err) {
        if (err instanceof ApiError && err.status !== 0) {
          toast.show(err.message, "error");
          return;
        }
        await putLocal();
      }
    },
    [db, entity, entityId, toast],
  );
  const insertImageRef = useRef(insertImage);
  useEffect(() => {
    insertImageRef.current = insertImage;
  }, [insertImage]);

  const needsHydration = containsLocalImages(value);
  const editor = useEditor({
    immediatelyRender: false,
    autofocus: autofocus ? "end" : false,
    extensions: buildExtensions(placeholder),
    content: needsHydration ? "" : value,
    editorProps: {
      attributes: { class: "ProseMirror", "aria-label": "Description", role: "textbox", "aria-multiline": "true" },
      handlePaste: (_view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false; // let TipTap keep pasted HTML (headings, lists, bold, links, code)
        event.preventDefault();
        files.forEach((f) => void insertImageRef.current(f));
        return true;
      },
      handleDrop: (_view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((f) => void insertImageRef.current(f));
        return true;
      },
    },
    onUpdate: ({ editor: e }) => onChangeRef.current(e.isEmpty && !e.getHTML().includes("<img") ? "" : e.getHTML()),
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // Offline images: blob: URLs die with the page, so re-create them from the stored Blobs.
  useEffect(() => {
    if (!editor || !needsHydration) return;
    let cancelled = false;
    void hydrateLocalImages(value, db).then((html) => {
      if (!cancelled) editor.commands.setContent(html, false);
    });
    return () => {
      cancelled = true;
    };
    // only on first mount for this editor
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return <div className={cn("skeleton h-40 rounded-2xl", className)} />;

  const applyLink = (): void => {
    const url = linkUrl.trim();
    if (!url) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      const href = /^(https?:\/\/|mailto:)/i.test(url) ? url : `https://${url}`;
      editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    }
    setLinkOpen(false);
    setLinkUrl("");
  };

  const headingLevel = ([1, 2, 3] as const).find((l) => editor.isActive("heading", { level: l }));

  return (
    <div className={cn("rounded-2xl", boxed && "overflow-hidden border border-line-strong", className)}>
      <div
        role="toolbar"
        aria-label="Formatting"
        className={cn("z-10 flex flex-wrap items-center gap-1", boxed ? "tb-boxed border-b border-line bg-surface px-2 py-1.5" : "sticky top-0 rounded-full bg-surface-muted p-1")}
      >
        <Menu
          label="Heading"
          align="left"
          items={([1, 2, 3] as const).map((l) => ({
            label: `Heading ${l}`,
            active: headingLevel === l,
            onSelect: () => editor.chain().focus().toggleHeading({ level: l }).run(),
          }))}
          trigger={({ toggle, ref }) => (
            <button
              ref={ref}
              type="button"
              aria-label="Heading"
              title="Heading"
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggle}
              className={cn("grid h-9 w-9 place-items-center rounded-full text-ink-2 transition hover:bg-surface hover:text-ink", headingLevel && "bg-surface text-ink shadow-sm2")}
            >
              <Heading size={18} strokeWidth={1.75} />
            </button>
          )}
        />
        <ToolButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={18} strokeWidth={1.75} />
        </ToolButton>
        <ToolButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={18} strokeWidth={1.75} />
        </ToolButton>
        <ToolButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <UnderlineIcon size={18} strokeWidth={1.75} />
        </ToolButton>
        <span aria-hidden className="mx-1 h-5 w-px bg-line-strong" />
        <ToolButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <List size={18} strokeWidth={1.75} />
        </ToolButton>
        <ToolButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <ListOrdered size={18} strokeWidth={1.75} />
        </ToolButton>
        <ToolButton label="Quote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <Quote size={18} strokeWidth={1.75} />
        </ToolButton>
        <ToolButton label="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <Code size={18} strokeWidth={1.75} />
        </ToolButton>
        <span aria-hidden className="mx-1 h-5 w-px bg-line-strong" />
        <ToolButton
          label="Link"
          active={editor.isActive("link")}
          onClick={() => {
            setLinkUrl((editor.getAttributes("link").href as string | undefined) ?? "");
            setLinkOpen((o) => !o);
          }}
        >
          <LinkIcon size={18} strokeWidth={1.75} />
        </ToolButton>
        <ToolButton label="Insert image" onClick={() => fileRef.current?.click()}>
          <ImagePlus size={18} strokeWidth={1.75} />
        </ToolButton>
        <input
          ref={fileRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          multiple
          hidden
          data-testid="editor-image-input"
          onChange={(e) => {
            Array.from(e.target.files ?? []).forEach((f) => void insertImage(f));
            e.target.value = "";
          }}
        />
      </div>

      {linkOpen && (
        <form
          className={cn("flex items-center gap-2", boxed ? "border-b border-line px-2 py-2" : "mt-2")}
          onSubmit={(e) => {
            e.preventDefault();
            applyLink();
          }}
        >
          <input
            autoFocus
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://example.com"
            aria-label="Link URL"
            className="h-10 flex-1 rounded-full bg-surface-muted px-4 text-sm outline-none focus:ring-2 focus:ring-accent-blue/30"
          />
          <button type="submit" className="h-10 rounded-full bg-primary px-4 text-sm font-medium text-primary-ink">
            Apply
          </button>
        </form>
      )}

      <BubbleMenu editor={editor} tippyOptions={{ duration: 120 }} className="flex items-center gap-0.5 rounded-full border border-line bg-surface p-1 shadow-lg2">
        <ToolButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={16} strokeWidth={1.75} />
        </ToolButton>
        <ToolButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={16} strokeWidth={1.75} />
        </ToolButton>
        {editor.isActive("link") ? (
          <ToolButton label="Remove link" onClick={() => editor.chain().focus().extendMarkRange("link").unsetLink().run()}>
            <Unlink size={16} strokeWidth={1.75} />
          </ToolButton>
        ) : (
          <ToolButton
            label="Link"
            onClick={() => {
              setLinkUrl("");
              setLinkOpen(true);
            }}
          >
            <LinkIcon size={16} strokeWidth={1.75} />
          </ToolButton>
        )}
      </BubbleMenu>

      <EditorContent editor={editor} className={cn("rich", boxed ? "px-4 py-3" : "mt-3")} style={{ minHeight }} />
    </div>
  );
}
