import { Schema, model } from "mongoose";
export interface DesktopRequest {
  _id: string;
  challenge: string;
  code: string;
  userId: string | null;
  expiresAt: Date;
}
const schema = new Schema<DesktopRequest>({
  _id: { type: String, required: true },
  challenge: { type: String, required: true },
  code: { type: String, required: true },
  userId: { type: String, default: null },
  expiresAt: { type: Date, required: true, index: { expires: 0 } },
}, { versionKey: false });
export const DesktopRequestModel = model<DesktopRequest>("DesktopRequest", schema);
