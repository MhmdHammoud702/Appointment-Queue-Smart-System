import { DomainError } from "../../domain/DomainError.js";
import { assertAppointmentTransition } from "../../domain/appointment.js";
import { assertQueueTransition } from "../../domain/queue.js";
import { getLocalDateParts } from "../../domain/time.js";
import { env } from "../../infrastructure/config/env.js";
import { Appointment, QueueCounter, QueueEntry } from "../../infrastructure/database/models/index.js";
import type { AppointmentRecord } from "../../infrastructure/database/models/Appointment.js";
import type { ServiceRecord } from "../../infrastructure/database/models/Service.js";
import type { UserRecord } from "../../infrastructure/database/models/User.js";
import type { AuthUser } from "../../types/domain.js";
import {
  noQueueUpdatePublisher,
  type QueueUpdatePublisher
} from "../ports/QueueUpdatePublisher.js";
import type mongoose from "mongoose";

type QueueAppointment = AppointmentRecord & {
  _id: mongoose.Types.ObjectId;
  customer: UserRecord;
  service: ServiceRecord;
  staff: UserRecord;
};

export class QueueService {
  constructor(
    private readonly updatePublisher: QueueUpdatePublisher = noQueueUpdatePublisher
  ) {}

  async checkIn(reference: string) {
    const appointment = await Appointment.findOne({ reference }).populate<{
      customer: UserRecord;
      service: ServiceRecord;
      staff: UserRecord;
    }>([
      { path: "customer", select: "fullName" },
      { path: "service", select: "name durationMinutes" },
      { path: "staff", select: "fullName" }
    ]);
    if (!appointment) throw new DomainError("Appointment not found.", 404, "APPOINTMENT_NOT_FOUND");
    assertAppointmentTransition(appointment.status, "Checked In");
    const appointmentDate = getLocalDateParts(appointment.start, env.BUSINESS_TIME_ZONE).date;
    const today = getLocalDateParts(new Date(), env.BUSINESS_TIME_ZONE).date;
    if (appointmentDate !== today) {
      throw new DomainError(
        "Appointments can only be checked in on their scheduled date.",
        409,
        "APPOINTMENT_NOT_TODAY"
      );
    }

    const queueDate = getLocalDateParts(new Date(), env.BUSINESS_TIME_ZONE).date;
    // $inc is atomic, so simultaneous check-ins receive different numbers.
    const counter = await QueueCounter.findOneAndUpdate(
      { _id: queueDate },
      { $inc: { value: 1 } },
      { new: true, upsert: true }
    );
    const queueNumber = counter.value;
    let entry;
    try {
      entry = await QueueEntry.create({
        appointment: appointment.id,
        queueDate,
        queueNumber,
        checkedInAt: new Date()
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        throw new DomainError("This appointment has already been checked in.", 409, "ALREADY_CHECKED_IN");
      }
      throw error;
    }

    const updated = await Appointment.updateOne(
      { _id: appointment.id, status: "Confirmed" },
      { $set: { status: "Checked In" }, $inc: { __v: 1 } }
    );
    if (updated.modifiedCount !== 1) {
      await QueueEntry.deleteOne({ _id: entry.id });
      throw new DomainError("The appointment changed before check-in. Please refresh and try again.", 409);
    }
    const result = await QueueEntry.findById(entry.id).populate<{
      appointment: QueueAppointment;
    }>({
      path: "appointment",
      populate: [
        { path: "customer", select: "fullName" },
        { path: "service", select: "name durationMinutes" },
        { path: "staff", select: "fullName" }
      ]
    });
    this.updatePublisher.publishQueueUpdate({ event: "checked-in", data: result });
    return result;
  }

  async getTodayQueue() {
    const queueDate = getLocalDateParts(new Date(), env.BUSINESS_TIME_ZONE).date;
    return QueueEntry.find({ queueDate, status: { $nin: ["Completed", "Cancelled"] } })
      .populate<{ appointment: QueueAppointment }>({
        path: "appointment",
        populate: [
          { path: "customer", select: "fullName" },
          { path: "service", select: "name durationMinutes" },
          { path: "staff", select: "fullName" }
        ]
      })
      .sort({ checkedInAt: 1 });
  }

  async callEntry(entryId: string, user: AuthUser) {
    const entry = await QueueEntry.findById(entryId).populate<{
      appointment: AppointmentRecord & { _id: mongoose.Types.ObjectId };
    }>("appointment");
    if (!entry) throw new DomainError("Queue entry not found.", 404, "QUEUE_ENTRY_NOT_FOUND");
    this.assertCanManageEntry(user, entry.appointment);
    assertQueueTransition(entry.status, "In Service");
    assertAppointmentTransition(entry.appointment.status, "In Service");
    const activeAppointment = await Appointment.findOne({
      staff: entry.appointment.staff,
      status: "In Service",
      _id: { $ne: entry.appointment._id }
    });
    if (activeAppointment) {
      throw new DomainError(
        "This staff member already has an appointment in service.",
        409,
        "STAFF_ALREADY_IN_SERVICE"
      );
    }
    let updated;
    try {
      updated = await Appointment.updateOne(
        { _id: entry.appointment._id, status: "Checked In" },
        { $set: { status: "In Service" }, $inc: { __v: 1 } }
      );
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === 11000
      ) {
        throw new DomainError(
          "This staff member already has an appointment in service.",
          409,
          "STAFF_ALREADY_IN_SERVICE"
        );
      }
      throw error;
    }
    if (updated.modifiedCount !== 1) {
      throw new DomainError("The appointment changed before it was called.", 409);
    }
    entry.status = "In Service";
    entry.calledAt = new Date();
    await entry.save();
    this.updatePublisher.publishQueueUpdate({ event: "called", data: entry });
    return entry;
  }

  async completeEntry(entryId: string, user: AuthUser) {
    const entry = await QueueEntry.findById(entryId).populate<{
      appointment: AppointmentRecord & { _id: mongoose.Types.ObjectId };
    }>("appointment");
    if (!entry) throw new DomainError("Queue entry not found.", 404, "QUEUE_ENTRY_NOT_FOUND");
    this.assertCanManageEntry(user, entry.appointment);
    assertQueueTransition(entry.status, "Completed");
    assertAppointmentTransition(entry.appointment.status, "Completed");
    const updated = await Appointment.updateOne(
      { _id: entry.appointment._id, status: "In Service" },
      {
        $set: { status: "Completed" },
        $unset: { reservedMinutes: "" },
        $inc: { __v: 1 }
      }
    );
    if (updated.modifiedCount !== 1) {
      throw new DomainError("The appointment changed before completion.", 409);
    }
    entry.status = "Completed";
    entry.completedAt = new Date();
    await entry.save();
    this.updatePublisher.publishQueueUpdate({ event: "completed", data: entry });
    this.updatePublisher.publishAvailabilityUpdate({
      staffId: String(entry.appointment.staff),
      serviceId: String(entry.appointment.service),
      date: getLocalDateParts(entry.appointment.start, env.BUSINESS_TIME_ZONE).date
    });
    return entry;
  }

  private assertCanManageEntry(
    user: AuthUser,
    appointment: AppointmentRecord & { _id: mongoose.Types.ObjectId }
  ): void {
    if (user.role === "Admin") return;
    if (user.role === "Staff" && String(appointment.staff) === user.id) return;
    throw new DomainError("You can only manage queue entries assigned to you.", 403, "FORBIDDEN");
  }
}
