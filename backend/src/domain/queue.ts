import { DomainError } from "./DomainError.js";
import type { QueueStatus } from "../types/domain.js";

const allowed: Partial<Record<QueueStatus, readonly QueueStatus[]>> = {
  Waiting: ["In Service"],
  "In Service": ["Completed"]
};

export function assertQueueTransition(currentStatus: QueueStatus, nextStatus: QueueStatus): void {
  if (!allowed[currentStatus]?.includes(nextStatus)) {
    throw new DomainError(
      `A queue entry cannot move from "${currentStatus}" to "${nextStatus}".`,
      409,
      "INVALID_QUEUE_TRANSITION"
    );
  }
}
