export type QueueUpdateEvent =
  | "booked"
  | "confirmed"
  | "checked-in"
  | "called"
  | "completed"
  | "cancelled"
  | "rescheduled"
  | "no-show";

export type QueueUpdate = {
  event: QueueUpdateEvent;
  data: unknown;
};

export type AvailabilityUpdate = {
  staffId: string;
  serviceId: string;
  date: string;
};

export type AppointmentBookedNotification = {
  customerName: string;
};

export interface QueueUpdatePublisher {
  publishQueueUpdate(update: QueueUpdate): void;
  publishAvailabilityUpdate(update: AvailabilityUpdate): void;
  publishAppointmentBooked(notification: AppointmentBookedNotification): void;
  revokeUserAccess(userId: string): void;
}

export const noQueueUpdatePublisher: QueueUpdatePublisher = {
  publishQueueUpdate: () => undefined,
  publishAvailabilityUpdate: () => undefined,
  publishAppointmentBooked: () => undefined,
  revokeUserAccess: () => undefined
};
