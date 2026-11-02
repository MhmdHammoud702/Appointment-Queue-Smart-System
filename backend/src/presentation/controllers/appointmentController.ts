import type { QueueUpdatePublisher } from "../../application/ports/QueueUpdatePublisher.js";
import { AppointmentService } from "../../application/services/AppointmentService.js";
import type { RequestHandler } from "express";
import type { AppointmentFilters, AvailabilityInput } from "../../types/domain.js";
import { authenticatedUser, queryString, respond, routeParam } from "./http.js";

export function createAppointmentController(
  updatePublisher: QueueUpdatePublisher
): Record<string, RequestHandler> {
  const appointments = new AppointmentService(updatePublisher);

  return {
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
        await appointments.listAppointments(authenticatedUser(req), {
          ...(queryString(req, "status") !== undefined && {
            status: queryString(req, "status") as AppointmentFilters["status"]
          }),
          ...(queryString(req, "from") !== undefined && { from: queryString(req, "from") }),
          ...(queryString(req, "to") !== undefined && { to: queryString(req, "to") })
        })
      ),
    getAppointment: async (req, res) =>
      respond(res, await appointments.getAppointment(authenticatedUser(req), routeParam(req, "id"))),
    confirmAppointment: async (req, res) =>
      respond(res, await appointments.confirmAppointment(authenticatedUser(req), routeParam(req, "id"))),
    cancelAppointment: async (req, res) =>
      respond(res, await appointments.cancelAppointment(authenticatedUser(req), routeParam(req, "id"))),
    rescheduleAppointment: async (req, res) =>
      respond(res, await appointments.rescheduleAppointment(authenticatedUser(req), routeParam(req, "id"), req.body))
  };
}
