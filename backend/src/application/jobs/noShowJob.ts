import cron from "node-cron";
import { Appointment } from "../../infrastructure/database/models/Appointment.js";
import { env } from "../../infrastructure/config/env.js";
import { getLocalDateParts } from "../../domain/time.js";
import { logger, serializeError } from "../../infrastructure/logging/logger.js";
import {
  noQueueUpdatePublisher,
  type QueueUpdatePublisher
} from "../ports/QueueUpdatePublisher.js";

export function startNoShowJob(
  updatePublisher: QueueUpdatePublisher = noQueueUpdatePublisher
) {
  return cron.schedule(env.NO_SHOW_CRON, async () => {
    try {
      const cutoff = new Date(Date.now() - env.CHECK_IN_GRACE_MINUTES * 60_000);
      const candidates = await Appointment.find({
        status: "Confirmed",
        start: { $lte: cutoff }
      }).select("staff service start");
      const result = await Appointment.updateMany(
        { status: "Confirmed", start: { $lte: cutoff } },
        {
          $set: { status: "No-show" },
          $unset: { reservedMinutes: "" },
          $inc: { __v: 1 }
        }
      );
      if (result.modifiedCount > 0) {
        updatePublisher.publishQueueUpdate({
          event: "no-show",
          data: { modifiedCount: result.modifiedCount }
        });
        for (const appointment of candidates) {
          updatePublisher.publishAvailabilityUpdate({
            staffId: String(appointment.staff),
            serviceId: String(appointment.service),
            date: getLocalDateParts(appointment.start, env.BUSINESS_TIME_ZONE).date
          });
        }
        logger.info("Marked appointments as no-show.", { modifiedCount: result.modifiedCount });
      }
    } catch (error) {
      logger.error("The no-show job failed.", { error: serializeError(error) });
    }
  });
}
