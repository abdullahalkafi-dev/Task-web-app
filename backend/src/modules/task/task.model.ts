import { randomUUID } from "node:crypto";
import { Schema, model } from "mongoose";
import type { ITask } from "./task.interface";

const taskSchema = new Schema<ITask>(
  {
    _id: { type: String, default: () => randomUUID() },
    userId: { type: String, required: true, index: true },
    taskDate: { type: String, required: true },
    title: { type: String, required: true, minlength: 1, maxlength: 200 },
    descriptionHtml: { type: String, default: "" },
    descriptionText: { type: String, default: "" },
    estimatedMinutes: { type: Number, default: 0, min: 0, max: 1439 },
    reminderAt: { type: Date, default: null },
    status: { type: String, enum: ["notStarted", "started", "completed"], default: "notStarted" },
    orderIndex: { type: Number, required: true },
    copiedFromDate: { type: String, default: null },
    copiedFromTaskId: { type: String, default: null },
    createdAt: { type: Date, required: true },
    updatedAt: { type: Date, required: true },
    serverUpdatedAt: { type: Date, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: false },
);

taskSchema.index({ userId: 1, taskDate: 1, orderIndex: 1 });
taskSchema.index({ userId: 1, updatedAt: 1 });
taskSchema.index({ userId: 1, serverUpdatedAt: 1 });

export const TaskModel = model<ITask>("Task", taskSchema);
