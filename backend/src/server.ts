import http from "node:http";
import { createApp } from "./app.js";
import { startNoShowJob } from "./application/jobs/noShowJob.js";
import { env } from "./infrastructure/config/env.js";
import { connectDatabase } from "./infrastructure/database/connectDatabase.js";
import { logger, serializeError } from "./infrastructure/logging/logger.js";
import { createSocketServer } from "./infrastructure/realtime/socket.js";

try {
  await connectDatabase();

  const realtime = createSocketServer();
  const app = createApp(realtime.publisher);
  const httpServer = http.createServer(app);
  realtime.attach(httpServer);
  const noShowJob = startNoShowJob(realtime.publisher);

  httpServer.on("error", (error) => {
    logger.error("HTTP server error.", { error: serializeError(error) });
  });
  httpServer.listen(env.PORT, () => {
    logger.info("Appointment API listening.", { port: env.PORT });
  });

  function shutdown(signal: string): void {
    logger.info("Shutdown requested.", { signal });
    noShowJob.stop();
    realtime.io.close(() => {
      logger.on("finish", () => process.exit(0));
      logger.end();
    });
  }

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
} catch (error) {
  logger.error("Backend startup failed.", { error: serializeError(error) });
  process.exitCode = 1;
}
