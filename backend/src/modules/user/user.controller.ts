import { catchAsync } from "../../utils/catchAsync";
import * as userService from "./user.service";

export const stats = catchAsync(async (_req, res) => {
  res.json(await userService.getStats());
});
