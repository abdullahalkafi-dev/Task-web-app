import { createHash, randomBytes } from "node:crypto";
import { AppError } from "../../utils/AppError";
import { API_KEY_PREFIX, MAX_KEYS_PER_USER, type ApiKeyPublic, type IApiKey } from "./apikey.interface";
import { ApiKeyModel } from "./apikey.model";

export const hashSecret = (secret: string): string => createHash("sha256").update(secret).digest("hex");

function newSecret(): string {
  return API_KEY_PREFIX + randomBytes(30).toString("base64url").slice(0, 40);
}

export function toPublicKey(doc: IApiKey): ApiKeyPublic {
  return {
    id: doc._id,
    name: doc.name,
    prefix: doc.prefix,
    write: doc.write,
    createdAt: doc.createdAt.toISOString(),
    lastUsedAt: doc.lastUsedAt ? doc.lastUsedAt.toISOString() : null,
  };
}

async function owned(userId: string, id: string) {
  const doc = await ApiKeyModel.findOne({ _id: id, userId });
  if (!doc) throw new AppError(404, "NOT_FOUND", "API key not found");
  return doc;
}

export async function listKeys(userId: string): Promise<ApiKeyPublic[]> {
  const docs = await ApiKeyModel.find({ userId }).sort({ createdAt: -1 }).lean();
  return docs.map(toPublicKey);
}

export async function createKey(userId: string, input: { name: string; write?: boolean }) {
  if ((await ApiKeyModel.countDocuments({ userId })) >= MAX_KEYS_PER_USER) {
    throw new AppError(400, "KEY_LIMIT", `You can have at most ${MAX_KEYS_PER_USER} API keys`);
  }
  const secret = newSecret();
  const doc = await ApiKeyModel.create({
    userId,
    name: input.name,
    prefix: secret.slice(0, 12),
    hash: hashSecret(secret),
    write: input.write ?? false,
  });
  return { key: toPublicKey(doc.toObject()), secret };
}

export async function patchKey(userId: string, id: string, input: { name?: string; write?: boolean }) {
  const doc = await owned(userId, id);
  if (input.name !== undefined) doc.name = input.name;
  if (input.write !== undefined) doc.write = input.write;
  await doc.save();
  return toPublicKey(doc.toObject());
}

export async function rotateKey(userId: string, id: string) {
  const doc = await owned(userId, id);
  const secret = newSecret();
  doc.prefix = secret.slice(0, 12);
  doc.hash = hashSecret(secret);
  doc.lastUsedAt = null;
  await doc.save();
  return { key: toPublicKey(doc.toObject()), secret };
}

export async function deleteKey(userId: string, id: string): Promise<void> {
  const doc = await owned(userId, id);
  await ApiKeyModel.deleteOne({ _id: doc._id });
}
