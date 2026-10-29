import crypto from "node:crypto";
import { DomainError } from "./DomainError.js";
import type { AppointmentStatus, WorkingInterval } from "../types/domain.js";

export const APPOINTMENT_STATUSES = Object.freeze([
  "Pending",
  "Confirmed",
  "Checked In",
  "In Service",
  "Completed",
  "Cancelled",
  "No-show"
] as const);

const transitions: Record<AppointmentStatus, readonly AppointmentStatus[]> = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Checked In", "Cancelled", "No-show"],
  "Checked In": ["In Service", "Cancelled"],
  "In Service": ["Completed"],
  Completed: [],
  Cancelled: [],
  "No-show": []
};

export function assertAppointmentTransition(
  currentStatus: AppointmentStatus,
  nextStatus: AppointmentStatus
): void {
  if (!transitions[currentStatus]?.includes(nextStatus)) {
    throw new DomainError(
      `An appointment cannot move from "${currentStatus}" to "${nextStatus}".`,
      409,
      "INVALID_APPOINTMENT_TRANSITION"
    );
  }
}

export function assertAppointmentDoesNotOverlap(
  start: Date,
  end: Date,
  appointments: Array<{ start: Date; end: Date }>
): void {
  if (appointments.some((appointment) => start < appointment.end && end > appointment.start)) {
    throw new DomainError("This time overlaps another appointment.", 409, "SLOT_UNAVAILABLE");
  }
}

export function getReservedMinuteStarts(start: Date, end: Date): Date[] {
  const minutes: Date[] = [];
  for (let time = start.getTime(); time < end.getTime(); time += 60_000) {
    minutes.push(new Date(time));
  }
  return minutes;
}

export function assertAppointmentStartsOnSlot(
  start: Date,
  time: string,
  intervals: WorkingInterval[],
  weekday: number,
  slotMinutes: number
): void {
  if (start.getUTCSeconds() !== 0 || start.getUTCMilliseconds() !== 0) {
    throw new DomainError("Appointments must start on a valid time slot.", 409, "SLOT_UNAVAILABLE");
  }

  const startMinutes = Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const isSlot = intervals.some((interval) => {
    if (interval.day !== weekday || time < interval.from || time >= interval.to) return false;
    const intervalStart = Number(interval.from.slice(0, 2)) * 60 + Number(interval.from.slice(3));
    return (startMinutes - intervalStart) % slotMinutes === 0;
  });

  if (!isSlot) {
    throw new DomainError("The selected time is not an available slot.", 409, "SLOT_UNAVAILABLE");
  }
}

export function createBookingReference() {
  return `APT-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}
