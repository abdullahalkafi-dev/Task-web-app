import { Router } from "express";
import { authRouter } from "../modules/auth/auth.route";
import { noteRouter } from "../modules/note/note.route";
import { syncRouter } from "../modules/sync/sync.route";
import { taskRouter } from "../modules/task/task.route";
import { uploadApiRouter, uploadFileRouter } from "../modules/upload/upload.route";
import { userRouter } from "../modules/user/user.route";

/** Mounted at /api */
export const apiRouter = Router();
apiRouter.get("/health", (_req, res) => {
  res.json({ ok: true });
});
apiRouter.use("/auth", authRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/tasks", taskRouter);
apiRouter.use("/notes", noteRouter);
apiRouter.use("/sync", syncRouter);
apiRouter.use("/uploads", uploadApiRouter);

/** Mounted at /uploads (image files, cookie-authenticated GET) */
export const fileRouter = uploadFileRouter;
