import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import sharp from "sharp";
import { config } from "../../config/env";
import { AppError } from "../../utils/AppError";
import type { IImageVersion, IUploadInput, IUploadResult } from "./upload.interface";
import { UploadModel } from "./upload.model";

const MAX_WIDTH = 1600;
const ALLOWED_FORMATS = new Set(["png", "jpeg", "webp", "gif"]);

export const uploadMiddleware = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.UPLOAD_MAX_MB * 1024 * 1024, files: 1 },
}).single("file");

function userDir(userId: string): string {
  return path.join(config.UPLOAD_ROOT, userId);
}

export const IMAGE_FILE_RE = /^[a-f0-9-]{36}\.(webp|gif)$/;
export const MAX_VERSION_CHAIN = 25;

export async function saveImage(
  userId: string,
  input: IUploadInput | undefined,
  replaces?: string,
): Promise<IUploadResult> {
  if (!input) throw new AppError(400, "NO_FILE", "Attach an image as the 'file' field");
  if (replaces !== undefined) {
    // Markup edit: the previous file stays on disk and in the database, hidden from the description.
    if (!IMAGE_FILE_RE.test(replaces) || !(await UploadModel.exists({ userId, filename: replaces })))
      throw new AppError(400, "INVALID_REPLACES", "The image being edited was not found");
  }

  let format: string | undefined;
  try {
    format = (await sharp(input.buffer).metadata()).format;
  } catch {
    throw new AppError(400, "INVALID_IMAGE", "That file is not a valid image");
  }
  if (!format || !ALLOWED_FORMATS.has(format)) {
    throw new AppError(400, "INVALID_IMAGE", "Only png, jpg, webp and gif images are allowed");
  }

  const dir = userDir(userId);
  await fs.mkdir(dir, { recursive: true });
  const id = randomUUID();
  let filename: string;
  let width: number;
  let height: number;
  let size: number;
  let mime: string;

  if (format === "gif") {
    filename = `${id}.gif`;
    const meta = await sharp(input.buffer).metadata();
    width = meta.width ?? 0;
    height = meta.pageHeight ?? meta.height ?? 0;
    await fs.writeFile(path.join(dir, filename), input.buffer);
    size = input.size;
    mime = "image/gif";
  } else {
    filename = `${id}.webp`;
    const info = await sharp(input.buffer)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(path.join(dir, filename));
    width = info.width;
    height = info.height;
    size = info.size;
    mime = "image/webp";
  }

  await UploadModel.create({ _id: id, userId, filename, mime, size, width, height, replacesFilename: replaces ?? null });
  return { url: `/uploads/${userId}/${filename}`, width, height };
}

/** Returns the absolute file path if `requesterId` owns it; otherwise throws 403/404. */
export async function resolveOwnedFile(requesterId: string, ownerId: string, file: string): Promise<string> {
  if (requesterId !== ownerId) throw new AppError(403, "FORBIDDEN", "This image belongs to another account");
  const abs = path.join(userDir(ownerId), file);
  try {
    await fs.access(abs);
  } catch {
    throw new AppError(404, "NOT_FOUND", "Image not found");
  }
  return abs;
}

/** Newest-first chain of an image and the earlier versions it replaced (owner only). */
export async function imageVersions(requesterId: string, ownerId: string, file: string): Promise<IImageVersion[]> {
  if (requesterId !== ownerId) throw new AppError(403, "FORBIDDEN", "This image belongs to another account");
  const versions: IImageVersion[] = [];
  const seen = new Set<string>();
  let name: string | null = file;
  while (name && versions.length < MAX_VERSION_CHAIN && !seen.has(name)) {
    seen.add(name);
    const record: { filename: string; width: number; height: number; createdAt: Date; replacesFilename?: string | null } | null =
      await UploadModel.findOne({ userId: ownerId, filename: name }).lean();
    if (!record) break;
    versions.push({
      url: `/uploads/${ownerId}/${record.filename}`,
      width: record.width,
      height: record.height,
      createdAt: record.createdAt.toISOString(),
    });
    name = record.replacesFilename ?? null;
  }
  if (!versions.length) throw new AppError(404, "NOT_FOUND", "Image not found");
  return versions;
}
