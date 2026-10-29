import http from "node:http";
import { createApp } from "./app.js";
import { startNoShowJob } from "./application/jobs/noShowJob.js";
import { env } from "./infrastructure/config/env.js";
import { connectDatabase } from "./infrastructure/database/connectDatabase.js";
import { createSocketServer } from "./infrastructure/realtime/socket.js";

await connectDatabase();

const realtime = createSocketServer();
const app = createApp(realtime.publisher);
const httpServer = http.createServer(app);
realtime.attach(httpServer);
const noShowJob = startNoShowJob(realtime.publisher);

httpServer.listen(env.PORT, () => {
  console.log(`Appointment API listening on http://localhost:${env.PORT}`);
});

function shutdown(signal: string): void {
  console.log(`${signal} received. Shutting down.`);
  noShowJob.stop();
  realtime.io.close(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
