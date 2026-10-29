import mongoose from "mongoose";
import { APPOINTMENT_STATUSES } from "../../../domain/appointment.js";
import type { AppointmentStatus } from "../../../types/domain.js";

export interface AppointmentRecord {
  reference: string;
  customer: mongoose.Types.ObjectId;
  service: mongoose.Types.ObjectId;
  staff: mongoose.Types.ObjectId;
  start: Date;
  end: Date;
  reservedMinutes?: Date[];
  status: AppointmentStatus;
  cancelledAt?: Date;
}

const appointmentSchema = new mongoose.Schema<AppointmentRecord>(
  {
    reference: { type: String, required: true, unique: true },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    staff: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    start: { type: Date, required: true },
    end: { type: Date, required: true },
    reservedMinutes: { type: [Date], default: undefined, select: false },
    status: { type: String, enum: APPOINTMENT_STATUSES, default: "Pending" },
    cancelledAt: Date
  },
  { timestamps: true, optimisticConcurrency: true, autoIndex: false }
);

// 1 means ascending (smallest/earliest first); these keys support staff/time range queries.
appointmentSchema.index({ staff: 1, start: 1, end: 1 });

appointmentSchema.index(
  { staff: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "In Service" },
    name: "unique_staff_in_service"
  }
);

// The unique multikey index prevents one staff member from being booked for the same minute twice.
appointmentSchema.index(
  { staff: 1, reservedMinutes: 1 },
  {
    unique: true,
    partialFilterExpression: { reservedMinutes: { $exists: true } },
    name: "unique_staff_reserved_minute"
  }
);

// With customer fixed, -1 keeps that customer's appointments ordered newest first in the index.
appointmentSchema.index({ customer: 1, start: -1 });

// Ascending status/start order supports filtering by status and scanning appointments by time.
appointmentSchema.index({ status: 1, start: 1 });

export const Appointment = mongoose.model("Appointment", appointmentSchema);
