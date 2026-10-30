import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { Server } from "socket.io";
import { env } from "../config/env.js";
import { User } from "../database/models/User.js";
import type {
  AvailabilityUpdate,
  QueueUpdate,
  QueueUpdatePublisher
} from "../../application/ports/QueueUpdatePublisher.js";

const QUEUE_ROOM = "queue";
const RECEPTIONIST_ROOM = "receptionists";
const userRoom = (userId: string) => `user:${userId}`;
const AUTHORIZED_ROLES = ["Admin", "Staff", "Receptionist", "Customer"];

export function createSocketServer(
  isUserActive: (userId: string) => Promise<boolean> = async (userId) =>
    Boolean(await User.exists({ _id: userId, isActive: { $ne: false } }))
) {
  const io = new Server({
    cors: { origin: env.CLIENT_ORIGIN, credentials: true }
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (typeof token !== "string") {
      next(new Error("Authentication required."));
      return;
    }

    let payload: string | jwt.JwtPayload;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      next(new Error("Invalid authentication token."));
      return;
    }

    if (
      typeof payload === "string" ||
      typeof payload.sub !== "string" ||
      typeof payload.fullName !== "string" ||
      !AUTHORIZED_ROLES.includes(String(payload.role))
    ) {
      next(new Error("Unauthorized."));
      return;
    }
    let active: boolean;
    try {
      active = await isUserActive(payload.sub);
    } catch (error) {
      next(error instanceof Error ? error : new Error("Unable to verify account status."));
      return;
    }
    if (!active) {
      next(new Error("Account is deactivated."));
      return;
    }
    socket.data.userId = payload.sub;
    socket.data.role = payload.role;
    next();
  });

  io.on("connection", (socket) => {
    void socket.join(userRoom(socket.data.userId));
    if (socket.data.role !== "Customer") {
      void socket.join(QUEUE_ROOM);
    }
    if (socket.data.role === "Receptionist") {
      void socket.join(RECEPTIONIST_ROOM);
    }
  });

  const publisher: QueueUpdatePublisher = {
    publishQueueUpdate: (update: QueueUpdate) => {
      io.to(QUEUE_ROOM).emit("queue:updated", update);
    },
    publishAvailabilityUpdate: (update: AvailabilityUpdate) => {
      io.emit("availability:updated", update);
    },
    publishAppointmentBooked: (notification) => {
      io.to(RECEPTIONIST_ROOM).emit("appointment:booked", notification);
    },
    revokeUserAccess: (userId) => {
      io.in(userRoom(userId)).disconnectSockets(true);
    }
  };

  return {
    io,
    publisher,
    attach: (httpServer: HttpServer) => io.attach(httpServer)
  };
}
