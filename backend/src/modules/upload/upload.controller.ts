import { catchAsync } from "../../utils/catchAsync";
import type { FileParams } from "./upload.validation";
import * as uploadService from "./upload.service";

export const upload = catchAsync(async (req, res) => {
  const file = req.file;
  const result = await uploadService.saveImage(
    req.user.id,
    file ? { buffer: file.buffer, size: file.size } : undefined,
  );
  res.status(201).json(result);
});

export const serve = catchAsync<FileParams>(async (req, res) => {
  const abs = await uploadService.resolveOwnedFile(req.user.id, req.params.userId, req.params.file);
  res.sendFile(abs, {
    cacheControl: false,
    headers: { "Cache-Control": "private, max-age=31536000, immutable" },
  });
});
