import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import request from "supertest";
import { app } from "../app";
import { signToken } from "../modules/auth/auth.service";
import type { IUserPublic } from "../modules/user/user.interface";
import { UserModel } from "../modules/user/user.model";
import { toPublicUser } from "../modules/user/user.service";
import { dhakaDateKey } from "../utils/dhaka";

export const api = request(app);

export async function clearDb(): Promise<void> {
  const collections = await mongoose.connection.db?.collections();
  await Promise.all((collections ?? []).map((c) => c.deleteMany({})));
}

export interface Session {
  token: string;
  user: IUserPublic;
}

/** Inserts a Google-style account straight into the database and returns a signed session for it. */
export async function createSession(name: string, role: "user" | "superadmin" = "user"): Promise<Session> {
  const doc = await UserModel.create({ email: `${name}@test.dev`, googleId: `g-${name}`, name, role });
  const user = toPublicUser(doc.toObject());
  return { token: signToken({ id: user.id, email: user.email, role }), user };
}

export async function seedAdmin(): Promise<void> {
  await createSession("admin", "superadmin");
}

/** Session for the account created by seedAdmin(). */
export async function loginAdmin(): Promise<Session> {
  const doc = await UserModel.findOne({ googleId: "g-admin" }).lean();
  if (!doc) throw new Error("call seedAdmin() first");
  const user = toPublicUser(doc);
  return { token: signToken({ id: user.id, email: user.email, role: "superadmin" }), user };
}

export function createUserWithToken(name: string): Promise<Session> {
  return createSession(name);
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export function taskDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    taskDate: dhakaDateKey(),
    title: "Write report",
    descriptionHtml: "<p>Hello</p>",
    estimatedMinutes: 90,
    status: "notStarted",
    orderIndex: 1024,
    copiedFromDate: null,
    copiedFromTaskId: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}

export function noteDoc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    title: "My note",
    descriptionHtml: "<p>Body</p>",
    orderIndex: 1024,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  };
}
