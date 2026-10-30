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

function buildAppointmentEmailHtml(
  appointment: AppointmentEmail,
  options: {
    title: string;
    message: string;
    actionLabel: string;
    actionUrl: string;
    accentColor: string;
    extraHtml?: string;
  }
): string {
  const serviceName = appointment.service?.name ?? "Appointment";
  const staffName = appointment.staff?.fullName ?? appointment.staffNameSnapshot ?? "your provider";
  const details = [
    ["Service", serviceName],
    ["Provider", staffName],
    ["Date and time", getAppointmentDate(appointment)],
    ["Reference", appointment.reference]
  ];

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(options.title)}</title>
    <style>
      @media only screen and (max-width: 480px) {
        .email-container { border-radius: 10px !important; }
        .email-header, .email-content, .email-footer { padding-left: 20px !important; padding-right: 20px !important; }
        .email-button { display: block !important; box-sizing: border-box !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:32px 12px;background:#f3f5f8;font-family:Arial,Helvetica,sans-serif;color:#27364a;">
    <div class="email-container" style="width:100%;max-width:560px;margin:0 auto;overflow:hidden;border:1px solid #e5e9ef;border-radius:16px;background:#ffffff;">
      <div class="email-header" style="padding:28px 32px;background:#172b45;color:#ffffff;">
        <div style="font-size:13px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#b9d8d5;">TeamFlow</div>
        <h1 style="margin:12px 0 0;font-size:23px;line-height:1.3;">${escapeHtml(options.title)}</h1>
      </div>
      <div class="email-content" style="padding:30px 32px;">
        <p style="margin:0 0 16px;font-size:16px;">Hello ${escapeHtml(appointment.customer.fullName)},</p>
        <p style="margin:0 0 22px;color:#58677a;font-size:15px;line-height:1.7;">${escapeHtml(options.message)}</p>
        <div style="margin:0 0 24px;padding:17px 18px;border:1px solid #e7ebf0;border-radius:10px;background:#f8fafc;">
          <div style="margin-bottom:10px;color:#8692a1;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Appointment details</div>
          ${details.map(([label, value]) => `<div style="margin:6px 0;font-size:14px;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</div>`).join("")}
        </div>
        ${options.extraHtml ?? ""}
        <div style="text-align:center;">
          <a class="email-button" href="${escapeHtml(options.actionUrl)}" style="display:inline-block;padding:14px 26px;border-radius:8px;background:${options.accentColor};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;">${escapeHtml(options.actionLabel)}</a>
        </div>
        <p style="margin:24px 0 0;color:#7a8797;font-size:12px;line-height:1.6;">If you have questions, please contact the clinic.</p>
      </div>
      <div class="email-footer" style="padding:17px 32px;border-top:1px solid #edf0f3;color:#98a3b0;font-size:11px;text-align:center;">
        TeamFlow · Smart Appointment &amp; Queue Management
      </div>
    </div>
  </body>
</html>`;
}

export async function sendAppointmentEmail(
  appointment: AppointmentEmail,
  event: "confirmed" | "cancelled" | "rescheduled"
): Promise<void> {
  if (!transporter) return;

  const designs = {
    confirmed: {
      title: "Your appointment is confirmed",
      message: "Your appointment is confirmed. We look forward to seeing you.",
      actionLabel: "View my appointments",
      actionPath: "/my-appointments",
      accentColor: "#078b89"
    },
    cancelled: {
      title: "Your appointment was cancelled",
      message: "Your appointment has been cancelled. You can book another time that works for you.",
      actionLabel: "Book another appointment",
      actionPath: "/book",
      accentColor: "#c83e3e"
    },
    rescheduled: {
      title: "Your appointment was rescheduled",
      message: "Your appointment time has changed. Check the updated details below.",
      actionLabel: "View my appointments",
      actionPath: "/my-appointments",
      accentColor: "#078b89"
    }
  } as const;
  const design = designs[event];
  const actionUrl = new URL(design.actionPath, env.CLIENT_ORIGIN).toString();
  const serviceName = appointment.service?.name ?? "Appointment";
  const staffName = appointment.staff?.fullName ?? appointment.staffNameSnapshot ?? "your provider";
  const date = getAppointmentDate(appointment);

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to: appointment.customer.email,
    subject: `${design.title}: ${appointment.reference}`,
    text: `Hello ${appointment.customer.fullName},\n\n${design.message}\n\nService: ${serviceName}\nWith: ${staffName}\nWhen: ${date}\nReference: ${appointment.reference}\n\n${design.actionLabel}: ${actionUrl}\n\nTeamFlow`,
    html: buildAppointmentEmailHtml(appointment, {
      ...design,
      actionUrl
    })
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

  const staffName = appointment.staff?.fullName ?? appointment.staffNameSnapshot ?? "your provider";
  const bookingUrl = new URL("/book", env.CLIENT_ORIGIN).toString();
  const cancellationMessage = schedule
    ? `We’re sorry, but your appointment was cancelled because ${staffName} changed their working schedule.`
    : `We’re sorry, but your appointment was cancelled because ${staffName} is no longer available.`;
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
    html: buildAppointmentEmailHtml(appointment, {
      title: schedule ? "Your appointment was cancelled" : "Appointment update",
      message: `${cancellationMessage} Please accept our apologies for the change.`,
      actionLabel: "Book another appointment",
      actionUrl: bookingUrl,
      accentColor: "#c83e3e",
      extraHtml: scheduleHtml
    })
  });
  return true;
}
