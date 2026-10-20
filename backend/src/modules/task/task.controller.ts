import type { ParamsDictionary } from "express-serve-static-core";
import { catchAsync } from "../../utils/catchAsync";
import type { DateQuery, IdParams, MonthQuery } from "./task.validation";
import * as taskService from "./task.service";

export const getByDate = catchAsync<ParamsDictionary, unknown, unknown, DateQuery>(async (req, res) => {
  const tasks = await taskService.getByDate(req.user.id, req.query.date);
  res.json({ tasks });
});

export const getDates = catchAsync<ParamsDictionary, unknown, unknown, MonthQuery>(async (req, res) => {
  const dates = await taskService.getDatesInMonth(req.user.id, req.query.month);
  res.json({ dates });
});

export const copyToToday = catchAsync<IdParams>(async (req, res) => {
  const task = await taskService.copyToToday(req.user.id, req.params.id);
  res.status(201).json({ task });
});
