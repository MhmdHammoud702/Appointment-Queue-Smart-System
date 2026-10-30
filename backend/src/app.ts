import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createApiRoutes } from "./presentation/routes/apiRoutes.js";
import { errorHandler, notFoundHandler } from "./presentation/middleware/errorHandler.js";
import { env } from "./infrastructure/config/env.js";
import {
  noQueueUpdatePublisher,
  type QueueUpdatePublisher
} from "./application/ports/QueueUpdatePublisher.js";

export function createApp(
  updatePublisher: QueueUpdatePublisher = noQueueUpdatePublisher
) {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGINS, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.get("/health", (_req, res) => res.json({ success: true, data: { status: "ok" } }));
  app.use("/api", createApiRoutes(updatePublisher));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
