// Run inside the Dayflow API container after deployment. No account/data writes.
// A 30-second token for a random nonexistent user tests authenticated SSE transport;
// neither the token nor signing secret is printed or written to disk.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const origin = 'https://task-web-app.silverjeanscloth.com';
(async () => {
  for (const [pathname, expected] of [['/api/health', 200], ['/desktop/connect', 200], ['/api/sync/events', 401]]) {
    const response = await fetch(`${origin}${pathname}`, { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, expected, pathname);
    await response.body?.cancel();
    console.log(`${pathname}: ${expected}`);
  }
  const invalid = await fetch(`${origin}/api/auth/desktop/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challenge: 'invalid' }), signal: AbortSignal.timeout(10000) });
  assert.equal(invalid.status, 400); await invalid.body?.cancel();
  console.log('Desktop auth route: validation active');
  const worker = await fetch(`${origin}/sw.js`, { signal: AbortSignal.timeout(10000) });
  assert.equal(worker.status, 200);
  const workerSource = await worker.text();
  assert.equal(workerSource.includes('shell-v1'), false, 'Cached HTML must have a fresh build revision');
  assert.ok(workerSource.includes('/desktop/connect'));
  console.log('Service worker: fresh HTML shell revision and desktop route present');
  const token = jwt.sign({ sub: randomUUID(), email: 'release-probe@dayflow.invalid', role: 'user' }, process.env.JWT_SECRET, { algorithm: 'HS256', expiresIn: '30s' });
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]);
  const began = Date.now();
  try {
    const response = await fetch(`${origin}/api/sync/events`, { headers: { Authorization: `Bearer ${token}` }, signal });
    assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /text\/event-stream/);
    const reader = response.body.getReader();
    let frame = '';
    while (!frame.includes('\n\n')) {
      const chunk = await reader.read(); assert.equal(chunk.done, false);
      frame += new TextDecoder().decode(chunk.value);
    }
    assert.match(frame, /event: change/);
    console.log(`Authenticated SSE initial event streamed through public nginx/Next.js in ${Date.now() - began}ms`);
    await reader.cancel();
  } finally { controller.abort(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
