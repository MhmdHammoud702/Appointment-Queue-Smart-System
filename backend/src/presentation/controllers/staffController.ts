import type { QueueUpdatePublisher } from "../../application/ports/QueueUpdatePublisher.js";
import { StaffService } from "../../application/services/StaffService.js";
import type { RequestHandler } from "express";
import { authenticatedUser, queryString, respond, routeParam } from "./http.js";

export function createStaffController(
  updatePublisher: QueueUpdatePublisher
): Record<string, RequestHandler> {
  const staff = new StaffService(updatePublisher);

  return {
    listStaff: async (req, res) => respond(res, await staff.listStaff(queryString(req, "serviceId"))),
    listEmployees: async (_req, res) => respond(res, await staff.listEmployees()),
    setEmployeeStatus: async (req, res) =>
      respond(res, await staff.setEmployeeActive(routeParam(req, "id"), req.body?.active)),
    deleteStaff: async (req, res) => respond(res, await staff.deleteStaff(routeParam(req, "id"))),
    getSchedule: async (req, res) => {
      const user = authenticatedUser(req);
      const staffId = routeParam(req, "id");
      if (user.role === "Staff" && user.id !== staffId) {
        return res.status(403).json({
          success: false,
          error: { code: "FORBIDDEN", message: "You can only view your own schedule." }
        });
      }
      return respond(res, await staff.getSchedule(staffId));
    },
    saveSchedule: async (req, res) =>
      respond(res, await staff.saveSchedule(routeParam(req, "id"), req.body))
  };
}
