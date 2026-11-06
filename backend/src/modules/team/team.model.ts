import { randomUUID } from "node:crypto";
import { Schema, model } from "mongoose";
import type {
  ITeam,
  ITeamInvite,
  ITeamMember,
  ITeamTask,
  ITeamMessage,
  ITeamTaskRead,
  ITeamUpload,
} from "./team.interface";
const id = { type: String, default: () => randomUUID() };
const teamSchema = new Schema<ITeam>({
  _id: id,
  name: { type: String, required: true },
  creatorId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
});
const memberSchema = new Schema<ITeamMember>({
  _id: id,
  teamId: { type: String, required: true },
  userId: { type: String, required: true },
  joinedAt: { type: Date, default: Date.now },
  leftAt: { type: Date, default: null },
  removedBy: { type: String, default: null },
});
memberSchema.index(
  { teamId: 1, userId: 1 },
  { unique: true, partialFilterExpression: { leftAt: null } },
);
memberSchema.index({ userId: 1, leftAt: 1 });
const inviteSchema = new Schema<ITeamInvite>({
  _id: id,
  teamId: { type: String, required: true },
  invitedUserId: { type: String, required: true },
  invitedBy: { type: String, required: true },
  status: {
    type: String,
    enum: ["pending", "accepted", "declined", "cancelled"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
  respondedAt: { type: Date, default: null },
});
inviteSchema.index(
  { teamId: 1, invitedUserId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
inviteSchema.index({ invitedUserId: 1, status: 1 });
const eventSchema = new Schema(
  {
    id: String,
    actorId: { type: String, default: null },
    type: String,
    from: { type: String, default: null },
    to: { type: String, default: null },
    at: String,
  },
  { _id: false },
);
const taskSchema = new Schema<ITeamTask>({
  _id: id,
  teamId: { type: String, required: true },
  title: { type: String, required: true },
  descriptionHtml: { type: String, default: "" },
  descriptionText: { type: String, default: "" },
  status: {
    type: String,
    enum: ["todo", "in_progress", "completed"],
    default: "todo",
  },
  orderIndex: { type: Number, default: 1024 },
  createdBy: { type: String, required: true },
  assigneeId: { type: String, default: null },
  estimatedDays: { type: Number, default: null },
  startedAt: { type: Date, default: null },
  completedAt: { type: Date, default: null },
  completedBy: { type: String, default: null },
  archivedAt: { type: Date, default: null },
  removedAt: { type: Date, default: null },
  removedBy: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  version: { type: Number, default: 1 },
  events: { type: [eventSchema], default: [] },
});
taskSchema.index({ teamId: 1, removedAt: 1, archivedAt: 1, orderIndex: 1 });
taskSchema.index({ completedAt: 1, archivedAt: 1 });
const messageSchema = new Schema<ITeamMessage>({
  _id: id,
  teamId: { type: String, required: true },
  taskId: { type: String, required: true },
  authorId: { type: String, required: true },
  bodyText: { type: String, default: "" },
  bodyHtml: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null },
});
messageSchema.index({ teamId: 1, taskId: 1, createdAt: -1, _id: -1 });
const readSchema = new Schema<ITeamTaskRead>({
  _id: id,
  teamId: String,
  taskId: String,
  userId: String,
  lastReadAt: Date,
});
readSchema.index({ taskId: 1, userId: 1 }, { unique: true });
const uploadSchema = new Schema<ITeamUpload>({
  _id: id,
  teamId: { type: String, required: true, index: true },
  filename: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});
export const TeamModel = model<ITeam>("Team", teamSchema);
export const TeamMemberModel = model<ITeamMember>("TeamMember", memberSchema);
export const TeamInviteModel = model<ITeamInvite>("TeamInvite", inviteSchema);
export const TeamTaskModel = model<ITeamTask>("TeamTask", taskSchema);
export const TeamMessageModel = model<ITeamMessage>(
  "TeamMessage",
  messageSchema,
);
export const TeamTaskReadModel = model<ITeamTaskRead>(
  "TeamTaskRead",
  readSchema,
);
export const TeamUploadModel = model<ITeamUpload>("TeamUpload", uploadSchema);
