import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import type { Extensions } from "@tiptap/react";

/** Image that remembers its offline queue id so the sync engine can swap in the uploaded URL. */
export const DayflowImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      "data-local-id": {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute("data-local-id"),
        renderHTML: (attrs: Record<string, unknown>) => {
          const id = attrs["data-local-id"];
          return typeof id === "string" && id ? { "data-local-id": id } : {};
        },
      },
    };
  },
});

export function buildExtensions(placeholder: string): Extensions {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] }, codeBlock: {} }),
    Underline,
    Link.configure({
      autolink: true,
      openOnClick: false,
      HTMLAttributes: { target: "_blank", rel: "noopener noreferrer nofollow" },
    }),
    DayflowImage.configure({ inline: false, allowBase64: false }),
    Placeholder.configure({ placeholder }),
  ];
}

export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
