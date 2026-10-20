import { randomUUID } from "node:crypto";
import { Schema, model } from "mongoose";
import type { IUser } from "./user.interface";

const userSchema = new Schema<IUser>(
  {
    _id: { type: String, default: () => randomUUID() },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    googleId: { type: String, required: true, unique: true },
    name: { type: String, trim: true },
    role: { type: String, enum: ["superadmin", "user"], default: "user", required: true },
    lastLoginAt: { type: Date, default: () => new Date() },
    loginCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const UserModel = model<IUser>("User", userSchema);
