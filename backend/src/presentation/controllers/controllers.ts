import { AuthService } from "../../application/services/AuthService.js";
import { AppointmentService } from "../../application/services/AppointmentService.js";
import { CatalogService } from "../../application/services/CatalogService.js";
import { DashboardService } from "../../application/services/DashboardService.js";
import { QueueService } from "../../application/services/QueueService.js";
import { StaffService } from "../../application/services/StaffService.js";
import { DomainError } from "../../domain/DomainError.js";
import {
  noQueueUpdatePublisher,
  type QueueUpdatePublisher
} from "../../application/ports/QueueUpdatePublisher.js";
import type { Request, RequestHandler, Response } from "express";
import type { AppointmentFilters, AuthUser, AvailabilityInput, DashboardFilters } from "../../types/domain.js";

const respond = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });

function authenticatedUser(req: Request): AuthUser {
  if (!req.user) {
    throw new DomainError("Sign in to access this resource.", 401, "AUTHENTICATION_REQUIRED");
  }
  return req.user;
}

function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string") {
    throw new DomainError(`Invalid ${name}.`, 400, "INVALID_PARAMETER");
  }
  return value;
}

function queryString(req: Request, name: string): string | undefined {
  const value = req.query[name];
  return typeof value === "string" ? value : undefined;
}

export function createControllers(
  updatePublisher: QueueUpdatePublisher = noQueueUpdatePublisher
): Record<string, RequestHandler> {
  const auth = new AuthService();
  const appointments = new AppointmentService(updatePublisher);
  const catalog = new CatalogService();
  const dashboard = new DashboardService();
  const queue = new QueueService(updatePublisher);
  const staff = new StaffService(updatePublisher);

  return {
    register: async (req, res) => respond(res, await auth.registerCustomer(req.body), 201),
    login: async (req, res) => respond(res, await auth.login(req.body)),
    me: async (req, res) => respond(res, await auth.getCurrentUser(authenticatedUser(req).id)),
    logout: (_req, res) => respond(res, { message: "Logged out. Remove the bearer token from the client." }),
    listStaff: async (req, res) => respond(res, await staff.listStaff(queryString(req, "serviceId"))),
    listEmployees: async (_req, res) => respond(res, await staff.listEmployees()),
    setEmployeeStatus: async (req, res) =>
      respond(res, await staff.setEmployeeActive(routeParam(req, "id"), req.body?.active)),
    deleteStaff: async (req, res) => respond(res, await staff.deleteStaff(routeParam(req, "id"))),
    createStaff: async (req, res) => respond(res, await auth.createStaff(req.body), 201),
    createReceptionist: async (req, res) => respond(res, await auth.createReceptionist(req.body), 201),
    listServices: async (req, res) =>
      respond(res, await catalog.listServices(req.user?.role === "Admin" && req.query.includeInactive === "true")),
    createService: async (req, res) => respond(res, await catalog.createService(req.body), 201),
    updateService: async (req, res) =>
      respond(res, await catalog.updateService(routeParam(req, "id"), req.body)),
    setServiceStatus: async (req, res) =>
      respond(res, await catalog.setServiceStatus(routeParam(req, "id"), req.body.active)),
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
    saveSchedule: async (req, res) => respond(res, await staff.saveSchedule(routeParam(req, "id"), req.body)),
    availability: async (req, res) => {
      const input: AvailabilityInput = {
        serviceId: queryString(req, "serviceId") ?? "",
        staffId: queryString(req, "staffId") ?? "",
        date: queryString(req, "date") ?? ""
      };
      return respond(res, await appointments.getAvailability(input));
    },
    createAppointment: async (req, res) =>
      respond(res, await appointments.createAppointment(authenticatedUser(req).id, req.body), 201),
    listAppointments: async (req, res) =>
      respond(
        res,
        await appointments.listAppointments(
          authenticatedUser(req),
          {
            ...(queryString(req, "status") !== undefined && {
              status: queryString(req, "status") as AppointmentFilters["status"]
            }),
            ...(queryString(req, "from") !== undefined && { from: queryString(req, "from") }),
            ...(queryString(req, "to") !== undefined && { to: queryString(req, "to") })
          }
        )
      ),
    getAppointment: async (req, res) =>
      respond(res, await appointments.getAppointment(authenticatedUser(req), routeParam(req, "id"))),
    confirmAppointment: async (req, res) =>
      respond(res, await appointments.confirmAppointment(authenticatedUser(req), routeParam(req, "id"))),
    cancelAppointment: async (req, res) =>
      respond(res, await appointments.cancelAppointment(authenticatedUser(req), routeParam(req, "id"))),
    rescheduleAppointment: async (req, res) =>
      respond(res, await appointments.rescheduleAppointment(authenticatedUser(req), routeParam(req, "id"), req.body)),
    checkIn: async (req, res) => respond(res, await queue.checkIn(req.body.reference), 201),
    todayQueue: async (_req, res) => respond(res, await queue.getTodayQueue()),
    callQueueEntry: async (req, res) =>
      respond(res, await queue.callEntry(routeParam(req, "id"), authenticatedUser(req))),
    completeQueueEntry: async (req, res) =>
      respond(res, await queue.completeEntry(routeParam(req, "id"), authenticatedUser(req))),
    dashboardStats: async (req, res) => {
      const filters: DashboardFilters = {
        ...(queryString(req, "from") !== undefined && { from: queryString(req, "from") }),
        ...(queryString(req, "to") !== undefined && { to: queryString(req, "to") })
      };
      return respond(res, await dashboard.getStats(filters));
    }
  };
}
