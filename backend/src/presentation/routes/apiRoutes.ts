import { Router } from "express";
import { authenticate, optionalAuthenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { createControllers } from "../controllers/controllers.js";
import {
  noQueueUpdatePublisher,
  type QueueUpdatePublisher
} from "../../application/ports/QueueUpdatePublisher.js";

export function createApiRoutes(
  updatePublisher: QueueUpdatePublisher = noQueueUpdatePublisher
) {
  const router = Router();
  const controller = createControllers(updatePublisher);

  router.post("/auth/register", controller.register);
  router.post("/auth/login", controller.login);
  router.get("/auth/me", authenticate, controller.me);
  router.post("/auth/logout", authenticate, controller.logout);

  router.get("/users/staff", authenticate, controller.listStaff);
  router.post("/users/staff", authenticate, authorize("Admin"), controller.createStaff);
  router.post("/users/receptionists", authenticate, authorize("Admin"), controller.createReceptionist);
  router.get("/users/employees", authenticate, authorize("Admin"), controller.listEmployees);
  router.patch("/users/employees/:id/status", authenticate, authorize("Admin"), controller.setEmployeeStatus);
  router.delete("/users/staff/:id", authenticate, authorize("Admin"), controller.deleteStaff);

  router.get("/services", optionalAuthenticate, controller.listServices);
  router.post("/services", authenticate, authorize("Admin"), controller.createService);
  router.put("/services/:id", authenticate, authorize("Admin"), controller.updateService);
  router.patch("/services/:id/status", authenticate, authorize("Admin"), controller.setServiceStatus);

  router.get("/staff/:id/schedule", authenticate, controller.getSchedule);
  router.put("/staff/:id/schedule", authenticate, authorize("Admin"), controller.saveSchedule);

  router.get("/appointments/availability", controller.availability);
  router.post("/appointments", authenticate, authorize("Customer"), controller.createAppointment);
  router.get("/appointments", authenticate, controller.listAppointments);
  router.get("/appointments/:id", authenticate, controller.getAppointment);
  router.patch("/appointments/:id/cancel", authenticate, controller.cancelAppointment);
  router.patch("/appointments/:id/reschedule", authenticate, controller.rescheduleAppointment);
  router.patch("/appointments/:id/confirm", authenticate, authorize("Admin", "Receptionist"), controller.confirmAppointment);

  router.post("/queue/check-in", authenticate, authorize("Admin", "Receptionist"), controller.checkIn);
  router.get("/queue/today", authenticate, authorize("Admin", "Staff", "Receptionist"), controller.todayQueue);
  router.patch("/queue/:id/call", authenticate, authorize("Admin", "Staff"), controller.callQueueEntry);
  router.patch("/queue/:id/complete", authenticate, authorize("Admin", "Staff"), controller.completeQueueEntry);

  router.get("/dashboard/stats", authenticate, authorize("Admin"), controller.dashboardStats);
  return router;
}
