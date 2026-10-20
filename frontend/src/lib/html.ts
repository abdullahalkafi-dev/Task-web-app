import type { DayflowDB } from "./db";

function parse(html: string): Document | null {
  if (typeof DOMParser === "undefined") return null;
  return new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
}

export function htmlToText(html: string, max = 300): string {
  const doc = parse(html);
  const text = doc ? (doc.body.textContent ?? "") : html.replace(/<[^>]+>/g, " ");
  return text.replace(/\s+/g, " ").trim().slice(0, max);
}

export function hasImages(html: string): boolean {
  return /<img\b/i.test(html);
}

/** True while the HTML still references an image that has not been uploaded yet. */
export function containsLocalImages(html: string): boolean {
  return /data-local-id=/i.test(html);
}

export function localImageIds(html: string): string[] {
  const doc = parse(html);
  if (!doc) return [];
  return Array.from(doc.querySelectorAll("img[data-local-id]")).map((n) => n.getAttribute("data-local-id") ?? "");
}

/** Swap a locally queued image for its uploaded server URL. */
export function rewriteLocalImage(html: string, localId: string, url: string): string {
  const doc = parse(html);
  if (!doc) return html;
  doc.querySelectorAll("img[data-local-id]").forEach((img) => {
    if (img.getAttribute("data-local-id") === localId) {
      img.setAttribute("src", url);
      img.removeAttribute("data-local-id");
    }
  });
  return doc.body.innerHTML;
}

/** Remove a queued image whose upload was permanently rejected. */
export function dropLocalImage(html: string, localId: string): string {
  const doc = parse(html);
  if (!doc) return html;
  doc.querySelectorAll("img[data-local-id]").forEach((img) => {
    if (img.getAttribute("data-local-id") === localId) img.remove();
  });
  return doc.body.innerHTML;
}

/**
 * Blob URLs die with the page, so queued (offline) images get a fresh object URL from the
 * stored Blob every time content is shown or edited.
 */
export async function hydrateLocalImages(html: string, db: DayflowDB): Promise<string> {
  if (!containsLocalImages(html)) return html;
  const doc = parse(html);
  if (!doc) return html;
  const imgs = Array.from(doc.querySelectorAll("img[data-local-id]"));
  for (const img of imgs) {
    const id = img.getAttribute("data-local-id");
    if (!id) continue;
    const row = await db.pendingUploads.get(id);
    if (row) img.setAttribute("src", URL.createObjectURL(row.blob));
  }
  return doc.body.innerHTML;
}
