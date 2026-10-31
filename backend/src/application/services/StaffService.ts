import { DomainError } from "../../domain/DomainError.js";
import { getLocalDateParts } from "../../domain/time.js";
import { env } from "../../infrastructure/config/env.js";
import { logger, serializeError } from "../../infrastructure/logging/logger.js";
import {
  Appointment,
  QueueEntry,
  Service,
  StaffSchedule,
  User
} from "../../infrastructure/database/models/index.js";
import {
  sendStaffScheduleChangedEmail,
  sendStaffUnavailableEmail
} from "../../infrastructure/email/emailService.js";
import type { UserRecord } from "../../infrastructure/database/models/User.js";
import type { ServiceRecord } from "../../infrastructure/database/models/Service.js";
import type { StaffScheduleRecord } from "../../infrastructure/database/models/StaffSchedule.js";
import type { ScheduleInput } from "../../types/domain.js";
import type { WorkingInterval } from "../../types/domain.js";
import {
  noQueueUpdatePublisher,
  type QueueUpdatePublisher
} from "../ports/QueueUpdatePublisher.js";

export class StaffService {
  constructor(private readonly updatePublisher: QueueUpdatePublisher = noQueueUpdatePublisher) {}

  async listStaff(serviceId?: string) {
    let staffIds;
    if (serviceId) {
      const schedule = await StaffSchedule.find({ services: serviceId }).select("staff");
      staffIds = schedule.map((item) => item.staff);
    }
    return User.find({
      role: "Staff",
      isActive: { $ne: false },
      ...(staffIds ? { _id: { $in: staffIds } } : {})
    })
      .select("fullName email phone")
      .sort({ fullName: 1 });
  }

  listEmployees() {
    return User.find({ role: { $in: ["Staff", "Receptionist"] } })
      .select("fullName email phone role isActive")
      .sort({ fullName: 1 });
  }

  async setEmployeeActive(employeeId: string, active: unknown) {
    if (typeof active !== "boolean") {
      throw new DomainError("Choose whether the employee account should be active.", 400, "INVALID_STATUS");
    }

    const employee = await User.findOneAndUpdate(
      { _id: employeeId, role: { $in: ["Staff", "Receptionist"] } },
      { $set: { isActive: active } },
      { new: true, runValidators: true }
    );
    if (!employee) {
      throw new DomainError("Staff or receptionist account not found.", 404, "EMPLOYEE_NOT_FOUND");
    }
    if (active) return { employee, cancelledAppointments: 0, failedNotifications: 0 };

    this.updatePublisher.revokeUserAccess(employeeId);
    if (employee.role !== "Staff") {
      return { employee, cancelledAppointments: 0, failedNotifications: 0 };
    }

    const now = new Date();
    const appointments = await Appointment.find({
      staff: employeeId,
      start: { $gte: now },
      status: { $in: ["Pending", "Confirmed", "Checked In"] }
    }).populate<{
      customer: Pick<UserRecord, "fullName" | "email"> & { _id: unknown };
      service: (Pick<ServiceRecord, "name"> & { _id: unknown }) | null;
      staff: (Pick<UserRecord, "fullName"> & { _id: unknown }) | null;
    }>([
      { path: "customer", select: "fullName email" },
      { path: "service", select: "name" },
      { path: "staff", select: "fullName" }
    ]);

    for (const appointment of appointments) {
      appointment.status = "Cancelled";
      appointment.cancelledAt = now;
      appointment.cancellationReason = "Staff no longer available";
      appointment.set("reservedMinutes", undefined);
      await appointment.save();

      const queueEntry = await QueueEntry.findOneAndUpdate(
        { appointment: appointment.id, status: { $in: ["Waiting", "Called", "In Service"] } },
        { $set: { status: "Cancelled" } },
        { new: true }
      );
      this.updatePublisher.publishQueueUpdate({
        event: "cancelled",
        data: { appointment, queueEntry }
      });
      this.updatePublisher.publishAvailabilityUpdate({
        staffId: employeeId,
        serviceId: String(appointment.service?._id ?? appointment.service),
        date: getLocalDateParts(appointment.start, env.BUSINESS_TIME_ZONE).date
      });
    }

    let failedNotifications = 0;
    for (const appointment of appointments) {
      try {
        if (!(await sendStaffUnavailableEmail(appointment))) failedNotifications += 1;
      } catch (error) {
        failedNotifications += 1;
        logger.error("Could not send staff-unavailable email.", {
          appointmentReference: appointment.reference,
          error: serializeError(error)
        });
      }
    }

    return {
      employee,
      cancelledAppointments: appointments.length,
      failedNotifications
    };
  }

  async deleteStaff(staffId: string) {
    const staff = await User.findOne({ _id: staffId, role: "Staff" });
    if (!staff) {
      throw new DomainError("Staff member not found.", 404, "STAFF_NOT_FOUND");
    }
    if (staff.isActive) {
      throw new DomainError("Deactivate this staff account before deleting it.", 409, "STAFF_MUST_BE_DEACTIVATED");
    }

    const preservedAppointments = await Appointment.countDocuments({ staff: staffId });
    await Appointment.updateMany(
      {
        staff: staffId,
        $or: [{ staffNameSnapshot: { $exists: false } }, { staffNameSnapshot: "" }]
      },
      { $set: { staffNameSnapshot: staff.fullName } }
    );
    await StaffSchedule.deleteOne({ staff: staffId });
    const deleteResult = await User.deleteOne({ _id: staffId, role: "Staff", isActive: false });
    if (deleteResult.deletedCount !== 1) {
      throw new DomainError("Staff account changed before it could be deleted.", 409, "STAFF_DELETE_CONFLICT");
    }

    return {
      id: staffId,
      fullName: staff.fullName,
      preservedAppointments
    };
  }

  async getSchedule(staffId: string) {
    const schedule = await StaffSchedule.findOne({ staff: staffId }).populate("services", "name durationMinutes active");
    if (!schedule) throw new DomainError("Staff schedule not found.", 404, "SCHEDULE_NOT_FOUND");
    return schedule;
  }

  async saveSchedule(staffId: string, input: ScheduleInput) {
    const staff = await User.findOne({ _id: staffId, role: "Staff", isActive: { $ne: false } });
    if (!staff) throw new DomainError("Staff member not found.", 404, "STAFF_NOT_FOUND");

    const serviceCount = await Service.countDocuments({ _id: { $in: input.services } });
    if (serviceCount !== new Set(input.services.map(String)).size) {
      throw new DomainError("One or more services were not found.", 400, "INVALID_SERVICE");
    }

    const intervalsByDay = new Map<number, WorkingInterval[]>();
    for (const interval of input.weeklyIntervals) {
      if (interval.from >= interval.to) {
        throw new DomainError("Each working interval must end after it starts.");
      }
      const intervals = intervalsByDay.get(interval.day) ?? [];
      intervals.push(interval);
      intervalsByDay.set(interval.day, intervals);
    }
    for (const intervals of intervalsByDay.values()) {
      intervals.sort((left, right) => left.from.localeCompare(right.from));
      if (intervals.some((interval, index) => index > 0 && intervals[index - 1]!.to > interval.from)) {
        throw new DomainError("Working intervals for the same day cannot overlap.");
      }
    }

    const schedule = await StaffSchedule.findOneAndUpdate(
      { staff: staffId },
      { $set: { weeklyIntervals: input.weeklyIntervals, daysOff: input.daysOff, services: input.services } },
      { new: true, upsert: true, runValidators: true }
    );
    if (!schedule) throw new DomainError("Staff schedule could not be saved.", 500, "SCHEDULE_SAVE_FAILED");

    const appointments = await Appointment.find({
      staff: staffId,
      start: { $gte: new Date() },
      status: { $in: ["Pending", "Confirmed", "Checked In"] }
    }).populate<{
      customer: Pick<UserRecord, "fullName" | "email"> & { _id: unknown };
      service: (Pick<ServiceRecord, "name"> & { _id: unknown }) | null;
      staff: (Pick<UserRecord, "fullName"> & { _id: unknown }) | null;
    }>([
      { path: "customer", select: "fullName email" },
      { path: "service", select: "name" },
      { path: "staff", select: "fullName" }
    ]);

    const scheduleServiceIds = new Set(schedule.services.map(String));
    const appointmentsToCancel = appointments.filter((appointment) => {
      const start = getLocalDateParts(appointment.start, env.BUSINESS_TIME_ZONE);
      const end = getLocalDateParts(appointment.end, env.BUSINESS_TIME_ZONE);
      const startMinutes = Number(start.time.slice(0, 2)) * 60 + Number(start.time.slice(3));
      const endMinutes = Number(end.time.slice(0, 2)) * 60 + Number(end.time.slice(3));
      const serviceId = String(appointment.service?._id ?? appointment.service);
      const fitsSchedule =
        start.weekday === end.weekday &&
        !schedule.daysOff.includes(start.weekday) &&
        schedule.weeklyIntervals.some((interval) => {
          if (interval.day !== start.weekday) return false;
          const intervalStart = Number(interval.from.slice(0, 2)) * 60 + Number(interval.from.slice(3));
          const intervalEnd = Number(interval.to.slice(0, 2)) * 60 + Number(interval.to.slice(3));
          return startMinutes >= intervalStart && endMinutes <= intervalEnd;
        });
      return !scheduleServiceIds.has(serviceId) || !fitsSchedule;
    });

    const cancelledAt = new Date();
    for (const appointment of appointmentsToCancel) {
      appointment.status = "Cancelled";
      appointment.cancelledAt = cancelledAt;
      appointment.cancellationReason = "Staff schedule changed";
      appointment.set("reservedMinutes", undefined);
      await appointment.save();

      const queueEntry = await QueueEntry.findOneAndUpdate(
        { appointment: appointment.id, status: { $in: ["Waiting", "Called", "In Service"] } },
        { $set: { status: "Cancelled" } },
        { new: true }
      );
      this.updatePublisher.publishQueueUpdate({
        event: "cancelled",
        data: { appointment, queueEntry }
      });
      this.updatePublisher.publishAvailabilityUpdate({
        staffId,
        serviceId: String(appointment.service?._id ?? appointment.service),
        date: getLocalDateParts(appointment.start, env.BUSINESS_TIME_ZONE).date
      });
    }

    let failedNotifications = 0;
    for (const appointment of appointmentsToCancel) {
      try {
        if (!(await sendStaffScheduleChangedEmail(appointment, schedule))) failedNotifications += 1;
      } catch (error) {
        failedNotifications += 1;
        logger.error("Could not send schedule-change email.", {
          appointmentReference: appointment.reference,
          error: serializeError(error)
        });
      }
    }

    const populatedSchedule = await StaffSchedule.findById(schedule.id)
      .populate("services", "name durationMinutes active");
    if (!populatedSchedule) {
      throw new DomainError("Staff schedule could not be loaded after saving.", 500, "SCHEDULE_LOAD_FAILED");
    }
    return {
      ...populatedSchedule.toObject(),
      cancelledAppointments: appointmentsToCancel.length,
      failedNotifications
    };
  }
}
