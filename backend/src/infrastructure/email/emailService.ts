import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import type { AppointmentRecord } from "../database/models/Appointment.js";
import type { ServiceRecord } from "../database/models/Service.js";
import type { UserRecord } from "../database/models/User.js";

type AppointmentEmail = Omit<AppointmentRecord, "customer" | "service" | "staff"> & {
  customer: Pick<UserRecord, "fullName" | "email">;
  service: Pick<ServiceRecord, "name"> | null;
  staff: Pick<UserRecord, "fullName"> | null;
};

const smtpConfigured = Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD);
const transporter = smtpConfigured
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE === "true",
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD }
    })
  : null;

export async function sendAppointmentEmail(
  appointment: AppointmentEmail,
  event: "confirmed" | "cancelled" | "rescheduled"
): Promise<void> {
  if (!transporter) return;

  const customer = appointment.customer;
  const serviceName = appointment.service?.name ?? "your service";
  const staffName = appointment.staff?.fullName ?? "your provider";
  const date = appointment.start.toLocaleString("en-GB", {
    timeZone: env.BUSINESS_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short"
  });

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: customer.email,
    subject: `Appointment ${event}: ${appointment.reference}`,
    text: `Hello ${customer.fullName},\n\nYour appointment was ${event}.\nReference: ${appointment.reference}\nService: ${serviceName}\nWith: ${staffName}\nWhen: ${date}\n`
  });
}
