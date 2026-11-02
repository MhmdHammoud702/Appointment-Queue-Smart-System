import { CatalogService } from "../../application/services/CatalogService.js";
import type { RequestHandler } from "express";
import { respond, routeParam } from "./http.js";

export function createCatalogController(): Record<string, RequestHandler> {
  const catalog = new CatalogService();

  return {
    listServices: async (req, res) =>
      respond(res, await catalog.listServices(req.user?.role === "Admin" && req.query.includeInactive === "true")),
    createService: async (req, res) => respond(res, await catalog.createService(req.body), 201),
    updateService: async (req, res) =>
      respond(res, await catalog.updateService(routeParam(req, "id"), req.body)),
    setServiceStatus: async (req, res) =>
      respond(res, await catalog.setServiceStatus(routeParam(req, "id"), req.body.active))
  };
}
