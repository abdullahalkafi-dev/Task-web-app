import { describe, expect, it } from "vitest";
import {
  assertRichContentCompatible,
  htmlToPlainText,
  sanitizeRichHtml,
} from "./sanitize";

describe("rich table safety", () => {
  it("preserves table structure and bounded spans, removing foreign styles and unsafe attributes", () => {
    const html = sanitizeRichHtml(
      '<table style="width:99999px"><thead><tr><th colspan="2" align="center" onclick="bad()">Header</th></tr></thead><tbody><tr><td rowspan="2">A</td><td><strong>B</strong></td></tr><tr><td><a href="javascript:alert(1)">C</a></td></tr></tbody></table>',
    );
    expect(html).toContain("<table>");
    expect(html).toContain('colspan="2"');
    expect(html).toContain('rowspan="2"');
    expect(html).toContain('align="center"');
    for (const value of ["style=", "onclick", "javascript:"])
      expect(html).not.toContain(value);
    expect(htmlToPlainText(html)).toBe("Header A B C");
  });
  it("normalizes invalid cell attributes and rejects nested or excessive tables", () => {
    expect(
      sanitizeRichHtml(
        '<table><tr><td colspan="999999" rowspan="-1" align="evil">A</td></tr></table>',
      ),
    ).not.toContain("span=");
    expect(() =>
      sanitizeRichHtml(
        "<table><tr><td><table><tr><td>A</td></tr></table></td></tr></table>",
      ),
    ).toThrow("Nested");
    expect(() =>
      sanitizeRichHtml(`<table>${"<tr><td>x</td></tr>".repeat(201)}</table>`),
    ).toThrow("200 rows");
    expect(() =>
      sanitizeRichHtml(`<table><tr>${"<td>x</td>".repeat(41)}</tr></table>`),
    ).toThrow("40 columns");
  });
  it("protects tables from legacy rewrites while allowing metadata-only and capable edits", () => {
    const html = "<table><tr><td>A</td></tr></table>";
    expect(() => assertRichContentCompatible(html, "<p>A</p>", false)).toThrow(
      "Refresh Dayflow",
    );
    expect(() => assertRichContentCompatible(html, html, false)).not.toThrow();
    expect(() => assertRichContentCompatible(html, "", true)).not.toThrow();
    expect(() =>
      assertRichContentCompatible("<p>Old</p>", "<p>New</p>", false),
    ).not.toThrow();
  });
});
