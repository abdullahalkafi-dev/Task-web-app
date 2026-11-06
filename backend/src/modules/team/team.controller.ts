import { catchAsync } from "../../utils/catchAsync";
import * as service from "./team.service";
import * as schemas from "./team.validation";
export const list = catchAsync(async (req, res) => {
  res.json({ teams: await service.listTeams(req.user.id) });
});
export const create = catchAsync(async (req, res) => {
  res
    .status(201)
    .json({
      team: await service.createTeam(
        req.user.id,
        schemas.teamNameSchema.parse(req.body).name,
      ),
    });
});
export const detail = catchAsync(async (req, res) => {
  res.json({ team: await service.getTeam(req.params.id, req.user.id) });
});
export const remove = catchAsync(async (req, res) => {
  await service.deleteTeam(
    req.params.id,
    req.user.id,
    schemas.deleteTeamSchema.parse(req.body).name,
  );
  res.json({ ok: true });
});
export const invites = catchAsync(async (req, res) => {
  res.json({ invites: await service.pendingInvites(req.user.id) });
});
export const invite = catchAsync(async (req, res) => {
  res
    .status(201)
    .json({
      invite: await service.invite(
        req.params.id,
        req.user.id,
        schemas.inviteSchema.parse(req.body).email,
      ),
    });
});
export const cancelInvite = catchAsync(async (req, res) => {
  await service.cancelInvite(req.params.id, req.user.id, req.params.inviteId);
  res.json({ ok: true });
});
export const accept = catchAsync(async (req, res) => {
  await service.respondInvite(req.params.id, req.user.id, true);
  res.json({ ok: true });
});
export const decline = catchAsync(async (req, res) => {
  await service.respondInvite(req.params.id, req.user.id, false);
  res.json({ ok: true });
});
export const leave = catchAsync(async (req, res) => {
  await service.leaveTeam(req.params.id, req.user.id);
  res.json({ ok: true });
});
export const removeMember = catchAsync(async (req, res) => {
  await service.leaveTeam(req.params.id, req.user.id, req.params.userId);
  res.json({ ok: true });
});
export const tasks = catchAsync(async (req, res) => {
  res.json({ tasks: await service.listTasks(req.params.id, req.user.id) });
});
export const task = catchAsync(async (req, res) => {
  res.json({
    task: await service.getTask(req.params.id, req.user.id, req.params.taskId),
  });
});
export const createTask = catchAsync(async (req, res) => {
  res
    .status(201)
    .json({
      task: await service.createTask(
        req.params.id,
        req.user.id,
        schemas.createTaskSchema.parse(req.body),
      ),
    });
});
export const patchTask = catchAsync(async (req, res) => {
  res.json({
    task: await service.patchTask(
      req.params.id,
      req.user.id,
      req.params.taskId,
      schemas.patchTaskSchema.parse(req.body),
    ),
  });
});
export const removeTask = catchAsync(async (req, res) => {
  await service.removeTask(
    req.params.id,
    req.user.id,
    req.params.taskId,
    schemas.versionSchema.parse(req.body).version,
  );
  res.json({ ok: true });
});
export const restore = catchAsync(async (req, res) => {
  res.json({
    task: await service.restoreTask(
      req.params.id,
      req.user.id,
      req.params.taskId,
      schemas.versionSchema.parse(req.body).version,
    ),
  });
});
export const history = catchAsync(async (req, res) => {
  const q = schemas.pageSchema.parse(req.query);
  res.json(
    await service.history(req.params.id, req.user.id, q.page, q.q, q.kind),
  );
});
export const events = catchAsync(async (req, res) => {
  res.json(
    await service.timeline(req.params.id, req.user.id, req.params.taskId),
  );
});
export const messages = catchAsync(async (req, res) => {
  res.json(
    await service.messages(
      req.params.id,
      req.user.id,
      req.params.taskId,
      schemas.messageQuerySchema.parse(req.query).before,
    ),
  );
});
export const sendMessage = catchAsync(async (req, res) => {
  await service.sendMessage(
    req.params.id,
    req.user.id,
    req.params.taskId,
    schemas.messageSchema.parse(req.body),
  );
  res.status(201).json({ ok: true });
});
export const read = catchAsync(async (req, res) => {
  await service.markRead(
    req.params.id,
    req.user.id,
    req.params.taskId,
    schemas.readSchema.parse(req.body).messageId,
  );
  res.json({ ok: true });
});
export const upload = catchAsync(async (req, res) => {
  res
    .status(201)
    .json(await service.upload(req.params.id, req.user.id, req.file));
});
export const serveImage = catchAsync(async (req, res) => {
  const file = await service.resolveImage(
    req.params.id,
    req.user.id,
    req.params.file,
  );
  res.sendFile(file, {
    cacheControl: false,
    headers: {
      "Cache-Control": "private, no-store",
      Vary: "Cookie, Authorization",
    },
  });
});
