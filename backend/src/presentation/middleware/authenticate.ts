import jwt from "jsonwebtoken";
import { env } from "../../infrastructure/config/env.js";
import { User } from "../../infrastructure/database/models/User.js";
import type { RequestHandler } from "express";
import type { AuthUser, UserRole } from "../../types/domain.js";

function readUser(req: Parameters<RequestHandler>[0]): AuthUser | null {
  const authorization = req.get("authorization");
  const [scheme, token] = authorization?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) return null;
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (
    typeof payload === "string" ||
    typeof payload.sub !== "string" ||
    typeof payload.fullName !== "string" ||
    !["Customer", "Staff", "Receptionist", "Admin"].includes(String(payload.role))
  ) {
    throw new Error("Invalid authentication token.");
  }
  return {
    id: payload.sub,
    role: payload.role as UserRole,
    fullName: payload.fullName
  }
};

export const authenticate: RequestHandler = async (req, res, next) => {
  let user: AuthUser | null;
  try {
    user = readUser(req);
  } catch {
    return res.status(401).json({
      success: false,
      error: { code: "INVALID_TOKEN", message: "Your token is invalid or has expired." }
    });
  }

  if (!user) {
    return res.status(401).json({
      success: false,
      error: { code: "AUTHENTICATION_REQUIRED", message: "Sign in to access this resource." }
    });
  }
  const account = await User.findById(user.id).select("isActive");
  if (!account || !account.isActive) {
    return res.status(401).json({
      success: false,
      error: { code: "ACCOUNT_DEACTIVATED", message: "This account is unavailable. Contact an administrator." }
    });
  }
  req.user = user;
  return next();
};

export const optionalAuthenticate: RequestHandler = async (req, res, next) => {
  let user: AuthUser | null;
  try {
    user = readUser(req);
  } catch {
    return res.status(401).json({
      success: false,
      error: { code: "INVALID_TOKEN", message: "Your token is invalid or has expired." }
    });
  }

  if (user) {
    const account = await User.findById(user.id).select("isActive");
    if (!account || !account.isActive) {
      return res.status(401).json({
        success: false,
        error: { code: "ACCOUNT_DEACTIVATED", message: "This account is unavailable. Contact an administrator." }
      });
    }
  }
  req.user = user ?? undefined;
  return next();
};
