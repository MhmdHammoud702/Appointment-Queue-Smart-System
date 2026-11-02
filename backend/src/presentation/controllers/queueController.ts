import type { QueueUpdatePublisher } from "../../application/ports/QueueUpdatePublisher.js";
import { QueueService } from "../../application/services/QueueService.js";
import type { RequestHandler } from "express";
import { authenticatedUser, respond, routeParam } from "./http.js";

export function createQueueController(
  updatePublisher: QueueUpdatePublisher
): Record<string, RequestHandler> {
  const queue = new QueueService(updatePublisher);

  return {
    checkIn: async (req, res) => respond(res, await queue.checkIn(req.body.reference), 201),
    todayQueue: async (_req, res) => respond(res, await queue.getTodayQueue()),
    callQueueEntry: async (req, res) =>
      respond(res, await queue.callEntry(routeParam(req, "id"), authenticatedUser(req))),
    completeQueueEntry: async (req, res) =>
      respond(res, await queue.completeEntry(routeParam(req, "id"), authenticatedUser(req)))
  };
}
