import type { TeamStatus, TeamTaskEvent } from "@dayflow/shared";
export interface ITeam {
  _id: string;
  name: string;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
export interface ITeamMember {
  _id: string;
  teamId: string;
  userId: string;
  joinedAt: Date;
  leftAt: Date | null;
  removedBy: string | null;
}
export interface ITeamInvite {
  _id: string;
  teamId: string;
  invitedUserId: string;
  invitedBy: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  createdAt: Date;
  respondedAt: Date | null;
}
// Embedded append-only events make each task change + its timeline atomic on standalone MongoDB.
export interface ITeamTask {
  _id: string;
  teamId: string;
  title: string;
  descriptionHtml: string;
  descriptionText: string;
  status: TeamStatus;
  orderIndex: number;
  createdBy: string;
  assigneeId: string | null;
  estimatedDays: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  completedBy: string | null;
  archivedAt: Date | null;
  removedAt: Date | null;
  removedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  events: TeamTaskEvent[];
}
export interface ITeamMessage {
  _id: string;
  teamId: string;
  taskId: string;
  authorId: string;
  bodyText: string;
  bodyHtml: string;
  createdAt: Date;
  deletedAt: Date | null;
}
export interface ITeamTaskRead {
  _id: string;
  teamId: string;
  taskId: string;
  userId: string;
  lastReadAt: Date;
}
export interface ITeamUpload {
  _id: string;
  teamId: string;
  filename: string;
  createdAt: Date;
}
