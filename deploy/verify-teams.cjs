// Run inside the deployed Dayflow API container. Read-only; no accounts or content are created.
const assert = require('node:assert/strict');
const path = require('node:path');
const mongoose = require('mongoose');
const origin = 'https://task-web-app.silverjeanscloth.com';
const id = '00000000-0000-4000-8000-000000000000';
(async () => {
  for (const [pathname, expected] of [
    ['/api/health', 200], ['/login', 200], ['/teams', 200], ['/desktop/connect', 200],
    ['/api/teams', 401], ['/api/teams/invites', 401], [`/api/teams/${id}/tasks`, 401],
    [`/api/teams/${id}/history`, 401], [`/api/teams/${id}/tasks/${id}/messages`, 401],
    [`/uploads/teams/${id}/${id}.webp`, 401], ['/api/sync/events', 401],
  ]) {
    const response = await fetch(`${origin}${pathname}`, { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, expected, pathname);
    await response.body?.cancel();
    console.log(`${pathname}: ${expected}`);
  }
  const response = await fetch(`${origin}/sw.js`, { signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, 200);
  assert.ok((await response.text()).includes('/uploads/teams/'), 'Team image network-only rule must be in deployed worker');
  console.log('Service worker contains separate team-image rule');
  const models = require(path.resolve('dist/modules/team/team.model.js'));
  await mongoose.connect(process.env.MONGO_URI);
  for (const [name, required] of [['TeamMemberModel', 'teamId_1_userId_1'], ['TeamInviteModel', 'teamId_1_invitedUserId_1'], ['TeamTaskModel', 'teamId_1_removedAt_1_archivedAt_1_orderIndex_1'], ['TeamMessageModel', 'teamId_1_taskId_1_createdAt_-1__id_-1'], ['TeamTaskReadModel', 'taskId_1_userId_1']]) {
    const indexes = await models[name].collection.indexes();
    assert.ok(indexes.some(index => index.name === required), `${name}: ${required}`);
    console.log(`${name}: required index present`);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => mongoose.disconnect());
