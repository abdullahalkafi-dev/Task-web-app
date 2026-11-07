import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import type {
  TeamDetail,
  TeamHistory,
  TeamInvite,
  TeamMember,
  TeamMessage,
  TeamPerson,
  TeamSummary,
  TeamTask,
  TeamTaskEvent,
  TeamTaskInput,
  TeamTaskPatch,
} from "@dayflow/shared";
import { config } from "../../config/env";
import { AppError } from "../../utils/AppError";
import { assertRichContentCompatible, htmlToPlainText, sanitizeRichHtml } from "../../utils/sanitize";
import { notifyUser } from "../sync/sync.events";
import { UserModel } from "../user/user.model";
import type { ITeam, ITeamInvite, ITeamTask } from "./team.interface";
import {
  TeamModel,
  TeamMemberModel,
  TeamInviteModel,
  TeamTaskModel,
  TeamMessageModel,
  TeamTaskReadModel,
  TeamUploadModel,
} from "./team.model";

// Serializes membership and task writes for the current single-process deployment.
// Membership is always rechecked inside the lock, including after an image is processed.
const queues = new Map<string, Promise<void>>();
async function locked<T>(teamId: string, action: () => Promise<T>): Promise<T> {
  const previous = queues.get(teamId) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  queues.set(teamId, current);
  await previous;
  try {
    return await action();
  } finally {
    release();
    if (queues.get(teamId) === current) queues.delete(teamId);
  }
}
export async function requireMember(
  teamId: string,
  userId: string,
): Promise<ITeam> {
  const [team, member] = await Promise.all([
    TeamModel.findOne({ _id: teamId, deletedAt: null }).lean(),
    TeamMemberModel.exists({ teamId, userId, leftAt: null }),
  ]);
  if (!team || !member)
    throw new AppError(
      403,
      "TEAM_ACCESS",
      "You no longer have access to this team.",
    );
  return team;
}
async function withMember<T>(
  teamId: string,
  userId: string,
  action: (team: ITeam) => Promise<T>,
): Promise<T> {
  return locked(teamId, async () =>
    action(await requireMember(teamId, userId)),
  );
}
function requireCreator(team: ITeam, userId: string): void {
  if (team.creatorId !== userId)
    throw new AppError(
      403,
      "CREATOR_ONLY",
      "Only the team creator can do this.",
    );
}
export async function notifyTeam(teamId: string): Promise<void> {
  if (!(await TeamModel.exists({ _id: teamId, deletedAt: null }))) return;
  const members = await TeamMemberModel.find({ teamId, leftAt: null })
    .select("userId")
    .lean();
  for (const member of members) notifyUser(member.userId);
}
async function people(ids: string[]): Promise<TeamPerson[]> {
  const users = await UserModel.find({ _id: { $in: [...new Set(ids)] } })
    .select("name email")
    .lean();
  return users.map((u) => ({
    id: u._id,
    name: u.name || u.email.split("@")[0],
    email: u.email,
  }));
}
async function members(teamId: string): Promise<TeamMember[]> {
  const rows = await TeamMemberModel.find({ teamId, leftAt: null })
    .sort({ joinedAt: 1 })
    .lean();
  const users = new Map(
    (await people(rows.map((r) => r.userId))).map((u) => [u.id, u]),
  );
  return rows.flatMap((r) => {
    const u = users.get(r.userId);
    return u ? [{ ...u, joinedAt: r.joinedAt.toISOString() }] : [];
  });
}
async function summary(team: ITeam): Promise<TeamSummary> {
  return {
    id: team._id,
    name: team.name,
    creatorId: team.creatorId,
    createdAt: team.createdAt.toISOString(),
    members: await members(team._id),
    openTaskCount: await TeamTaskModel.countDocuments({
      teamId: team._id,
      removedAt: null,
      archivedAt: null,
      status: { $ne: "completed" },
    }),
  };
}
async function inviteDTO(
  invite: ITeamInvite,
  team: ITeam,
): Promise<TeamInvite> {
  const users = await people([invite.invitedBy, invite.invitedUserId]);
  const fallback = (id: string): TeamPerson => ({
    id,
    name: "Former member",
    email: "",
  });
  return {
    id: invite._id,
    teamId: team._id,
    teamName: team.name,
    invitedUserId: invite.invitedUserId,
    invitedBy:
      users.find((u) => u.id === invite.invitedBy) ??
      fallback(invite.invitedBy),
    invitedUser:
      users.find((u) => u.id === invite.invitedUserId) ??
      fallback(invite.invitedUserId),
    createdAt: invite.createdAt.toISOString(),
  };
}
export async function createTeam(
  userId: string,
  name: string,
): Promise<TeamDetail> {
  const team = await TeamModel.create({ name, creatorId: userId });
  try {
    await TeamMemberModel.create({ teamId: team._id, userId });
  } catch (error) {
    await TeamModel.deleteOne({ _id: team._id });
    throw error;
  }
  notifyUser(userId);
  return {
    ...(await summary(team.toObject())),
    invites: [],
    people: await people([userId]),
  };
}
export async function listTeams(userId: string): Promise<TeamSummary[]> {
  const memberships = await TeamMemberModel.find({
    userId,
    leftAt: null,
  }).lean();
  const teams = await TeamModel.find({
    _id: { $in: memberships.map((m) => m.teamId) },
    deletedAt: null,
  })
    .sort({ createdAt: 1 })
    .lean();
  return Promise.all(teams.map(summary));
}
export async function getTeam(
  teamId: string,
  userId: string,
): Promise<TeamDetail> {
  const team = await requireMember(teamId, userId);
  const invites = await TeamInviteModel.find({ teamId, status: "pending" })
    .sort({ createdAt: 1 })
    .lean();
  const allMembers = await TeamMemberModel.find({ teamId })
    .select("userId")
    .lean();
  return {
    ...(await summary(team)),
    invites: await Promise.all(invites.map((i) => inviteDTO(i, team))),
    people: await people(allMembers.map((m) => m.userId)),
  };
}
export async function pendingInvites(userId: string): Promise<TeamInvite[]> {
  const invites = await TeamInviteModel.find({
    invitedUserId: userId,
    status: "pending",
  })
    .sort({ createdAt: -1 })
    .lean();
  const teams = new Map(
    (
      await TeamModel.find({
        _id: { $in: invites.map((i) => i.teamId) },
        deletedAt: null,
      }).lean()
    ).map((t) => [t._id, t]),
  );
  return Promise.all(
    invites.flatMap((i) => {
      const team = teams.get(i.teamId);
      return team ? [inviteDTO(i, team)] : [];
    }),
  );
}
export async function invite(
  teamId: string,
  userId: string,
  email: string,
): Promise<TeamInvite> {
  return withMember(teamId, userId, async (team) => {
    const target = await UserModel.findOne({ email }).lean();
    if (!target)
      throw new AppError(
        404,
        "NO_ACCOUNT",
        "No Dayflow account with this email.",
      );
    if (
      await TeamMemberModel.exists({ teamId, userId: target._id, leftAt: null })
    )
      throw new AppError(
        409,
        "ALREADY_MEMBER",
        "This person is already a member.",
      );
    if (
      await TeamInviteModel.exists({
        teamId,
        invitedUserId: target._id,
        status: "pending",
      })
    )
      throw new AppError(
        409,
        "INVITE_PENDING",
        "An invitation is already pending.",
      );
    const recent = await TeamInviteModel.exists({
      teamId,
      invitedUserId: target._id,
      createdAt: { $gt: new Date(Date.now() - 60 * 60 * 1000) },
    });
    if (recent)
      throw new AppError(
        429,
        "INVITE_COOLDOWN",
        "Please wait an hour before inviting this person again.",
      );
    const row = await TeamInviteModel.create({
      teamId,
      invitedUserId: target._id,
      invitedBy: userId,
    });
    notifyUser(target._id);
    await notifyTeam(teamId);
    return inviteDTO(row.toObject(), team);
  });
}
export async function respondInvite(
  inviteId: string,
  userId: string,
  accept: boolean,
): Promise<void> {
  const initial = await TeamInviteModel.findOne({
    _id: inviteId,
    invitedUserId: userId,
  }).lean();
  if (!initial) throw new AppError(404, "NOT_FOUND", "Invitation not found.");
  await locked(initial.teamId, async () => {
    const row = await TeamInviteModel.findOne({
      _id: inviteId,
      invitedUserId: userId,
      status: "pending",
    }).lean();
    const team = await TeamModel.findOne({
      _id: initial.teamId,
      deletedAt: null,
    }).lean();
    if (!row || !team)
      throw new AppError(
        409,
        "INVITE_CLOSED",
        "This invitation is no longer available.",
      );
    if (
      accept &&
      !(await TeamMemberModel.exists({
        teamId: row.teamId,
        userId,
        leftAt: null,
      }))
    )
      await TeamMemberModel.create({ teamId: row.teamId, userId });
    await TeamInviteModel.updateOne(
      { _id: inviteId, status: "pending" },
      {
        $set: {
          status: accept ? "accepted" : "declined",
          respondedAt: new Date(),
        },
      },
    );
    notifyUser(userId);
    await notifyTeam(row.teamId);
  });
}
export async function cancelInvite(
  teamId: string,
  userId: string,
  inviteId: string,
): Promise<void> {
  await withMember(teamId, userId, async () => {
    const row = await TeamInviteModel.findOneAndUpdate(
      { _id: inviteId, teamId, status: "pending" },
      { $set: { status: "cancelled", respondedAt: new Date() } },
    ).lean();
    if (!row) throw new AppError(404, "NOT_FOUND", "Invitation not found.");
    notifyUser(row.invitedUserId);
    await notifyTeam(teamId);
  });
}
function event(
  actorId: string | null,
  type: TeamTaskEvent["type"],
  from: string | null = null,
  to: string | null = null,
): TeamTaskEvent {
  return {
    id: randomUUID(),
    actorId,
    type,
    from,
    to,
    at: new Date().toISOString(),
  };
}
export async function leaveTeam(
  teamId: string,
  actorId: string,
  targetId = actorId,
): Promise<void> {
  await withMember(teamId, actorId, async (team) => {
    if (targetId === team.creatorId)
      throw new AppError(
        400,
        "CREATOR_CANNOT_LEAVE",
        "The creator can delete the team, but cannot leave it.",
      );
    if (targetId !== actorId) requireCreator(team, actorId);
    const row = await TeamMemberModel.findOneAndUpdate(
      { teamId, userId: targetId, leftAt: null },
      {
        $set: {
          leftAt: new Date(),
          removedBy: actorId === targetId ? null : actorId,
        },
      },
    ).lean();
    if (!row) throw new AppError(404, "NOT_FOUND", "Member not found.");
    await TeamTaskModel.updateMany(
      { teamId, assigneeId: targetId },
      {
        $set: { assigneeId: null, updatedAt: new Date() },
        $inc: { version: 1 },
        $push: { events: event(actorId, "assigned", targetId, null) },
      },
    );
    await TeamTaskReadModel.deleteMany({ teamId, userId: targetId });
    notifyUser(targetId);
    await notifyTeam(teamId);
  });
}
function teamDirectory(teamId: string): string {
  if (!/^[a-f0-9-]{36}$/.test(teamId))
    throw new AppError(400, "INVALID_ID", "Invalid team.");
  return path.resolve(config.UPLOAD_ROOT, "teams", teamId);
}
export async function deleteTeam(
  teamId: string,
  userId: string,
  name: string,
): Promise<void> {
  await withMember(teamId, userId, async (team) => {
    requireCreator(team, userId);
    if (name !== team.name)
      throw new AppError(
        400,
        "NAME_MISMATCH",
        "Type the team name exactly to confirm deletion.",
      );
    const recipients = new Set([
      ...(await TeamMemberModel.find({ teamId, leftAt: null }).lean()).map(
        (m) => m.userId,
      ),
      ...(await TeamInviteModel.find({ teamId, status: "pending" }).lean()).map(
        (i) => i.invitedUserId,
      ),
    ]);
    // Revoke access before cleanup. Never touch personal uploads or other teams.
    await TeamModel.updateOne(
      { _id: teamId },
      { $set: { deletedAt: new Date() } },
    );
    await cleanupTeam(teamId);
    recipients.forEach(notifyUser);
  });
}
async function cleanupTeam(teamId: string): Promise<void> {
  const directory = teamDirectory(teamId);
  const root = path.resolve(config.UPLOAD_ROOT, "teams");
  if (path.dirname(directory) !== root)
    throw new Error("Team cleanup escaped upload root");
  await fs.rm(directory, { recursive: true, force: true });
  await Promise.all([
    TeamTaskModel.deleteMany({ teamId }),
    TeamMessageModel.deleteMany({ teamId }),
    TeamTaskReadModel.deleteMany({ teamId }),
    TeamUploadModel.deleteMany({ teamId }),
    TeamInviteModel.deleteMany({ teamId }),
    TeamMemberModel.deleteMany({ teamId }),
  ]);
}
function cleanHtml(teamId: string, html: string): string {
  const clean = sanitizeRichHtml(html);
  for (const match of clean.matchAll(/<img[^>]+src="([^"]+)"/g)) {
    if (
      !new RegExp(`^/uploads/teams/${teamId}/[a-f0-9-]{36}\\.(webp|gif)$`).test(
        match[1],
      )
    )
      throw new AppError(
        400,
        "TEAM_IMAGE",
        "Upload images to this team before sharing them.",
      );
  }
  return clean;
}
async function checkAssignee(
  teamId: string,
  assigneeId: string | null | undefined,
): Promise<void> {
  if (
    assigneeId &&
    !(await TeamMemberModel.exists({
      teamId,
      userId: assigneeId,
      leftAt: null,
    }))
  )
    throw new AppError(
      400,
      "INVALID_ASSIGNEE",
      "Choose a current team member.",
    );
}
async function taskRecord(teamId: string, taskId: string): Promise<ITeamTask> {
  const task = await TeamTaskModel.findOne({ _id: taskId, teamId }).lean();
  if (!task) throw new AppError(404, "NOT_FOUND", "Task not found.");
  return task;
}
async function taskDTOs(
  tasks: ITeamTask[],
  userId: string,
): Promise<TeamTask[]> {
  const ids = tasks.map((t) => t._id);
  const [counts, reads] = await Promise.all([
    TeamMessageModel.aggregate<{
      _id: string;
      count: number;
      latestOther: Date | null;
    }>([
      { $match: { taskId: { $in: ids }, deletedAt: null } },
      {
        $group: {
          _id: "$taskId",
          count: { $sum: 1 },
          latestOther: {
            $max: {
              $cond: [{ $ne: ["$authorId", userId] }, "$createdAt", null],
            },
          },
        },
      },
    ]),
    TeamTaskReadModel.find({ taskId: { $in: ids }, userId }).lean(),
  ]);
  const countMap = new Map(counts.map((c) => [c._id, c]));
  const readMap = new Map(reads.map((r) => [r.taskId, r.lastReadAt]));
  return tasks.map((t) => {
    const count = countMap.get(t._id);
    const read = readMap.get(t._id);
    return {
      id: t._id,
      teamId: t.teamId,
      title: t.title,
      descriptionHtml: t.descriptionHtml,
      descriptionText: t.descriptionText,
      status: t.status,
      orderIndex: t.orderIndex,
      createdBy: t.createdBy,
      assigneeId: t.assigneeId,
      estimatedDays: t.estimatedDays,
      startedAt: t.startedAt?.toISOString() ?? null,
      completedAt: t.completedAt?.toISOString() ?? null,
      completedBy: t.completedBy,
      archivedAt: t.archivedAt?.toISOString() ?? null,
      removedAt: t.removedAt?.toISOString() ?? null,
      removedBy: t.removedBy,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      version: t.version,
      messageCount: count?.count ?? 0,
      unread: !!count?.latestOther && (!read || count.latestOther > read),
    };
  });
}
export async function archiveTeam(teamId: string): Promise<void> {
  const now = new Date();
  const result = await TeamTaskModel.updateMany(
    {
      teamId,
      status: "completed",
      removedAt: null,
      archivedAt: null,
      completedAt: { $lte: new Date(now.getTime() - 86400000) },
    },
    {
      $set: { archivedAt: now, updatedAt: now },
      $inc: { version: 1 },
      $push: { events: event(null, "archived") },
    },
  );
  if (result.modifiedCount) await notifyTeam(teamId);
}
export async function maintainTeams(): Promise<void> {
  const teams = await TeamModel.find().select("deletedAt").lean();
  for (const team of teams)
    await locked(team._id, () =>
      team.deletedAt ? cleanupTeam(team._id) : archiveTeam(team._id),
    );
}
export async function listTasks(
  teamId: string,
  userId: string,
): Promise<TeamTask[]> {
  return withMember(teamId, userId, async () => {
    await archiveTeam(teamId);
    return taskDTOs(
      await TeamTaskModel.find({ teamId, removedAt: null, archivedAt: null })
        .select("-events")
        .sort({ orderIndex: 1, createdAt: 1 })
        .lean(),
      userId,
    );
  });
}
export async function getTask(
  teamId: string,
  userId: string,
  taskId: string,
): Promise<TeamTask> {
  await requireMember(teamId, userId);
  return (await taskDTOs([await taskRecord(teamId, taskId)], userId))[0];
}
export async function createTask(
  teamId: string,
  userId: string,
  input: TeamTaskInput,
): Promise<TeamTask> {
  return withMember(teamId, userId, async () => {
    await checkAssignee(teamId, input.assigneeId);
    const html = cleanHtml(teamId, input.descriptionHtml);
    const last = await TeamTaskModel.findOne({
      teamId,
      removedAt: null,
      archivedAt: null,
    })
      .sort({ orderIndex: -1 })
      .lean();
    const now = new Date();
    const task = await TeamTaskModel.create({
      ...input,
      teamId,
      createdBy: userId,
      descriptionHtml: html,
      descriptionText: htmlToPlainText(html),
      orderIndex: (last?.orderIndex ?? 0) + 1024,
      startedAt: input.status === "in_progress" ? now : null,
      completedAt: input.status === "completed" ? now : null,
      completedBy: input.status === "completed" ? userId : null,
      events: [event(userId, "created")],
    });
    await notifyTeam(teamId);
    return (await taskDTOs([task.toObject()], userId))[0];
  });
}
export class TeamConflict extends AppError {
  constructor(public readonly task: TeamTask) {
    super(
      409,
      "TASK_CONFLICT",
      "Someone updated this task. Review their changes.",
      { task },
    );
  }
}
async function checkVersion(
  task: ITeamTask,
  version: number,
  userId: string,
): Promise<void> {
  if (task.version !== version)
    throw new TeamConflict((await taskDTOs([task], userId))[0]);
}
export async function patchTask(
  teamId: string,
  userId: string,
  taskId: string,
  input: TeamTaskPatch,
  supportsTables = false,
): Promise<TeamTask> {
  return withMember(teamId, userId, async () => {
    await archiveTeam(teamId);
    const task = await taskRecord(teamId, taskId);
    await checkVersion(task, input.version, userId);
    if (task.removedAt || task.archivedAt)
      throw new AppError(
        409,
        "TASK_HISTORY",
        "This task is in History. Restore it before editing.",
      );
    await checkAssignee(teamId, input.assigneeId);
    const changes: Partial<ITeamTask> = { updatedAt: new Date() };
    const events: TeamTaskEvent[] = [];
    if (input.title !== undefined) changes.title = input.title;
    if (input.descriptionHtml !== undefined) {
      changes.descriptionHtml = cleanHtml(teamId, input.descriptionHtml);
      assertRichContentCompatible(task.descriptionHtml, changes.descriptionHtml, supportsTables);
      changes.descriptionText = htmlToPlainText(changes.descriptionHtml);
    }
    if (input.estimatedDays !== undefined)
      changes.estimatedDays = input.estimatedDays;
    if (input.orderIndex !== undefined) changes.orderIndex = input.orderIndex;
    if (
      input.assigneeId !== undefined &&
      input.assigneeId !== task.assigneeId
    ) {
      changes.assigneeId = input.assigneeId;
      events.push(event(userId, "assigned", task.assigneeId, input.assigneeId));
    }
    if (input.status !== undefined && input.status !== task.status) {
      changes.status = input.status;
      changes.startedAt =
        input.status === "todo"
          ? null
          : input.status === "in_progress"
            ? (task.startedAt ?? new Date())
            : task.startedAt;
      changes.completedAt = input.status === "completed" ? new Date() : null;
      changes.completedBy = input.status === "completed" ? userId : null;
      events.push(event(userId, "status_changed", task.status, input.status));
    }
    if (
      (changes.title !== undefined && changes.title !== task.title) ||
      (changes.descriptionHtml !== undefined &&
        changes.descriptionHtml !== task.descriptionHtml) ||
      (changes.estimatedDays !== undefined &&
        changes.estimatedDays !== task.estimatedDays)
    )
      events.push(event(userId, "edited"));
    if (!events.length && changes.orderIndex === undefined)
      return (await taskDTOs([task], userId))[0];
    const saved = await TeamTaskModel.findOneAndUpdate(
      { _id: taskId, teamId, version: input.version },
      {
        $set: changes,
        $inc: { version: 1 },
        $push: { events: { $each: events } },
      },
      { returnDocument: "after" },
    ).lean();
    if (!saved) throw new TeamConflict(await getTask(teamId, userId, taskId));
    await notifyTeam(teamId);
    return (await taskDTOs([saved], userId))[0];
  });
}
export async function removeTask(
  teamId: string,
  userId: string,
  taskId: string,
  version: number,
): Promise<void> {
  await withMember(teamId, userId, async () => {
    const task = await taskRecord(teamId, taskId);
    await checkVersion(task, version, userId);
    if (task.removedAt) return;
    const now = new Date();
    await TeamTaskModel.updateOne(
      { _id: taskId, teamId, version },
      {
        $set: { removedAt: now, removedBy: userId, updatedAt: now },
        $inc: { version: 1 },
        $push: { events: event(userId, "removed") },
      },
    );
    await notifyTeam(teamId);
  });
}
export async function restoreTask(
  teamId: string,
  userId: string,
  taskId: string,
  version: number,
): Promise<TeamTask> {
  return withMember(teamId, userId, async () => {
    const task = await taskRecord(teamId, taskId);
    await checkVersion(task, version, userId);
    if (!task.removedAt && !task.archivedAt)
      return (await taskDTOs([task], userId))[0];
    const saved = await TeamTaskModel.findOneAndUpdate(
      { _id: taskId, teamId, version },
      {
        $set: {
          removedAt: null,
          removedBy: null,
          archivedAt: null,
          completedAt: null,
          completedBy: null,
          startedAt: null,
          status: "todo",
          updatedAt: new Date(),
        },
        $inc: { version: 1 },
        $push: { events: event(userId, "restored") },
      },
      { returnDocument: "after" },
    ).lean();
    if (!saved) throw new TeamConflict(await getTask(teamId, userId, taskId));
    await notifyTeam(teamId);
    return (await taskDTOs([saved], userId))[0];
  });
}
export async function history(
  teamId: string,
  userId: string,
  page: number,
  q: string,
  kind: "completed" | "removed",
): Promise<TeamHistory> {
  return withMember(teamId, userId, async () => {
    await archiveTeam(teamId);
    const filter = {
      teamId,
      ...(kind === "removed"
        ? { removedAt: { $ne: null } }
        : { removedAt: null, archivedAt: { $ne: null } }),
      ...(q
        ? {
            title: {
              $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              $options: "i",
            },
          }
        : {}),
    };
    const tasks = await TeamTaskModel.find(filter)
      .select("-events")
      .sort(
        kind === "removed"
          ? { removedAt: -1, _id: -1 }
          : { completedAt: -1, _id: -1 },
      )
      .skip(page * 50)
      .limit(51)
      .lean();
    const rows = tasks.slice(0, 50);
    return {
      tasks: await taskDTOs(rows, userId),
      hasMore: tasks.length > 50,
      people: await people(
        rows.flatMap((t) =>
          [t.createdBy, t.completedBy, t.removedBy, t.assigneeId].filter(
            (id): id is string => !!id,
          ),
        ),
      ),
    };
  });
}
export async function timeline(
  teamId: string,
  userId: string,
  taskId: string,
): Promise<{ events: TeamTaskEvent[]; people: TeamPerson[] }> {
  await requireMember(teamId, userId);
  const task = await taskRecord(teamId, taskId);
  return {
    events: task.events,
    people: await people([
      task.createdBy,
      ...task.events.flatMap((e) =>
        [e.actorId, ...(e.type === "assigned" ? [e.from, e.to] : [])].filter(
          (id): id is string => !!id,
        ),
      ),
    ]),
  };
}
export async function messages(
  teamId: string,
  userId: string,
  taskId: string,
  before?: string,
): Promise<{
  messages: TeamMessage[];
  people: TeamPerson[];
  hasMore: boolean;
}> {
  await requireMember(teamId, userId);
  await taskRecord(teamId, taskId);
  const cursor = before
    ? await TeamMessageModel.findOne({ _id: before, taskId, teamId }).lean()
    : null;
  if (before && !cursor)
    throw new AppError(400, "INVALID_CURSOR", "Message not found.");
  const rows = await TeamMessageModel.find({
    teamId,
    taskId,
    deletedAt: null,
    ...(cursor
      ? {
          $or: [
            { createdAt: { $lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, _id: { $lt: cursor._id } },
          ],
        }
      : {}),
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(51)
    .lean();
  const items = rows.slice(0, 50).reverse();
  return {
    messages: items.map((m) => ({
      id: m._id,
      taskId,
      authorId: m.authorId,
      bodyText: m.bodyText,
      bodyHtml: m.bodyHtml,
      createdAt: m.createdAt.toISOString(),
    })),
    people: await people(items.map((m) => m.authorId)),
    hasMore: rows.length > 50,
  };
}
export async function sendMessage(
  teamId: string,
  userId: string,
  taskId: string,
  input: { id: string; bodyText: string; bodyHtml: string },
): Promise<void> {
  await withMember(teamId, userId, async () => {
    const task = await taskRecord(teamId, taskId);
    if (task.removedAt || task.archivedAt)
      throw new AppError(
        409,
        "TASK_HISTORY",
        "Restore this task before sending a message.",
      );
    const html = cleanHtml(teamId, input.bodyHtml);
    if (!input.bodyText.trim() && !html.includes("<img"))
      throw new AppError(
        400,
        "EMPTY_MESSAGE",
        "Write a message or attach an image.",
      );
    const duplicate = await TeamMessageModel.findById(input.id).lean();
    if (duplicate) {
      if (
        duplicate.teamId !== teamId ||
        duplicate.taskId !== taskId ||
        duplicate.authorId !== userId
      )
        throw new AppError(409, "MESSAGE_ID", "Message ID already used.");
      return;
    }
    const last = await TeamMessageModel.findOne({ teamId, taskId })
      .sort({ createdAt: -1 })
      .select("createdAt")
      .lean();
    const createdAt = new Date(
      Math.max(Date.now(), (last?.createdAt.getTime() ?? 0) + 1),
    );
    await TeamMessageModel.create({
      _id: input.id,
      teamId,
      taskId,
      authorId: userId,
      bodyText: input.bodyText,
      bodyHtml: html,
      createdAt,
    });
    await notifyTeam(teamId);
  });
}
export async function markRead(
  teamId: string,
  userId: string,
  taskId: string,
  messageId: string,
): Promise<void> {
  await withMember(teamId, userId, async () => {
    await taskRecord(teamId, taskId);
    const message = await TeamMessageModel.findOne({
      _id: messageId,
      teamId,
      taskId,
      deletedAt: null,
    }).lean();
    if (!message) throw new AppError(404, "NOT_FOUND", "Message not found.");
    await TeamTaskReadModel.updateOne(
      { teamId, taskId, userId },
      { $max: { lastReadAt: message.createdAt } },
      { upsert: true },
    );
    notifyUser(userId);
  });
}
export async function upload(
  teamId: string,
  userId: string,
  file?: { buffer: Buffer },
): Promise<{ url: string; width: number; height: number }> {
  await requireMember(teamId, userId);
  if (!file) throw new AppError(400, "NO_FILE", "Attach an image.");
  let meta: sharp.Metadata;
  try {
    meta = await sharp(file.buffer, {
      limitInputPixels: 40_000_000,
    }).metadata();
  } catch {
    throw new AppError(400, "INVALID_IMAGE", "That file is not a valid image.");
  }
  if (!meta.format || !["png", "jpeg", "webp", "gif"].includes(meta.format))
    throw new AppError(
      400,
      "INVALID_IMAGE",
      "Only png, jpg, webp and gif images are allowed.",
    );
  const result =
    meta.format === "gif"
      ? {
          data: file.buffer,
          info: {
            width: meta.width ?? 0,
            height: meta.pageHeight ?? meta.height ?? 0,
          },
        }
      : await sharp(file.buffer, { limitInputPixels: 40_000_000 })
          .rotate()
          .resize({ width: 1600, withoutEnlargement: true })
          .webp({ quality: 82 })
          .toBuffer({ resolveWithObject: true });
  return withMember(teamId, userId, async () => {
    const filename = `${randomUUID()}.${meta.format === "gif" ? "gif" : "webp"}`;
    await fs.mkdir(teamDirectory(teamId), { recursive: true });
    await fs.writeFile(path.join(teamDirectory(teamId), filename), result.data);
    await TeamUploadModel.create({ teamId, filename });
    return {
      url: `/uploads/teams/${teamId}/${filename}`,
      width: result.info.width,
      height: result.info.height,
    };
  });
}
export async function resolveImage(
  teamId: string,
  userId: string,
  filename: string,
): Promise<string> {
  await requireMember(teamId, userId);
  if (
    !/^[a-f0-9-]{36}\.(webp|gif)$/.test(filename) ||
    !(await TeamUploadModel.exists({ teamId, filename }))
  )
    throw new AppError(404, "NOT_FOUND", "Image not found.");
  return path.join(teamDirectory(teamId), filename);
}
