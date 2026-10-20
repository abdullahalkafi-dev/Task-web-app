import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import helmet from "helmet";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { apiRouter, fileRouter } from "./routes";

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(cookieParser());
  app.use(express.json({ limit: "5mb" }));

  app.use("/api", apiRouter);
  app.use("/uploads", fileRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

export const app = createApp();
