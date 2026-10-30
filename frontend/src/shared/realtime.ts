import { io } from "socket.io-client";
import { api } from "./api";

export type AvailabilityUpdate = {
  staffId: string;
  serviceId: string;
  date: string;
};

export type AppointmentBookedNotification = {
  customerName: string;
};

export function connectSocket(
  token: string,
  onUpdate: () => void,
  onAvailabilityUpdate: (update: AvailabilityUpdate | null) => void,
  onAppointmentBooked: (notification: AppointmentBookedNotification) => void,
  onConnectionChange: (connected: boolean) => void,
): () => void {
  const apiUrl = new URL(api.defaults.baseURL ?? "/api", window.location.origin);
  const socketUrl = import.meta.env.VITE_SOCKET_URL || apiUrl.origin;
  const socket = io(socketUrl, { auth: { token } });
  socket.on("queue:updated", onUpdate);
  socket.on("availability:updated", onAvailabilityUpdate);
  socket.on("appointment:booked", onAppointmentBooked);
  socket.on("connect", () => {
    onConnectionChange(true);
    onUpdate();
  });
  socket.on("connect", () => onAvailabilityUpdate(null));
  socket.on("disconnect", () => onConnectionChange(false));
  socket.on("connect_error", () => onConnectionChange(false));
  return () => socket.disconnect();
}
