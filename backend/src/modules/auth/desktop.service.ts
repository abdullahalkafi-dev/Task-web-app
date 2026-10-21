import { createHash, randomBytes, randomInt } from "node:crypto";
import { DesktopRequestModel } from "./desktop.model";
import { AppError } from "../../utils/AppError";
import { getMe, signToken } from "./auth.service";
import type { IUserPublic } from "../user/user.interface";

export async function start(challenge: string): Promise<{ requestId: string; code: string; expiresAt: string }> {
  const requestId = randomBytes(24).toString("hex");
  const code = String(randomInt(100000, 1000000));
  const expiresAt = new Date(Date.now() + 300_000);
  await DesktopRequestModel.create({ _id: requestId, challenge, code, expiresAt });
  return { requestId, code, expiresAt: expiresAt.toISOString() };
}
export async function details(requestId: string): Promise<{ code: string; expiresAt: string }> {
  const request = await DesktopRequestModel.findOne({ _id: requestId, expiresAt: { $gt: new Date() }, userId: null }).lean();
  if (!request) throw new AppError(410, "EXPIRED", "Sign-in request has expired or was already approved");
  return { code: request.code, expiresAt: request.expiresAt.toISOString() };
}
export async function approve(requestId: string, code: string, userId: string): Promise<void> {
  await getMe(userId); // Removed accounts cannot approve a handoff.
  const request = await DesktopRequestModel.findOneAndUpdate({ _id: requestId, code, userId: null, expiresAt: { $gt: new Date() } }, { $set: { userId } });
  if (!request) throw new AppError(410, "EXPIRED", "Sign-in request has expired or was already approved");
}
export async function exchange(requestId: string, verifier: string): Promise<{ token: string; user: IUserPublic } | null> {
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const filter = { _id: requestId, challenge, expiresAt: { $gt: new Date() } };
  // Atomic consumption prevents replay or concurrent exchanges from receiving a second session.
  const approved = await DesktopRequestModel.findOneAndDelete({ ...filter, userId: { $ne: null } }).lean();
  if (approved?.userId) {
    const { user, auth } = await getMe(approved.userId);
    return { token: signToken(auth), user };
  }
  if (await DesktopRequestModel.exists(filter)) return null;
  throw new AppError(410, "EXPIRED", "Sign-in request is invalid, expired or already used");
}
