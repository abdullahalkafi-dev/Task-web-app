// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  cleanPastedHtml,
  plainTextPaste,
  pasteSource,
  MAX_PASTE_CHARS,
} from "./paste";
import { htmlToText } from "@/lib/html";

const parse = (html: string): Document =>
  new DOMParser().parseFromString(html, "text/html");
describe("structured paste", () => {
  it("prefers HTML tables even when the text alternative is malformed Markdown", () => {
    const html = "<table><tr><td>A</td><td>B</td></tr></table>";
    const text = "| A | B |\n| --- | --- |\n| One | Two | Three |";
    expect(pasteSource(html, text, false)).toBe(html);
    expect(pasteSource(html, text, true)).not.toContain("<table>");
  });
  it("converts mixed Markdown, empty cells, formatting, alignment and escaped pipes", () => {
    const doc = parse(
      cleanPastedHtml(
        plainTextPaste(
          "Before\n\n| Timeline | Details |\n| :--- | ---: |\n| **Month 1** | A \\| B |\n| Month 2 | |\n\nAfter",
        ),
      ).html,
    );
    expect(doc.querySelectorAll("tr")).toHaveLength(3);
    expect(doc.querySelector("strong")?.textContent).toBe("Month 1");
    expect(doc.querySelectorAll("td")[1].textContent).toBe("A | B");
    expect(doc.querySelector("th")?.getAttribute("align")).toBe("left");
    expect(doc.querySelectorAll("th")[1].getAttribute("align")).toBe("right");
    expect(doc.body.textContent).toContain("Before");
    expect(doc.body.textContent).toContain("After");
  });
  it("does not invent tables from pipes, code fences or ambiguous TSV", () => {
    for (const text of [
      "a | b",
      "```\n| a | b |\n| --- | --- |\n| x | y |\n```",
      "a\tb\nc",
      "a\tb",
    ])
      expect(plainTextPaste(text)).not.toContain("<table>");
    expect(plainTextPaste("<script>alert(1)</script>")).toContain(
      "&lt;script&gt;",
    );
  });
  it("refuses Markdown rows that would silently lose extra cells", () => {
    expect(() =>
      plainTextPaste("| A | B |\n| --- | --- |\n| One | Two | Three |"),
    ).toThrow("more cells");
  });
  it("handles quoted spreadsheet tabs, newlines, quotes and empty cells", () => {
    const doc = parse(
      plainTextPaste('A\tB\n"one\ttwo"\t"line 1\nline 2"\n"a""b"\t\n'),
    );
    expect(doc.querySelectorAll("tr")).toHaveLength(3);
    expect(doc.querySelectorAll("td")[2].textContent).toBe("one\ttwo");
    expect(doc.querySelectorAll("td")[3].querySelector("br")).not.toBeNull();
    expect(doc.querySelectorAll("td")[4].textContent).toBe('a"b');
  });
  it("strips dangerous markup, preserves safe merged cells and normalizes Docs formatting", () => {
    const { html, warning } = cleanPastedHtml(
      '<p><span style="font-weight:700;font-style:italic">Hello</span></p><script>x()</script><table style="width:9999px"><tr><th colspan="2" onclick="x()" align="center">Head</th></tr><tr><td>A</td><td><a href="javascript:alert(1)">B</a></td></tr></table><img src="data:image/png;base64,abc" alt="Diagram">',
    );
    expect(html).toContain("<strong>");
    expect(html).toContain("<em>");
    expect(html).toContain('colspan="2"');
    expect(html).toContain('align="center"');
    for (const unwanted of [
      "script",
      "onclick",
      "javascript:",
      "style=",
      "data:image",
    ])
      expect(html).not.toContain(unwanted);
    expect(html).toContain("Diagram");
    expect(warning).toBeTruthy();
  });
  it("keeps captions and nested contents with an explicit fallback", () => {
    const result = cleanPastedHtml(
      "<table><caption>Caption</caption><tr><td>Outer<table><tr><td>Inner A</td><td>Inner B</td></tr></table></td></tr></table>",
    );
    const doc = parse(result.html);
    expect(doc.querySelectorAll("table")).toHaveLength(1);
    expect(doc.body.textContent).toContain("Caption");
    expect(doc.body.textContent).toContain("Inner A | Inner B");
    expect(result.warning).toContain("Nested");
  });
  it("rejects oversized and excessively nested input without truncation", () => {
    expect(() => cleanPastedHtml("a".repeat(MAX_PASTE_CHARS + 1))).toThrow(
      "too large",
    );
    expect(() =>
      cleanPastedHtml(`<table>${"<tr><td>x</td></tr>".repeat(201)}</table>`),
    ).toThrow("rows");
    expect(() =>
      cleanPastedHtml(`<table><tr>${"<td>x</td>".repeat(41)}</tr></table>`),
    ).toThrow("too large");
    expect(() =>
      cleanPastedHtml(
        "<blockquote>".repeat(60) + "x" + "</blockquote>".repeat(60),
      ),
    ).toThrow("too complex");
  });
  it("keeps preview words separated at cell and paragraph boundaries", () => {
    expect(
      htmlToText(
        "<table><tr><td>Timeline</td><td>Details</td></tr><tr><td>Month 1</td><td>Design</td></tr></table>",
      ),
    ).toBe("Timeline Details Month 1 Design");
  });
  it("keeps block boundaries inside HTML cells", () => {
    const doc = parse(
      cleanPastedHtml(
        "<table><tr><td><div>A</div><div>B</div></td></tr></table>",
      ).html,
    );
    expect(doc.querySelectorAll("td p")).toHaveLength(2);
  });
});
