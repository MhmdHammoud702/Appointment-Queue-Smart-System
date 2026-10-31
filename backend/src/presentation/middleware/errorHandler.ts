import mongoose from "mongoose";
import { DomainError } from "../../domain/DomainError.js";
import { logger, serializeError } from "../../infrastructure/logging/logger.js";
import type { ErrorRequestHandler, RequestHandler } from "express";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: { code: "ROUTE_NOT_FOUND", message: `Route ${req.method} ${req.path} was not found.` }
  });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  const context = {
    method: req.method,
    path: req.path,
    userId: req.user?.id,
    userRole: req.user?.role
  };

  if (
    error instanceof SyntaxError &&
    "status" in error &&
    error.status === 400 &&
    "body" in error
  ) {
    logger.warn("Request rejected because its JSON body is invalid.", {
      ...context,
      errorCode: "INVALID_JSON"
    });
    return res.status(400).json({
      success: false,
      error: { code: "INVALID_JSON", message: "The request body must contain valid JSON." }
    });
  }
  if (error instanceof DomainError) {
    const logRequestFailure = error.statusCode >= 500 ? logger.error : logger.warn;
    logRequestFailure(error.message, {
      ...context,
      statusCode: error.statusCode,
      errorCode: error.code
    });
    return res.status(error.statusCode).json({
      success: false,
      error: { code: error.code, message: error.message }
    });
  }
  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
    logger.warn("Request failed database validation.", {
      ...context,
      errorCode: "DATABASE_VALIDATION_ERROR",
      error: serializeError(error)
    });
    return res.status(400).json({
      success: false,
      error: { code: "DATABASE_VALIDATION_ERROR", message: error.message }
    });
  }
  if (error instanceof mongoose.Error.VersionError) {
    logger.warn("Request failed because the record changed concurrently.", {
      ...context,
      errorCode: "RESOURCE_CHANGED"
    });
    return res.status(409).json({
      success: false,
      error: { code: "RESOURCE_CHANGED", message: "This record changed. Refresh and try again." }
    });
  }
  if (error.code === 11000) {
    logger.warn("Request failed because a record already exists.", {
      ...context,
      errorCode: "DUPLICATE_RESOURCE"
    });
    return res.status(409).json({
      success: false,
      error: { code: "DUPLICATE_RESOURCE", message: "A record with these details already exists." }
    });
  }

  logger.error("Unhandled request error.", {
    ...context,
    errorCode: "INTERNAL_SERVER_ERROR",
    error: serializeError(error)
  });
  return res.status(500).json({
    success: false,
    error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." }
  });
};
