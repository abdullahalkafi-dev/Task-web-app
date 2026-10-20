import { randomUUID } from "node:crypto";
import { Schema, model } from "mongoose";
import type { IUpload } from "./upload.interface";

const uploadSchema = new Schema<IUpload>(
  {
    _id: { type: String, default: () => randomUUID() },
    userId: { type: String, required: true, index: true },
    filename: { type: String, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const UploadModel = model<IUpload>("Upload", uploadSchema);
