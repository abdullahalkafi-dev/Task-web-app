import { _electron as electron } from '@playwright/test';
import { mkdtemp, rm, mkdir } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
import { log } from 'node:console';

const root = path.resolve('test-results');
await mkdir(root, { recursive: true });
const profile = await mkdtemp(path.join(root, 'packaged-profile-'));
const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => key !== 'ELECTRON_RUN_AS_NODE' && value !== undefined));
let app;
try {
  app = await electron.launch({ executablePath: path.resolve('release/win-unpacked/Dayflow.exe'), args: [`--user-data-dir=${profile}`], env });
  const facts = await app.evaluate(({ app }) => ({ packaged: app.isPackaged, profile: app.getPath('userData') }));
  assert.equal(facts.packaged, true);
  assert.equal(path.resolve(facts.profile), path.resolve(profile));
  await app.firstWindow();
  let page;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    page = app.windows().find(p => p.url().startsWith('https://task-web-app.silverjeanscloth.com'));
    if (page) break;
    await delay(100);
  }
  assert.ok(page, 'Packaged executable must load the configured production origin');
  const shellOnly = process.argv.includes('--shell-only');
  if (!shellOnly) await page.getByRole('button', { name: 'Sign in with your browser' }).waitFor({ state: 'visible', timeout: 30_000 });
  const bridge = await page.evaluate(() => globalThis.dayflowDesktop.getState());
  assert.equal(bridge.version, 1);
  await page.screenshot({ path: 'test-results/packaged-sign-in.png' });
  log(shellOnly ? 'Packaged shell: production origin, isolated profile and bridge passed. Hosted desktop sign-in requires deployment.' : 'Packaged executable: production origin, isolated profile, bridge and browser sign-in screen passed.');
} finally {
  if (app) { await app.evaluate(({ app }) => app.exit(0)).catch(() => undefined); await app.close().catch(() => undefined); }
  assert.equal(path.dirname(path.resolve(profile)), root, 'Refusing unexpected cleanup target');
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
