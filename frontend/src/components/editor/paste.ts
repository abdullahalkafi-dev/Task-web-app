import MarkdownIt from "markdown-it";

// Raw HTML in plain-text clipboard content must stay literal.
const markdown = new MarkdownIt({ html: false, linkify: false });
export const MAX_PASTE_CHARS = 500_000;
export const MAX_TABLE_CELLS = 2_000;
export const MAX_TABLE_COLUMNS = 40;
export const MAX_TABLE_ROWS = 200;
const allowed = new Set(
  "p br h1 h2 h3 strong b em i u s strike ul ol li blockquote code pre hr a img table thead tbody tfoot tr th td".split(
    " ",
  ),
);
const discard = new Set(
  "script style iframe object embed svg math template noscript".split(" "),
);
const escape = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function plainHtml(text: string): string {
  return text
    .split(/\n\s*\n/)
    .map((p) => `<p>${escape(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Parse spreadsheet TSV, including quoted tabs, line breaks and escaped quotes. */
function spreadsheet(text: string): string | null {
  if (!text.includes("\t")) return null;
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"' && (quoted || cell === "")) {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && (c === "\t" || c === "\n")) {
      row.push(cell);
      cell = "";
      if (c === "\n") {
        rows.push(row);
        row = [];
      }
    } else cell += c;
  }
  if (quoted) return null; // Ambiguous input: keep it as text.
  row.push(cell);
  if (row.some((c) => c !== "") || !text.endsWith("\n")) rows.push(row);
  if (
    rows.length < 2 ||
    rows[0].length < 2 ||
    rows.some((r) => r.length !== rows[0].length)
  )
    return null;
  return `<table><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td><p>${escape(c).replace(/\n/g, "<br>")}</p></td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

export function plainTextPaste(text: string): string {
  if (text.length > MAX_PASTE_CHARS)
    throw new Error("This paste is too large. Paste smaller sections.");
  const normalized = text.replace(/\r\n?/g, "\n");
  // A parsed table token is stronger evidence than pipes or separator-like text.
  const tokens = markdown.parse(normalized, {});
  for (const token of tokens.filter((t) => t.type === "table_open")) {
    if (!token.map) continue;
    const lines = normalized.split("\n").slice(...token.map);
    const count = (line: string): number => {
      const cells = line
        .trim()
        .replace(/^(?:>\s*)+/, "")
        .split(/(?<!\\)\|/);
      if (cells[0] === "") cells.shift();
      if (cells[cells.length - 1] === "") cells.pop();
      return cells.length;
    };
    // GFM otherwise discards cells beyond the header width. Reject instead of
    // losing information; the user can correct the source or paste it literally.
    if (lines.slice(2).some((line) => count(line) > count(lines[0])))
      throw new Error(
        "A table row has more cells than its header. Add the missing headers or paste as plain text (Ctrl/⌘+Shift+V).",
      );
  }
  if (tokens.some((t) => t.type === "table_open"))
    return markdown.renderer.render(tokens, markdown.options, {});
  // Never interpret tabs inside code fences as a spreadsheet.
  if (!tokens.some((t) => t.type === "fence" || t.type === "code_block")) {
    const table = spreadsheet(normalized);
    if (table) return table;
  }
  return plainHtml(normalized);
}

export function pasteSource(
  html: string,
  text: string,
  literal: boolean,
): string {
  if (literal) return plainHtml(text);
  // A lossy text alternative must not override a valid HTML table.
  if (html && /<(?:table|pre|strong|b|em|i|ul|ol|h[1-3])\b/i.test(html))
    return html;
  const converted = plainTextPaste(text);
  return html && !converted.includes("<table>") ? html : converted;
}

/** Normalize clipboard HTML before ProseMirror sees it; never silently truncate. */
export function cleanPastedHtml(html: string): {
  html: string;
  warning?: string;
} {
  if (html.length > MAX_PASTE_CHARS)
    throw new Error(
      "This paste is too large. Paste smaller sections (up to 500,000 characters).",
    );
  const doc = new DOMParser().parseFromString(html, "text/html");
  let warning: string | undefined;
  const elements = Array.from(doc.body.querySelectorAll("*"));
  if (
    elements.length > 10_000 ||
    elements.some((el) => {
      let depth = 0,
        parent = el.parentElement;
      while (parent) {
        depth++;
        parent = parent.parentElement;
        if (depth > 55) return true;
      }
      return false;
    })
  )
    throw new Error("This content is too complex. Paste smaller sections.");
  for (const caption of Array.from(doc.querySelectorAll("caption"))) {
    const table = caption.closest("table");
    const p = doc.createElement("p");
    p.append(...caption.childNodes);
    table?.before(p);
    caption.remove();
  }
  for (const el of elements) {
    const tag = el.tagName.toLowerCase();
    if (discard.has(tag)) {
      el.remove();
      continue;
    }
    if (!allowed.has(tag)) {
      if (
        ["div", "section", "article", "h4", "h5", "h6"].includes(tag) &&
        !el.querySelector(
          "p,div,section,article,table,ul,ol,blockquote,pre,h1,h2,h3",
        )
      ) {
        const p = doc.createElement("p");
        p.append(...el.childNodes);
        el.replaceWith(p);
        continue;
      }
      if (tag === "span") {
        let content: Node[] = Array.from(el.childNodes);
        const style = (el as HTMLElement).style;
        for (const [on, mark] of [
          [/bold|[6-9]00/.test(style.fontWeight), "strong"],
          [style.fontStyle === "italic", "em"],
          [
            (style.textDecoration + style.textDecorationLine).includes(
              "underline",
            ),
            "u",
          ],
          [
            (style.textDecoration + style.textDecorationLine).includes(
              "line-through",
            ),
            "s",
          ],
        ] as const) {
          if (on) {
            const wrapper = doc.createElement(mark);
            wrapper.append(...content);
            content = [wrapper];
          }
        }
        el.replaceWith(...content);
      } else el.replaceWith(...el.childNodes);
      continue;
    }
    // Retain semantic formatting from Docs/Office spans via the browser parser;
    // known inline font styles are understood by TipTap, all others are discarded.
    const attrs = new Map(Array.from(el.attributes, (a) => [a.name, a.value]));
    for (const attr of Array.from(el.attributes)) el.removeAttribute(attr.name);
    if (tag === "a") {
      const href = attrs.get("href")?.trim() ?? "";
      if (/^(https?:\/\/|mailto:)/i.test(href)) el.setAttribute("href", href);
    }
    if (tag === "img") {
      const src = attrs.get("src") ?? "";
      if (!/^(https?:\/\/|\/uploads\/)/i.test(src)) {
        el.replaceWith(doc.createTextNode(attrs.get("alt") || "[Image]"));
        warning =
          "Some embedded images could not be pasted. Use Insert image to upload them.";
      } else {
        el.setAttribute("src", src);
        el.setAttribute("alt", attrs.get("alt") ?? "");
      }
    }
    if (tag === "td" || tag === "th") {
      for (const name of ["colspan", "rowspan"]) {
        const value = attrs.get(name);
        if (
          value &&
          /^\d+$/.test(value) &&
          Number(value) > 0 &&
          Number(value) <=
            (name === "colspan" ? MAX_TABLE_COLUMNS : MAX_TABLE_ROWS)
        )
          el.setAttribute(name, value);
        else if (value && value !== "1")
          warning =
            "Invalid merged cells were simplified; cell contents were kept.";
      }
      const align =
        attrs.get("align") ||
        /text-align:\s*(left|center|right)/i
          .exec(attrs.get("style") ?? "")?.[1]
          ?.toLowerCase();
      if (align && ["left", "center", "right"].includes(align))
        el.setAttribute("align", align);
    }
  }
  // Nested tables cannot be edited predictably. Flatten just the nested structure,
  // retaining its text in the containing cell and tell the user what changed.
  for (const nested of Array.from(
    doc.querySelectorAll<HTMLTableElement>("table table"),
  ).reverse()) {
    const p = doc.createElement("p");
    p.textContent = Array.from(nested.rows, (r) =>
      Array.from(r.cells, (c) => c.textContent ?? "").join(" | "),
    ).join("\n");
    nested.replaceWith(p);
    warning = "Nested tables were converted to text inside their cells.";
  }
  let cells = 0;
  for (const table of Array.from(doc.querySelectorAll("table"))) {
    if (table.rows.length > MAX_TABLE_ROWS)
      throw new Error(
        "This table has too many rows. Paste up to 200 rows at a time.",
      );
    for (const row of Array.from(table.rows)) {
      const width = Array.from(row.cells).reduce(
        (sum, c) => sum + c.colSpan,
        0,
      );
      cells += Array.from(row.cells).reduce(
        (sum, c) => sum + c.colSpan * c.rowSpan,
        0,
      );
      if (width > MAX_TABLE_COLUMNS || cells > MAX_TABLE_CELLS)
        throw new Error(
          "This table is too large. Paste smaller sections (40 columns and 2,000 cells maximum).",
        );
    }
  }
  return { html: doc.body.innerHTML, warning };
}
