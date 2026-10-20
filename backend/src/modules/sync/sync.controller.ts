import type { ParamsDictionary } from "express-serve-static-core";
import { catchAsync } from "../../utils/catchAsync";
import * as syncService from "./sync.service";
import type { PullQuery, PushBody } from "./sync.validation";

export const push = catchAsync<ParamsDictionary, unknown, PushBody>(async (req, res) => {
  const result = await syncService.push(req.user.id, req.body);
  res.json(result);
});

export const pull = catchAsync<ParamsDictionary, unknown, unknown, PullQuery>(async (req, res) => {
  const result = await syncService.pull(req.user.id, req.query.since);
  res.json(result);
});
