import type { RequestHandler } from "express";
import type { UserRole } from "../../types/domain.js";

export function authorize(...roles: UserRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "You do not have permission to perform this action." }
      });
    }
    return next();
  };
}
