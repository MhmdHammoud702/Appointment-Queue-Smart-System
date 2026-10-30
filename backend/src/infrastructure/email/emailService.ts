import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import type { AppointmentRecord } from "../database/models/Appointment.js";
import type { StaffScheduleRecord } from "../database/models/StaffSchedule.js";
import type { ServiceRecord } from "../database/models/Service.js";
import type { UserRecord } from "../database/models/User.js";

export type AppointmentEmail = Omit<AppointmentRecord, "customer" | "service" | "staff"> & {
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

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]!);
}

function getAppointmentDate(appointment: AppointmentEmail): string {
  return appointment.start.toLocaleString("en-GB", {
    timeZone: env.BUSINESS_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short"
  });
}

export async function sendAppointmentEmail(
  appointment: AppointmentEmail,
  event: "confirmed" | "cancelled" | "rescheduled"
): Promise<void> {
  if (!transporter) return;

  const customer = appointment.customer;
  const serviceName = appointment.service?.name ?? "your service";
  const staffName = appointment.staff?.fullName ?? appointment.staffNameSnapshot ?? "your provider";
  const date = getAppointmentDate(appointment);

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: customer.email,
    subject: `Appointment ${event}: ${appointment.reference}`,
    text: `Hello ${customer.fullName},\n\nYour appointment was ${event}.\nReference: ${appointment.reference}\nService: ${serviceName}\nWith: ${staffName}\nWhen: ${date}\n`
  });
}

export async function sendStaffUnavailableEmail(appointment: AppointmentEmail): Promise<boolean> {
  return sendStaffCancellationEmail(appointment);
}

export async function sendStaffScheduleChangedEmail(
  appointment: AppointmentEmail,
  schedule: Pick<StaffScheduleRecord, "weeklyIntervals" | "daysOff">
): Promise<boolean> {
  return sendStaffCancellationEmail(appointment, schedule);
}

function getScheduleRows(schedule: Pick<StaffScheduleRecord, "weeklyIntervals" | "daysOff">) {
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return weekdays.map((day, index) => {
    const intervals = schedule.weeklyIntervals
      .filter((interval) => interval.day === index)
      .map((interval) => `${interval.from}–${interval.to}`);
    return {
      day,
      hours: schedule.daysOff.includes(index) || intervals.length === 0 ? "Closed" : intervals.join(", ")
    };
  });
}

async function sendStaffCancellationEmail(
  appointment: AppointmentEmail,
  schedule?: Pick<StaffScheduleRecord, "weeklyIntervals" | "daysOff">
): Promise<boolean> {
  if (!transporter) return false;

  const customerName = escapeHtml(appointment.customer.fullName);
  const reference = escapeHtml(appointment.reference);
  const serviceName = escapeHtml(appointment.service?.name ?? "Appointment");
  const staffName = escapeHtml(appointment.staff?.fullName ?? appointment.staffNameSnapshot ?? "your provider");
  const date = escapeHtml(getAppointmentDate(appointment));
  const bookingUrl = new URL("/book", env.CLIENT_ORIGIN).toString();
  const cancellationMessage = schedule
    ? `We’re sorry, but your appointment has been cancelled because <strong>${staffName}</strong> changed their working schedule.`
    : `We’re sorry, but your appointment has been cancelled because <strong>${staffName}</strong> is no longer available.`;
  const scheduleRows = schedule ? getScheduleRows(schedule) : [];
  const scheduleText = scheduleRows.map(({ day, hours }) => `${day}: ${hours}`).join("\n");
  const scheduleHtml = schedule
    ? `<div style="margin:0 0 24px;padding:17px 18px;border:1px solid #e7ebf0;border-radius:10px;background:#f8fafc;">
          <div style="margin-bottom:10px;color:#8692a1;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">New weekly schedule · clinic time</div>
          ${scheduleRows.map(({ day, hours }) => `<div style="margin:6px 0;font-size:14px;"><strong>${escapeHtml(day)}:</strong> ${escapeHtml(hours)}</div>`).join("")}
        </div>`
    : "";

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: appointment.customer.email,
    subject: schedule
      ? `Appointment cancelled due to schedule change: ${appointment.reference}`
      : `Appointment cancelled: ${appointment.reference}`,
    text:
      `Hello ${appointment.customer.fullName},\n\n` +
      (schedule
        ? `We’re sorry, but your appointment was cancelled because ${appointment.staff?.fullName ?? appointment.staffNameSnapshot ?? "your provider"} changed their working schedule.\n\n` +
          `New weekly schedule (clinic time):\n${scheduleText}\n\n`
        : `We’re sorry, but your appointment was cancelled because ${appointment.staff?.fullName ?? appointment.staffNameSnapshot ?? "your provider"} is no longer available.\n\n`) +
      `Reference: ${appointment.reference}\nService: ${appointment.service?.name ?? "Appointment"}\n` +
      `When: ${getAppointmentDate(appointment)}\n\nPlease book a new appointment: ${bookingUrl}\n\nTeamFlow`,
    html: `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Appointment update</title></head>
  <body style="margin:0;padding:32px 12px;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#27364a;">
    <div style="max-width:560px;margin:0 auto;overflow:hidden;border:1px solid #e5e9ef;border-radius:16px;background:#ffffff;">
      <div style="padding:28px 32px;background:#172b45;color:#ffffff;">
        <div style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#b9d8d5;">TeamFlow</div>
        <h1 style="margin:12px 0 0;font-size:23px;line-height:1.3;">An update to your appointment</h1>
      </div>
      <div style="padding:30px 32px;">
        <p style="margin:0 0 16px;font-size:16px;">Hello ${customerName},</p>
        <p style="margin:0 0 22px;color:#58677a;font-size:15px;line-height:1.7;">
          ${cancellationMessage}
          Please accept our apologies for the change.
        </p>
        <div style="margin:0 0 24px;padding:17px 18px;border:1px solid #e7ebf0;border-radius:10px;background:#f8fafc;">
          <div style="margin-bottom:10px;color:#8692a1;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Appointment details</div>
          <div style="margin:6px 0;font-size:14px;"><strong>Service:</strong> ${serviceName}</div>
          <div style="margin:6px 0;font-size:14px;"><strong>Provider:</strong> ${staffName}</div>
          <div style="margin:6px 0;font-size:14px;"><strong>Date and time:</strong> ${date}</div>
          <div style="margin:6px 0;font-size:14px;"><strong>Reference:</strong> ${reference}</div>
        </div>
        ${scheduleHtml}
        <p style="margin:0 0 18px;color:#58677a;font-size:14px;line-height:1.6;">
          You can choose a new time that works for you using the button below.
        </p>
        <div style="text-align:center;">
          <a href="${escapeHtml(bookingUrl)}" style="display:inline-block;padding:14px 26px;border-radius:8px;background:#c83e3e;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">Reschedule appointment</a>
        </div>
        <p style="margin:24px 0 0;color:#7a8797;font-size:12px;line-height:1.6;">
          If you have questions, please contact the clinic. We look forward to seeing you soon.
        </p>
      </div>
      <div style="padding:17px 32px;border-top:1px solid #edf0f3;color:#98a3b0;font-size:11px;text-align:center;">
        TeamFlow · Smart Appointment &amp; Queue Management
      </div>
    </div>
  </body>
</html>`
  });
  return true;
}
