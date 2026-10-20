import { Router } from "express";
import { authenticate } from "../../middleware/auth";
import * as controller from "./note.controller";

export const noteRouter = Router();

// Writes happen through POST /sync/push; this is a plain read fallback.
noteRouter.get("/", authenticate, controller.listNotes);
