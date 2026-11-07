// Read-only release smoke check, run inside dayflow-api after deployment.
// No accounts, clipboard content or persisted documents are created.
const assert = require('node:assert/strict');
const { sanitizeRichHtml, htmlToPlainText, assertRichContentCompatible } = require('./dist/utils/sanitize');
async function main() {
  const input = '<table><tr><th colspan="2" align="center">Header</th></tr><tr><td>A</td><td><strong>B</strong></td></tr></table>';
  const html = sanitizeRichHtml(input);
  assert.match(html, /<table>/);
  assert.match(html, /colspan="2"/);
  assert.match(html, /align="center"/);
  assert.equal(htmlToPlainText(html), 'Header A B');
  assert.throws(() => assertRichContentCompatible(html, '<p>HeaderAB</p>', false), /Refresh Dayflow/);
  assert.doesNotThrow(() => assertRichContentCompatible(html, '', true));
  assert.throws(() => sanitizeRichHtml(`<table><tr>${'<td>A</td>'.repeat(41)}</tr></table>`), /40 columns/);
  console.log('PASS: deployed sanitizer, table preview, size limits and legacy protection');
  const origin = 'https://task-web-app.silverjeanscloth.com';
  const response = await fetch(origin);
  assert.equal(response.status, 200);
  const page = await response.text();
  const scripts = [...new Set(Array.from(page.matchAll(/<script[^>]+src="([^\"]+)"/g), m => m[1]).filter(src => src.startsWith('/_next/static/')))];
  assert.ok(scripts.length > 0);
  const sources = await Promise.all(scripts.map(async src => {
    const asset = await fetch(new URL(src, origin));
    assert.equal(asset.status, 200, `Asset ${src}`);
    return asset.text();
  }));
  assert.ok(sources.some(source => source.includes('tables-v1')), 'Table-capable API bundle');
  assert.ok(sources.some(source => source.includes('Table limit reached')), 'Updated editor bundle');
  console.log(`PASS: homepage and ${scripts.length} JavaScript assets, table editor and capability declaration`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
