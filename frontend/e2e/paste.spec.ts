import { expect, test } from "@playwright/test";
import { createUser, uiLogin } from "./helpers";

test("pasting from a web page / Google Docs keeps headings, lists, bold/italic, links and code blocks", async ({ page, request }) => {
  const creds = await createUser(request);
  await uiLogin(page, creds);
  await page.getByTestId("add-task").click();
  const editor = page.locator(".ProseMirror");
  await editor.click();

  const html = `<meta charset="utf-8"><b style="font-weight:normal;" id="docs-internal-guid-1">
    <h2 dir="ltr" style="font-size:17pt;color:#f00"><span style="font-size:17pt;">Plan</span></h2>
    <ul><li dir="ltr"><p dir="ltr"><span style="font-weight:700;">Bold item</span></p></li><li><p><span style="font-style:italic;">Italic item</span></p></li></ul>
    <p>See <a href="https://example.com/doc" style="color:blue">the doc</a> now</p>
    <pre><code>const x = 1;</code></pre></b>`;
  await editor.evaluate((el, h) => {
    const data = new DataTransfer();
    data.setData("text/html", h);
    data.setData("text/plain", "Plan");
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, html);

  await expect(editor.locator("h2")).toHaveText("Plan");
  await expect(editor.locator("ul li")).toHaveCount(2);
  await expect(editor.locator("ul li strong, ul li b").first()).toHaveText("Bold item");
  await expect(editor.locator("ul li em, ul li i").first()).toHaveText("Italic item");
  await expect(editor.locator("a")).toHaveAttribute("href", "https://example.com/doc");
  await expect(editor.locator("pre code")).toContainText("const x = 1;");
  // unknown styles are dropped
  expect(await editor.innerHTML()).not.toContain("style=");
  expect(await editor.innerHTML()).not.toContain("docs-internal-guid");
});
