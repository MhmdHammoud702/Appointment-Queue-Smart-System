import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import type {
  AvailabilityUpdate,
  QueueUpdate,
  QueueUpdatePublisher
} from "../../application/ports/QueueUpdatePublisher.js";

const QUEUE_ROOM = "queue";
const AUTHORIZED_ROLES = ["Admin", "Staff", "Receptionist", "Customer"];

export function createSocketServer() {
  const io = new Server({
    cors: { origin: env.CLIENT_ORIGIN, credentials: true }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (typeof token !== "string") {
      next(new Error("Authentication required."));
      return;
    }

    try {
      const payload = jwt.verify(token, env.JWT_SECRET);
      if (
        typeof payload === "string" ||
        typeof payload.sub !== "string" ||
        typeof payload.fullName !== "string" ||
        !AUTHORIZED_ROLES.includes(String(payload.role))
      ) {
        next(new Error("Unauthorized."));
        return;
      }
      socket.data.role = payload.role;
      next();
    } catch {
      next(new Error("Invalid authentication token."));
    }
  });

  io.on("connection", (socket) => {
    if (socket.data.role !== "Customer") {
      void socket.join(QUEUE_ROOM);
    }
  });

  const publisher: QueueUpdatePublisher = {
    publishQueueUpdate: (update: QueueUpdate) => {
      io.to(QUEUE_ROOM).emit("queue:updated", update);
    },
    publishAvailabilityUpdate: (update: AvailabilityUpdate) => {
      io.emit("availability:updated", update);
    }
  };

  return {
    io,
    publisher,
    attach: (httpServer: HttpServer) => io.attach(httpServer)
  };
}
