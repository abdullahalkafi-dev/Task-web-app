import sanitizeHtml from "sanitize-html";
import { AppError } from "./AppError";

const IMG_SRC_RE = /^(https?:\/\/|\/uploads\/)/i;

const htmlOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "h1",
    "h2",
    "h3",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "strike",
    "ul",
    "ol",
    "li",
    "blockquote",
    "code",
    "pre",
    "hr",
    "a",
    "img",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "th",
    "td",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    code: ["class"],
    td: ["colspan", "rowspan", "align"],
    th: ["colspan", "rowspan", "align"],
  },
  allowedClasses: { code: [/^language-[\w-]+$/] },
  allowedSchemes: ["http", "https"],
  allowedSchemesByTag: {
    img: ["http", "https"],
    a: ["http", "https", "mailto"],
  },
  allowProtocolRelative: false,
  transformTags: {
    td: cellAttributes,
    th: cellAttributes,
    a: (tagName, attribs) => ({
      tagName,
      attribs: {
        ...attribs,
        target: "_blank",
        rel: "noopener noreferrer nofollow",
      },
    }),
  },
  exclusiveFilter: (frame) =>
    frame.tag === "img" && !IMG_SRC_RE.test(frame.attribs.src ?? ""),
};

function cellAttributes(
  tagName: string,
  attrs: Record<string, string>,
): { tagName: string; attribs: Record<string, string> } {
  const attribs: Record<string, string> = {};
  for (const [key, max] of [
    ["colspan", 40],
    ["rowspan", 200],
  ] as const) {
    const value = attrs[key] ?? "";
    if (/^\d+$/.test(value) && Number(value) > 0 && Number(value) <= max)
      attribs[key] = String(Number(value));
  }
  if (["left", "center", "right"].includes(attrs.align))
    attribs.align = attrs.align;
  return { tagName, attribs };
}

/** Old clients may change metadata, but must never flatten a newer description. */
export function assertRichContentCompatible(
  existing: string,
  incoming: string,
  supportsTables: boolean,
): void {
  if (!supportsTables && /<table\b/i.test(existing) && incoming !== existing) {
    throw new AppError(
      409,
      "EDITOR_UPDATE_REQUIRED",
      "This description contains a table. Refresh Dayflow or use the updated website to edit it. Your server copy has been kept.",
    );
  }
}

export function sanitizeRichHtml(html: string): string {
  let depth = 0,
    nodes = 0,
    inTable = false,
    rows = 0,
    width = 0,
    cells = 0;
  let occupied: boolean[][] = [],
    tableWidth = 0,
    tableCells = 0;
  return sanitizeHtml(html, {
    ...htmlOptions,
    onOpenTag: (name, attrs) => {
      depth++;
      nodes++;
      if (depth > 60 || nodes > 30_000)
        throw new AppError(
          400,
          "CONTENT_COMPLEXITY",
          "This content is too complex. Paste smaller sections.",
        );
      if (name === "table") {
        if (inTable)
          throw new AppError(
            400,
            "NESTED_TABLE",
            "Nested tables are not supported. Paste the inner table separately.",
          );
        inTable = true;
        rows = 0;
        occupied = [];
        tableWidth = 0;
        tableCells = 0;
      }
      if (inTable && name === "tr") {
        rows++;
        width = 0;
      }
      if (inTable && (name === "td" || name === "th")) {
        const clean = cellAttributes(name, attrs).attribs;
        const col = Number(clean.colspan ?? 1),
          row = Number(clean.rowspan ?? 1);
        const rowIndex = Math.max(0, rows - 1);
        const slots = (occupied[rowIndex] ??= []);
        while (slots[width]) width++;
        for (let y = rowIndex; y < rowIndex + row; y++) {
          const target = (occupied[y] ??= []);
          for (let x = width; x < width + col; x++) target[x] = true;
        }
        width += col;
        tableWidth = Math.max(tableWidth, width);
        tableCells += col * row;
        cells += col * row;
      }
      if (rows > 200 || width > 40 || cells > 2_000)
        throw new AppError(
          400,
          "TABLE_TOO_LARGE",
          "Tables support up to 200 rows, 40 columns and 2,000 cells per description.",
        );
    },
    onCloseTag: (name) => {
      depth--;
      if (name === "table") {
        // Count missing cells that an editor would add to make a rectangle.
        cells += Math.max(
          0,
          tableWidth * Math.max(rows, occupied.length) - tableCells,
        );
        if (occupied.length > 200 || cells > 2_000)
          throw new AppError(
            400,
            "TABLE_TOO_LARGE",
            "Tables support up to 200 rows, 40 columns and 2,000 cells per description.",
          );
        inTable = false;
      }
    },
  });
}

export function htmlToPlainText(html: string, max = 300): string {
  const spaced = html.replace(
    /<\/(?:td|th|tr|p|li|h[1-3])\s*>|<br\s*\/?\s*>/gi,
    " ",
  );
  const text = sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} });
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
