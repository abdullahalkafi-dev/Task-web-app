import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import { validate } from "../../middleware/validate";
import * as controller from "./task.controller";
import { dateQuerySchema, idParamSchema, monthQuerySchema } from "./task.validation";

export const taskRouter = Router();

taskRouter.use(authenticate);
// NOTE: "/dates" is declared before "/:id/..." routes so it is never shadowed.
taskRouter.get("/dates", validate({ query: monthQuerySchema }), controller.getDates);
taskRouter.get("/", validate({ query: dateQuerySchema }), controller.getByDate);
taskRouter.post("/:id/copy-to-today", validate({ params: idParamSchema }), controller.copyToToday);
