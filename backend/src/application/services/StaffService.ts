import { DomainError } from "../../domain/DomainError.js";
import { Service, StaffSchedule, User } from "../../infrastructure/database/models/index.js";
import type { ScheduleInput } from "../../types/domain.js";
import type { WorkingInterval } from "../../types/domain.js";

export class StaffService {
  async listStaff(serviceId?: string) {
    let staffIds;
    if (serviceId) {
      const schedule = await StaffSchedule.find({ services: serviceId }).select("staff");
      staffIds = schedule.map((item) => item.staff);
    }
    return User.find({ role: "Staff", ...(staffIds ? { _id: { $in: staffIds } } : {}) })
      .select("fullName email phone")
      .sort({ fullName: 1 });
  }

  async getSchedule(staffId: string) {
    const schedule = await StaffSchedule.findOne({ staff: staffId }).populate("services", "name durationMinutes active");
    if (!schedule) throw new DomainError("Staff schedule not found.", 404, "SCHEDULE_NOT_FOUND");
    return schedule;
  }

  async saveSchedule(staffId: string, input: ScheduleInput) {
    const staff = await User.findOne({ _id: staffId, role: "Staff" });
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

    return StaffSchedule.findOneAndUpdate(
      { staff: staffId },
      { $set: { weeklyIntervals: input.weeklyIntervals, daysOff: input.daysOff, services: input.services } },
      { new: true, upsert: true, runValidators: true }
    ).populate("services", "name durationMinutes active");
  }
}
