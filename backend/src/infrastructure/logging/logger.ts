import path from "node:path";
import { fileURLToPath } from "node:url";
import winston from "winston";
import { env } from "../config/env.js";

const logsDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../logs");
const lineFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...metadata } = info;
    const dateTime = new Date(String(timestamp))
      .toISOString()
      .slice(0, 16)
      .replace("T", " ");
    const code = String(metadata.errorCode ?? metadata.code ?? level).toUpperCase();
    const errorInfo = metadata.errorInfo;
    delete metadata.errorCode;
    delete metadata.code;
    delete metadata.errorInfo;
    delete metadata.service;

    const details = Object.keys(metadata).length ? ` ${JSON.stringify(metadata)}` : "";
    return `${dateTime} | ${code} | ${message}${errorInfo ? ` ${errorInfo}` : ""}${details}`;
  })
);

const fileTransport = (filename: string, level?: string) =>
  new winston.transports.File({
    filename: path.join(logsDirectory, filename),
    ...(level ? { level } : {}),
    maxsize: 5_000_000,
    maxFiles: 5,
    tailable: true,
    format: lineFormat
  });

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: "appointment-api" },
  transports: [
    new winston.transports.Console({
      format: lineFormat
    }),
    fileTransport("combined.log"),
    fileTransport("error.log", "error")
  ]
});

export function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }
  return { message: String(error) };
}
