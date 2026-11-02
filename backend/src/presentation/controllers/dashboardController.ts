import { DashboardService } from "../../application/services/DashboardService.js";
import type { RequestHandler } from "express";
import type { DashboardFilters } from "../../types/domain.js";
import { queryString, respond } from "./http.js";

export function createDashboardController(): Record<string, RequestHandler> {
  const dashboard = new DashboardService();

  return {
    dashboardStats: async (req, res) => {
      const filters: DashboardFilters = {
        ...(queryString(req, "from") !== undefined && { from: queryString(req, "from") }),
        ...(queryString(req, "to") !== undefined && { to: queryString(req, "to") })
      };
      return respond(res, await dashboard.getStats(filters));
    }
  };
}
