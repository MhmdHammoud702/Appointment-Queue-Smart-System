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

export interface QueueUpdatePublisher {
  publishQueueUpdate(update: QueueUpdate): void;
  publishAvailabilityUpdate(update: AvailabilityUpdate): void;
}

export const noQueueUpdatePublisher: QueueUpdatePublisher = {
  publishQueueUpdate: () => undefined,
  publishAvailabilityUpdate: () => undefined
};
