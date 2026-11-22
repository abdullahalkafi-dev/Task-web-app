import { catchAsync } from "../../utils/catchAsync";
import * as service from "./apikey.service";
import * as schemas from "./apikey.validation";

export const list = catchAsync(async (req, res) => {
  res.json({ keys: await service.listKeys(req.user.id) });
});
export const create = catchAsync(async (req, res) => {
  res.status(201).json(await service.createKey(req.user.id, schemas.createKeySchema.parse(req.body)));
});
export const patch = catchAsync(async (req, res) => {
  res.json({ key: await service.patchKey(req.user.id, req.params.id, schemas.patchKeySchema.parse(req.body)) });
});
export const rotate = catchAsync(async (req, res) => {
  res.json(await service.rotateKey(req.user.id, req.params.id));
});
export const remove = catchAsync(async (req, res) => {
  await service.deleteKey(req.user.id, req.params.id);
  res.status(204).end();
});
