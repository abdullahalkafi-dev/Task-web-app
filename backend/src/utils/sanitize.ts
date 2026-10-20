import sanitizeHtml from "sanitize-html";

const IMG_SRC_RE = /^(https?:\/\/|\/uploads\/)/i;

const htmlOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "h1", "h2", "h3", "strong", "b", "em", "i", "u", "s", "strike",
    "ul", "ol", "li", "blockquote", "code", "pre", "hr", "a", "img",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    code: ["class"],
  },
  allowedClasses: { code: [/^language-[\w-]+$/] },
  allowedSchemes: ["http", "https"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" },
    }),
  },
  exclusiveFilter: (frame) => frame.tag === "img" && !IMG_SRC_RE.test(frame.attribs.src ?? ""),
};

export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, htmlOptions);
}

export function htmlToPlainText(html: string, max = 300): string {
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
