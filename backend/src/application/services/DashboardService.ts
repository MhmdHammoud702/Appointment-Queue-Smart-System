import { Appointment } from "../../infrastructure/database/models/Appointment.js";
import { getLocalDateParts, zonedDateTimeToUtc } from "../../domain/time.js";
import { env } from "../../infrastructure/config/env.js";
import type { DashboardFilters } from "../../types/domain.js";

function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year!, month! - 1, day! + days));
  const yearPart = result.getUTCFullYear();
  const monthPart = String(result.getUTCMonth() + 1).padStart(2, "0");
  const dayPart = String(result.getUTCDate()).padStart(2, "0");
  return `${yearPart}-${monthPart}-${dayPart}`;
}

export class DashboardService {
  async getStats({ from, to }: DashboardFilters = {}) {
    const today = getLocalDateParts(new Date(), env.BUSINESS_TIME_ZONE).date;
    const startDate = from ?? today;
    const endDate = to ?? today;
    const start = zonedDateTimeToUtc(startDate, "00:00", env.BUSINESS_TIME_ZONE);
    const end = zonedDateTimeToUtc(endDate, "23:59", env.BUSINESS_TIME_ZONE);
    const range = { start: { $gte: start, $lte: end } };
    const [total, completed, cancelled, waiting, revenue, chart] = await Promise.all([
      Appointment.countDocuments(range),
      Appointment.countDocuments({ ...range, status: "Completed" }),
      Appointment.countDocuments({ ...range, status: "Cancelled" }),
      Appointment.countDocuments({ ...range, status: "Checked In" }),
      Appointment.aggregate([
        { $match: { ...range, status: "Completed" } },
        { $lookup: { from: "services", localField: "service", foreignField: "_id", as: "serviceInfo" } },
        { $unwind: "$serviceInfo" },
        { $group: { _id: null, total: { $sum: "$serviceInfo.price" } } }
      ]),
      this.getSevenDayVolume(end)
    ]);

    return {
      from: startDate,
      to: endDate,
      appointments: total,
      completed,
      cancelled,
      waiting,
      estimatedRevenue: revenue[0]?.total ?? 0,
      sevenDayVolume: chart
    };
  }

  async getSevenDayVolume(endDate: Date) {
    const lastDate = getLocalDateParts(endDate, env.BUSINESS_TIME_ZONE).date;
    const firstDate = addCalendarDays(lastDate, -6);
    const start = zonedDateTimeToUtc(firstDate, "00:00", env.BUSINESS_TIME_ZONE);
    const results = await Appointment.aggregate([
      { $match: { start: { $gte: start, $lte: endDate }, status: { $ne: "Cancelled" } } },
      { $group: { _id: { $dateToString: { date: "$start", format: "%Y-%m-%d", timezone: env.BUSINESS_TIME_ZONE } }, count: { $sum: 1 } } }
    ]);
    const counts = new Map(results.map((item) => [item._id, item.count]));
    return Array.from({ length: 7 }, (_, index) => {
      const date = addCalendarDays(firstDate, index);
      return { date, count: counts.get(date) ?? 0 };
    });
  }
}
