import { DomainError } from "../../domain/DomainError.js";
import type { AuthUser } from "../../types/domain.js";
import type { Request, Response } from "express";

export const respond = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });

export function authenticatedUser(req: Request): AuthUser {
  if (!req.user) {
    throw new DomainError("Sign in to access this resource.", 401, "AUTHENTICATION_REQUIRED");
  }
  return req.user;
}

export function routeParam(req: Request, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string") {
    throw new DomainError(`Invalid ${name}.`, 400, "INVALID_PARAMETER");
  }
  return value;
}

export function queryString(req: Request, name: string): string | undefined {
  const value = req.query[name];
  return typeof value === "string" ? value : undefined;
}
