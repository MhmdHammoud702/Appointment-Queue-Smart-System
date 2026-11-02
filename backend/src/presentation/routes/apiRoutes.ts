import { Router } from "express";
import { authenticate, optionalAuthenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { createAppointmentController } from "../controllers/appointmentController.js";
import { createAuthController } from "../controllers/authController.js";
import { createCatalogController } from "../controllers/catalogController.js";
import { createDashboardController } from "../controllers/dashboardController.js";
import { createQueueController } from "../controllers/queueController.js";
import { createStaffController } from "../controllers/staffController.js";
import {
  noQueueUpdatePublisher,
  type QueueUpdatePublisher
} from "../../application/ports/QueueUpdatePublisher.js";

export function createApiRoutes(
  updatePublisher: QueueUpdatePublisher = noQueueUpdatePublisher
) {
  const router = Router();
  const auth = createAuthController();
  const staff = createStaffController(updatePublisher);
  const catalog = createCatalogController();
  const appointments = createAppointmentController(updatePublisher);
  const queue = createQueueController(updatePublisher);
  const dashboard = createDashboardController();

  router.post("/auth/register", auth.register);
  router.post("/auth/login", auth.login);
  router.get("/auth/me", authenticate, auth.me);
  router.post("/auth/logout", authenticate, auth.logout);

  router.get("/users/staff", authenticate, staff.listStaff);
  router.post("/users/staff", authenticate, authorize("Admin"), auth.createStaff);
  router.post("/users/receptionists", authenticate, authorize("Admin"), auth.createReceptionist);
  router.get("/users/employees", authenticate, authorize("Admin"), staff.listEmployees);
  router.patch("/users/employees/:id/status", authenticate, authorize("Admin"), staff.setEmployeeStatus);
  router.delete("/users/staff/:id", authenticate, authorize("Admin"), staff.deleteStaff);

  router.get("/services", optionalAuthenticate, catalog.listServices);
  router.post("/services", authenticate, authorize("Admin"), catalog.createService);
  router.put("/services/:id", authenticate, authorize("Admin"), catalog.updateService);
  router.patch("/services/:id/status", authenticate, authorize("Admin"), catalog.setServiceStatus);

  router.get("/staff/:id/schedule", authenticate, staff.getSchedule);
  router.put("/staff/:id/schedule", authenticate, authorize("Admin"), staff.saveSchedule);

  router.get("/appointments/availability", appointments.availability);
  router.post("/appointments", authenticate, authorize("Customer"), appointments.createAppointment);
  router.get("/appointments", authenticate, appointments.listAppointments);
  router.get("/appointments/:id", authenticate, appointments.getAppointment);
  router.patch("/appointments/:id/cancel", authenticate, appointments.cancelAppointment);
  router.patch("/appointments/:id/reschedule", authenticate, appointments.rescheduleAppointment);
  router.patch("/appointments/:id/confirm", authenticate, authorize("Admin", "Receptionist"), appointments.confirmAppointment);

  router.post("/queue/check-in", authenticate, authorize("Admin", "Receptionist"), queue.checkIn);
  router.get("/queue/today", authenticate, authorize("Admin", "Staff", "Receptionist"), queue.todayQueue);
  router.patch("/queue/:id/call", authenticate, authorize("Admin", "Staff"), queue.callQueueEntry);
  router.patch("/queue/:id/complete", authenticate, authorize("Admin", "Staff"), queue.completeQueueEntry);

  router.get("/dashboard/stats", authenticate, authorize("Admin"), dashboard.dashboardStats);
  return router;
}
