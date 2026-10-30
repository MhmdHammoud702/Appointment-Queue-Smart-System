import { DomainError } from "../../domain/DomainError.js";
import {
  assertAppointmentDoesNotOverlap,
  assertAppointmentStartsOnSlot,
  assertAppointmentTransition,
  createBookingReference,
  getReservedMinuteStarts
} from "../../domain/appointment.js";
import { addMinutes, getLocalDateParts, zonedDateTimeToUtc } from "../../domain/time.js";
import { env } from "../../infrastructure/config/env.js";
import {
  Appointment,
  Service,
  StaffSchedule,
  User
} from "../../infrastructure/database/models/index.js";
import { QueueEntry } from "../../infrastructure/database/models/QueueEntry.js";
import { sendAppointmentEmail } from "../../infrastructure/email/emailService.js";
import {
  noQueueUpdatePublisher,
  type QueueUpdatePublisher
} from "../ports/QueueUpdatePublisher.js";
import type { FilterQuery, HydratedDocument } from "mongoose";
import type {
  AppointmentBookingInput,
  AppointmentFilters,
  AuthUser,
  AvailabilityInput
} from "../../types/domain.js";
import type { AppointmentRecord } from "../../infrastructure/database/models/Appointment.js";
import type { StaffScheduleRecord } from "../../infrastructure/database/models/StaffSchedule.js";
import type { UserRecord } from "../../infrastructure/database/models/User.js";
import type { ServiceRecord } from "../../infrastructure/database/models/Service.js";

const appointmentDetails = [
  { path: "customer", select: "fullName email phone" },
  { path: "service", select: "name durationMinutes price active" },
  { path: "staff", select: "fullName email phone" }
];

// Accept either an ISO start time or a clinic-local date/time, then reject past or invalid dates.
function getFutureAppointmentStart(
  input: Pick<AppointmentBookingInput, "start" | "date" | "time">
): Date {
  let start: Date;

  if (input.start) {
    start = new Date(input.start);
  } else if (input.date && input.time) {
    start = zonedDateTimeToUtc(input.date, input.time, env.BUSINESS_TIME_ZONE);
  } else {
    throw new DomainError("Choose a valid appointment time in the future.");
  }

  if (Number.isNaN(start.getTime()) || start <= new Date()) {
    throw new DomainError("Choose a valid appointment time in the future.");
  }

  return start;
}

export class AppointmentService {
  constructor(
    private readonly updatePublisher: QueueUpdatePublisher = noQueueUpdatePublisher
  ) {}

  // Return future slot candidates and mark candidates blocked by active appointments.
  async getAvailability({ serviceId, staffId, date }: AvailabilityInput) {
    const service = await Service.findOne({ _id: serviceId, active: true });
    if (!service) throw new DomainError("Active service not found.", 404, "SERVICE_NOT_FOUND");

    const [staff, schedule] = await Promise.all([
      User.findOne({ _id: staffId, role: "Staff", isActive: { $ne: false } }),
      StaffSchedule.findOne({ staff: staffId })
    ]);
    if (!staff) throw new DomainError("Active staff member not found.", 404, "STAFF_NOT_FOUND");
    if (!schedule || !schedule.services.some((id) => id.equals(serviceId))) {
      throw new DomainError("This staff member is not assigned to the selected service.", 400, "STAFF_NOT_QUALIFIED");
    }

    const scheduleDate = zonedDateTimeToUtc(date, "12:00", env.BUSINESS_TIME_ZONE);
    const weekday = getLocalDateParts(scheduleDate, env.BUSINESS_TIME_ZONE).weekday;
    const intervals = schedule.weeklyIntervals.filter((interval) => interval.day === weekday);
    if (schedule.daysOff.includes(weekday) || intervals.length === 0) return [];

    const dayStart = zonedDateTimeToUtc(date, "00:00", env.BUSINESS_TIME_ZONE);
    const dayEnd = zonedDateTimeToUtc(date, "23:59", env.BUSINESS_TIME_ZONE);
    const existing = await Appointment.find({
      staff: staffId,
      start: { $lt: dayEnd },
      end: { $gt: dayStart },
      status: { $nin: ["Cancelled", "No-show", "Completed"] }
    }).select("start end");

    const now = new Date();
    const slots = [];
    for (const interval of intervals) {
      const startMinutes = Number(interval.from.slice(0, 2)) * 60 + Number(interval.from.slice(3));
      const endMinutes = Number(interval.to.slice(0, 2)) * 60 + Number(interval.to.slice(3));
      for (
        let minutes = startMinutes;
        minutes + service.durationMinutes <= endMinutes;
        minutes += service.durationMinutes
      ) {
        const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
        const start = zonedDateTimeToUtc(date, time, env.BUSINESS_TIME_ZONE);
        const end = addMinutes(start, service.durationMinutes);
        if (start <= now) continue;
        const available = !existing.some(
          (appointment) => start < appointment.end && end > appointment.start
        );
        slots.push({ time, start, end, available });
      }
    }
    return slots;
  }

  // Recheck eligibility and availability, then rely on the unique index to catch booking races.
  async createAppointment(customerId: string, input: AppointmentBookingInput) {
    const start = getFutureAppointmentStart(input);
    const parts = getLocalDateParts(start, env.BUSINESS_TIME_ZONE);
    const { service, staff, schedule } = await this.getEligibleStaffAndService(input.service, input.staff);
    this.assertStaffWorksAt(schedule, parts, service.durationMinutes, start);
    const end = addMinutes(start, service.durationMinutes);
    await this.assertNoOverlap(input.staff, start, end);

    const appointment = await Appointment.create({
      reference: createBookingReference(),
      customer: customerId,
      service: service.id,
      staff: staff.id,
      staffNameSnapshot: staff.fullName,
      start,
      end,
      reservedMinutes: getReservedMinuteStarts(start, end),
      status: "Pending"
    });
    const staffStillActive = await User.exists({
      _id: staff.id,
      role: "Staff",
      isActive: { $ne: false }
    });
    if (!staffStillActive) {
      await Appointment.deleteOne({ _id: appointment.id });
      throw new DomainError("The selected staff member is no longer available.", 409, "STAFF_UNAVAILABLE");
    }
    const result = await this.loadAppointmentDetails(appointment.id);
    this.updatePublisher.publishQueueUpdate({ event: "booked", data: result });
    this.updatePublisher.publishAvailabilityUpdate({
      staffId: String(staff.id),
      serviceId: String(service.id),
      date: parts.date
    });
    this.updatePublisher.publishAppointmentBooked({
      customerName: result.customer.fullName
    });
    return result;
  }

  // Apply role-based visibility and optional filters before returning appointments by start time.
  async listAppointments(user: AuthUser, filters: AppointmentFilters = {}) {
    const query: FilterQuery<AppointmentRecord> = {};
    if (user.role === "Customer") query.customer = user.id;
    if (user.role === "Staff") query.staff = user.id;
    if (filters.status) query.status = filters.status;
    if (filters.from || filters.to) {
      query.start = {
        ...(filters.from ? { $gte: new Date(filters.from) } : {}),
        ...(filters.to ? { $lte: new Date(filters.to) } : {})
      };
    }
    // start: 1 sorts earliest first; use -1 when a view should show the newest appointment first.
    return Appointment.find(query).populate(appointmentDetails).sort({ start: 1 });
  }

  // Check access before returning the appointment with its related customer, service, and staff.
  async getAppointment(user: AuthUser, appointmentId: string) {
    const appointment = await Appointment.findById(appointmentId);
    this.assertCanAccess(user, appointment);
    return this.loadAppointmentDetails(appointment.id);
  }

  // Confirm the status change, save it, then notify the customer.
  async confirmAppointment(user: AuthUser, appointmentId: string) {
    if (user.role !== "Admin" && user.role !== "Receptionist") {
      throw new DomainError("Only admins and receptionists can confirm appointments.", 403, "FORBIDDEN");
    }
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) throw new DomainError("Appointment not found.", 404, "APPOINTMENT_NOT_FOUND");
    assertAppointmentTransition(appointment.status, "Confirmed");
    appointment.status = "Confirmed";
    await appointment.save();
    const result = await this.loadAppointmentDetails(appointment.id);
    this.updatePublisher.publishQueueUpdate({ event: "confirmed", data: result });
    await sendAppointmentEmail(result, "confirmed");
    return result;
  }

  // Cancel the appointment and release its reserved minutes before updating the queue and notifying the customer.
  async cancelAppointment(user: AuthUser, appointmentId: string) {
    const appointment = await Appointment.findById(appointmentId);
    this.assertCanAccess(user, appointment);
    assertAppointmentTransition(appointment.status, "Cancelled");
    appointment.status = "Cancelled";
    appointment.cancelledAt = new Date();
    appointment.set("reservedMinutes", undefined);
    await appointment.save();
    const appointmentDate = getLocalDateParts(appointment.start, env.BUSINESS_TIME_ZONE).date;
    const queueEntry = await QueueEntry.findOneAndUpdate(
      { appointment: appointment.id, status: { $in: ["Waiting", "Called", "In Service"] } },
      { $set: { status: "Cancelled" } },
      { new: true }
    );
    const result = await this.loadAppointmentDetails(appointment.id);
    this.updatePublisher.publishQueueUpdate({
      event: "cancelled",
      data: { appointment: result, queueEntry }
    });
    this.updatePublisher.publishAvailabilityUpdate({
      staffId: String(appointment.staff),
      serviceId: String(appointment.service),
      date: appointmentDate
    });
    await sendAppointmentEmail(result, "cancelled");
    return result;
  }

  // Validate the replacement time and save it only if its reserved minutes are still available.
  async rescheduleAppointment(user: AuthUser, appointmentId: string, input: AppointmentBookingInput) {
    const appointment = await Appointment.findById(appointmentId);
    this.assertCanAccess(user, appointment);
    if (!["Pending", "Confirmed"].includes(appointment.status)) {
      throw new DomainError("Only pending or confirmed appointments can be rescheduled.", 409);
    }

    const previousDate = getLocalDateParts(appointment.start, env.BUSINESS_TIME_ZONE).date;
    const start = getFutureAppointmentStart(input);
    const parts = getLocalDateParts(start, env.BUSINESS_TIME_ZONE);
    const { service, schedule } = await this.getEligibleStaffAndService(
      String(appointment.service),
      String(appointment.staff)
    );
    const end = addMinutes(start, service.durationMinutes);
    this.assertStaffWorksAt(schedule, parts, service.durationMinutes, start);
    await this.assertNoOverlap(String(appointment.staff), start, end, appointment.id);
    appointment.start = start;
    appointment.end = end;
    appointment.reservedMinutes = getReservedMinuteStarts(start, end);
    await appointment.save();

    const result = await this.loadAppointmentDetails(appointment.id);
    this.updatePublisher.publishQueueUpdate({ event: "rescheduled", data: result });
    for (const date of new Set([previousDate, parts.date])) {
      this.updatePublisher.publishAvailabilityUpdate({
        staffId: String(appointment.staff),
        serviceId: String(appointment.service),
        date
      });
    }
    await sendAppointmentEmail(result, "rescheduled");
    return result;
  }

  // Allow admins, the appointment's customer, or its assigned staff member to access it.
  assertCanAccess(
    user: AuthUser,
    appointment: HydratedDocument<AppointmentRecord> | null
  ): asserts appointment is HydratedDocument<AppointmentRecord> {
    if (!appointment) throw new DomainError("Appointment not found.", 404, "APPOINTMENT_NOT_FOUND");
    if (user.role === "Admin") return;
    const ownerId = String(appointment.customer);
    const staffId = String(appointment.staff);
    if (user.role === "Customer" && ownerId === user.id) return;
    if (user.role === "Staff" && staffId === user.id) return;
    throw new DomainError("You do not have access to this appointment.", 403, "FORBIDDEN");
  }

  // Load the active service, staff member, and schedule, then verify the staff member can perform that service.
  async getEligibleStaffAndService(serviceId: string, staffId: string) {
    const [service, staff, schedule] = await Promise.all([
      Service.findOne({ _id: serviceId, active: true }),
      User.findOne({ _id: staffId, role: "Staff", isActive: { $ne: false } }),
      StaffSchedule.findOne({ staff: staffId })
    ]);
    if (!service) throw new DomainError("Active service not found.", 404, "SERVICE_NOT_FOUND");
    if (!staff || !schedule) throw new DomainError("Staff schedule not found.", 404, "STAFF_NOT_FOUND");
    if (!schedule.services.some((id) => id.equals(serviceId))) {
      throw new DomainError("This staff member is not assigned to the selected service.", 400, "STAFF_NOT_QUALIFIED");
    }
    return { service, staff, schedule };
  }

  // Make sure the full service duration fits and the start aligns with that service's slot length.
  assertStaffWorksAt(
    schedule: StaffScheduleRecord,
    parts: { time: string; weekday: number },
    durationMinutes: number,
    start: Date
  ): void {
    const startMinutes = Number(parts.time.slice(0, 2)) * 60 + Number(parts.time.slice(3));
    const endMinutes = startMinutes + durationMinutes;
    const worksToday =
      !schedule.daysOff.includes(parts.weekday) &&
      schedule.weeklyIntervals.some((interval) => {
        const from = Number(interval.from.slice(0, 2)) * 60 + Number(interval.from.slice(3));
        const to = Number(interval.to.slice(0, 2)) * 60 + Number(interval.to.slice(3));
        return startMinutes >= from && endMinutes <= to;
      });
    if (!worksToday) {
      throw new DomainError("The selected appointment is outside this staff member's working hours.", 400, "OUTSIDE_WORKING_HOURS");
    }
    assertAppointmentStartsOnSlot(
      start,
      parts.time,
      schedule.weeklyIntervals,
      parts.weekday,
      durationMinutes
    );
  }

  // Find interval conflicts; excludeId lets a rescheduled appointment ignore its own old time.
  async assertNoOverlap(
    staffId: string,
    start: Date,
    end: Date,
    excludeId?: string
  ) {
    const query: FilterQuery<AppointmentRecord> = {
      staff: staffId,
      start: { $lt: end },
      end: { $gt: start },
      status: { $nin: ["Cancelled", "No-show", "Completed"] }
    };
    if (excludeId) query._id = { $ne: excludeId };
    const appointments = await Appointment.find(query).select("start end");
    assertAppointmentDoesNotOverlap(start, end, appointments);
  }

  // Reload the appointment with the related records needed by API responses and email notifications.
  private async loadAppointmentDetails(appointmentId: string) {
    const appointment = await Appointment.findById(appointmentId).populate<{
      customer: UserRecord;
      service: ServiceRecord;
      staff: UserRecord;
    }>(appointmentDetails);
    if (!appointment) {
      throw new DomainError("Appointment not found.", 404, "APPOINTMENT_NOT_FOUND");
    }
    return appointment;
  }
}
