import { AuthService } from "../../application/services/AuthService.js";
import type { RequestHandler } from "express";
import { authenticatedUser, respond } from "./http.js";

export function createAuthController(): Record<string, RequestHandler> {
  const auth = new AuthService();

  return {
    register: async (req, res) => respond(res, await auth.registerCustomer(req.body), 201),
    login: async (req, res) => respond(res, await auth.login(req.body)),
    createStaff: async (req, res) => respond(res, await auth.createStaff(req.body), 201),
    createReceptionist: async (req, res) => respond(res, await auth.createReceptionist(req.body), 201),
    me: async (req, res) => respond(res, await auth.getCurrentUser(authenticatedUser(req).id)),
    logout: (_req, res) =>
      respond(res, { message: "Logged out. Remove the bearer token from the client." })
  };
}
