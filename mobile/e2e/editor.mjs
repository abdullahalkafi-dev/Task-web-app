// Exercise the actual bundled WebView editor in Chromium with its native bridge
// replaced by a message collector. No account/session is present in this page.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { EDITOR_HTML } from '../src/generated/editor.ts';
const require=createRequire(new URL('../../frontend/package.json',import.meta.url));
const {chromium}=require('@playwright/test');
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  await page.evaluate(()=>{window.messages=[];window.ReactNativeWebView={postMessage:value=>window.messages.push(JSON.parse(value))};});
  await page.setContent(EDITOR_HTML);
  await page.waitForFunction(()=>window.messages.some(message=>message.type==='ready'));
  const data='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB1cAAAAASUVORK5CYII=';
  await page.evaluate(data=>{
    window.dayflowReceive({type:'set',html:'<h2>Website heading</h2><p><strong>Bold</strong> and <a href="https://example.com">link</a></p><img src="local:first" data-local-id="first"><img src="local:second" data-local-id="second">'});
    window.dayflowReceive({type:'image',original:'local:first',data});
    window.dayflowReceive({type:'image',original:'local:second',data});
    window.dayflowReceive({type:'flush',requestId:'identity'});
  },data);
  const saved=await page.evaluate(()=>window.messages.find(message=>message.type==='flushed'&&message.requestId==='identity'));
  assert.match(saved.html,/<h2>Website heading<\/h2>/);
  assert.match(saved.html,/<strong>Bold<\/strong>/);
  assert.match(saved.html,/href="https:\/\/example.com"/);
  assert.match(saved.html,/<img[^>]+src="local:first"[^>]+data-local-id="first"/);
  assert.match(saved.html,/<img[^>]+src="local:second"[^>]+data-local-id="second"/);
  assert.doesNotMatch(saved.html,/data:image|data-dayflow-source|file:\/\//);
  assert.equal(await page.evaluate(()=>window.messages.filter(message=>message.type==='change').length),0,'Displaying cached images must not create document edits');
  assert.equal(await page.locator('img').count(),2);
  assert.equal(await page.locator('img').first().getAttribute('src'),data);
  await page.evaluate(()=>window.dayflowReceive({type:'set',html:'<p>Edit on Android</p>'}));
  await page.locator('[contenteditable="true"]').fill('Edited on Android');
  await page.evaluate(()=>window.dayflowReceive({type:'flush',requestId:'edit'}));
  const edited=await page.evaluate(()=>window.messages.find(message=>message.type==='flushed'&&message.requestId==='edit'));
  assert.equal(edited.text,'Edited on Android');
  console.log('PASS bundled editor formatting, identical-image identity, canonical HTML and edit/flush');
}finally{await browser.close();}
