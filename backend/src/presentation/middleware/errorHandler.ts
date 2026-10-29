import mongoose from "mongoose";
import { DomainError } from "../../domain/DomainError.js";
import type { ErrorRequestHandler, RequestHandler } from "express";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: { code: "ROUTE_NOT_FOUND", message: `Route ${req.method} ${req.path} was not found.` }
  });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  if (
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400 &&
    "body" in error
  ) {
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_JSON", message: "The request body must contain valid JSON." }
    });
  }
  if (error instanceof DomainError) {
    return res.status(error.statusCode).json({
      success: false,
      error: { code: error.code, message: error.message }
    });
  }
  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
    return res.status(400).json({
      success: false,
      error: { code: "DATABASE_VALIDATION_ERROR", message: error.message }
    });
  }
  if (error instanceof mongoose.Error.VersionError) {
    return res.status(409).json({
      success: false,
      error: { code: "RESOURCE_CHANGED", message: "This record changed. Refresh and try again." }
    });
  }
  if (error.code === 11000) {
    return res.status(409).json({
      success: false,
      error: { code: "DUPLICATE_RESOURCE", message: "A record with these details already exists." }
    });
  }

  console.error("Unhandled request error:", error);
  return res.status(500).json({
    success: false,
    error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." }
  });
};
