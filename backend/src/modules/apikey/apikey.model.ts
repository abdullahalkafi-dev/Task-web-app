import { randomUUID } from "node:crypto";
import { Schema, model } from "mongoose";
import type { IApiKey } from "./apikey.interface";

const apiKeySchema = new Schema<IApiKey>({
  _id: { type: String, default: () => randomUUID() },
  userId: { type: String, required: true },
  name: { type: String, required: true, minlength: 1, maxlength: 60 },
  prefix: { type: String, required: true },
  hash: { type: String, required: true, unique: true },
  write: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  lastUsedAt: { type: Date, default: null },
});
apiKeySchema.index({ userId: 1 });

export const ApiKeyModel = model<IApiKey>("ApiKey", apiKeySchema);
