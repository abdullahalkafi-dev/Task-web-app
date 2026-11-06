export type TeamStatus = "todo" | "in_progress" | "completed";
export interface TeamPerson {
  id: string;
  name: string;
  email: string;
}
export interface TeamMember extends TeamPerson {
  joinedAt: string;
}
export interface TeamSummary {
  id: string;
  name: string;
  creatorId: string;
  createdAt: string;
  members: TeamMember[];
  openTaskCount: number;
}
export interface TeamInvite {
  id: string;
  teamId: string;
  teamName: string;
  invitedUserId: string;
  invitedBy: TeamPerson;
  invitedUser: TeamPerson;
  createdAt: string;
}
export interface TeamDetail extends TeamSummary {
  invites: TeamInvite[];
  people: TeamPerson[];
}
export interface TeamTask {
  id: string;
  teamId: string;
  title: string;
  descriptionHtml: string;
  descriptionText: string;
  status: TeamStatus;
  orderIndex: number;
  createdBy: string;
  assigneeId: string | null;
  estimatedDays: number | null;
  startedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  archivedAt: string | null;
  removedAt: string | null;
  removedBy: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
  messageCount: number;
  unread: boolean;
}
export interface TeamTaskInput {
  title: string;
  descriptionHtml: string;
  status: TeamStatus;
  assigneeId: string | null;
  estimatedDays: number | null;
}
export interface TeamTaskPatch extends Partial<TeamTaskInput> {
  version: number;
  orderIndex?: number;
}
export interface TeamTaskEvent {
  id: string;
  actorId: string | null;
  type:
    | "created"
    | "status_changed"
    | "assigned"
    | "edited"
    | "removed"
    | "restored"
    | "archived";
  from: string | null;
  to: string | null;
  at: string;
}
export interface TeamMessage {
  id: string;
  taskId: string;
  authorId: string;
  bodyText: string;
  bodyHtml: string;
  createdAt: string;
}
export interface TeamHistory {
  tasks: TeamTask[];
  hasMore: boolean;
  people: TeamPerson[];
}
