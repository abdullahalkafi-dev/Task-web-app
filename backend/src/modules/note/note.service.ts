import { AppError } from "../../utils/AppError";
import { htmlToPlainText, sanitizeRichHtml } from "../../utils/sanitize";
import type { INote, INoteDTO, INoteUpsert, INoteUpsertResult } from "./note.interface";
import { NoteModel } from "./note.model";
import { notifyUser } from "../sync/sync.events";

export function toNoteDTO(n: INote): INoteDTO {
  return {
    id: n._id,
    title: n.title,
    descriptionHtml: n.descriptionHtml,
    descriptionText: n.descriptionText,
    orderIndex: n.orderIndex,
    createdAt: n.createdAt.toISOString(),
    updatedAt: n.updatedAt.toISOString(),
    deletedAt: n.deletedAt ? n.deletedAt.toISOString() : null,
  };
}

export async function listNotes(userId: string): Promise<INoteDTO[]> {
  const notes = await NoteModel.find({ userId, deletedAt: null }).sort({ orderIndex: 1 }).lean<INote[]>();
  return notes.map(toNoteDTO);
}

async function upsertOne(userId: string, doc: INoteUpsert): Promise<INoteUpsertResult> {
  const existing = await NoteModel.findById(doc.id).lean<INote>();
  if (existing && existing.userId !== userId) {
    return { id: doc.id, applied: false, winner: null, error: "FORBIDDEN" };
  }
  const incomingUpdatedAt = new Date(doc.updatedAt);
  if (existing && existing.updatedAt.getTime() >= incomingUpdatedAt.getTime()) {
    return { id: doc.id, applied: false, winner: toNoteDTO(existing) };
  }
  const html = sanitizeRichHtml(doc.descriptionHtml);
  const saved = await NoteModel.findOneAndUpdate(
    { _id: doc.id, userId },
    {
      $set: {
        title: doc.title || "Untitled note",
        descriptionHtml: html,
        descriptionText: htmlToPlainText(html),
        orderIndex: doc.orderIndex,
        updatedAt: incomingUpdatedAt,
        serverUpdatedAt: new Date(),
        deletedAt: doc.deletedAt ? new Date(doc.deletedAt) : null,
      },
      $setOnInsert: { createdAt: new Date(doc.createdAt) },
    },
    { upsert: true, returnDocument: "after" },
  ).lean<INote>();
  if (!saved) throw new AppError(500, "INTERNAL", "Failed to save note");
  notifyUser(userId);
  return { id: doc.id, applied: true, winner: toNoteDTO(saved) };
}

/** Last-write-wins merge by `updatedAt`. Results are aligned with the input order. */
export async function upsertMany(userId: string, docs: INoteUpsert[]): Promise<INoteUpsertResult[]> {
  const results: INoteUpsertResult[] = [];
  for (const doc of docs) results.push(await upsertOne(userId, doc));
  return results;
}

export async function pullSince(userId: string, since: Date | null): Promise<INoteDTO[]> {
  const filter = since ? { userId, serverUpdatedAt: { $gt: since } } : { userId };
  const notes = await NoteModel.find(filter).sort({ serverUpdatedAt: 1 }).lean<INote[]>();
  return notes.map(toNoteDTO);
}

export async function purgeTombstones(olderThan: Date): Promise<number> {
  const res = await NoteModel.deleteMany({ deletedAt: { $ne: null, $lt: olderThan } });
  return res.deletedCount;
}
