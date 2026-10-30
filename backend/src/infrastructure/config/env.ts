import "dotenv/config";

const jwtSecret = process.env.JWT_SECRET;
const configuredClientOrigins = (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const clientOrigins = configuredClientOrigins.length > 0
  ? [...new Set(configuredClientOrigins)]
  : ["http://localhost:5173"];

if (!jwtSecret || jwtSecret.length < 24) {
  throw new Error("JWT_SECRET must be set and at least 24 characters long.");
}

export const env = {
  NODE_ENV: process.env.NODE_ENV ?? "development",
  PORT: Number(process.env.PORT ?? 3000),
  MONGODB_URI:
    process.env.MONGODB_URI ??
    "mongodb://127.0.0.1:27017/smart_appointments?replicaSet=rs0",
  JWT_SECRET: jwtSecret,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? "1d",
  BUSINESS_TIME_ZONE: process.env.BUSINESS_TIME_ZONE ?? "Asia/Beirut",
  CHECK_IN_GRACE_MINUTES: Number(process.env.CHECK_IN_GRACE_MINUTES ?? 15),
  NO_SHOW_CRON: process.env.NO_SHOW_CRON ?? "0 * * * *",
  CLIENT_ORIGINS: clientOrigins,
  CLIENT_ORIGIN: clientOrigins[0]!,
  SMTP_HOST: process.env.SMTP_HOST ?? "",
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 587),
  SMTP_SECURE: process.env.SMTP_SECURE ?? "false",
  SMTP_USER: process.env.SMTP_USER ?? "",
  SMTP_PASSWORD: process.env.SMTP_PASSWORD ?? "",
  EMAIL_FROM: process.env.EMAIL_FROM ?? "appointments@example.com"
};
