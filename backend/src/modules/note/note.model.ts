import { randomUUID } from "node:crypto";
import { Schema, model } from "mongoose";
import type { INote } from "./note.interface";

const noteSchema = new Schema<INote>(
  {
    _id: { type: String, default: () => randomUUID() },
    userId: { type: String, required: true, index: true },
    title: { type: String, default: "Untitled note", maxlength: 300 },
    descriptionHtml: { type: String, default: "" },
    descriptionText: { type: String, default: "" },
    orderIndex: { type: Number, required: true },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    serverUpdatedAt: { type: Date, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: false },
);

noteSchema.index({ userId: 1, orderIndex: 1 });
noteSchema.index({ userId: 1, updatedAt: 1 });
noteSchema.index({ userId: 1, serverUpdatedAt: 1 });

export const NoteModel = model<INote>("Note", noteSchema);
