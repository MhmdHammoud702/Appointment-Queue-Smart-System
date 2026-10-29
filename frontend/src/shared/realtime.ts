import { io } from "socket.io-client";
import { api } from "./api";

export type AvailabilityUpdate = {
  staffId: string;
  serviceId: string;
  date: string;
};

export function connectSocket(
  token: string,
  onUpdate: () => void,
  onAvailabilityUpdate: (update: AvailabilityUpdate | null) => void
): () => void {
  const apiUrl = new URL(api.defaults.baseURL ?? "/api", window.location.origin);
  const socketUrl = import.meta.env.VITE_SOCKET_URL || apiUrl.origin;
  const socket = io(socketUrl, { auth: { token } });
  socket.on("queue:updated", onUpdate);
  socket.on("availability:updated", onAvailabilityUpdate);
  socket.on("connect", onUpdate);
  socket.on("connect", () => onAvailabilityUpdate(null));
  return () => socket.disconnect();
}
