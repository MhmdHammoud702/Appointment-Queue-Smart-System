export type ScreenName =
  | "Dashboard"
  | "Appointments"
  | "Queue"
  | "Services"
  | "Staff"
  | "Book appointment"
  | "My appointments";

export type UserRole = "Customer" | "Staff" | "Receptionist" | "Admin";
export type EmployeeRole = "Staff" | "Receptionist";

export type ApiUser = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: UserRole;
};

export type LoginFields = {
  email: string;
  password: string;
};

export type RegisterFields = {
  fullName: string;
  email: string;
  phone: string;
  password: string;
};

export type AppointmentStatus =
  | "Pending"
  | "Confirmed"
  | "Checked In"
  | "In Service"
  | "Completed"
  | "Cancelled"
  | "No-show";

export type ApiPerson = {
  _id?: string;
  id?: string;
  fullName: string;
  email?: string;
};

export type ApiService = {
  _id: string;
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
  active: boolean;
};

export type ApiStaff = ApiPerson & {
  phone?: string;
};

export type ApiEmployee = ApiStaff & {
  role: EmployeeRole;
  isActive: boolean;
};

export type ApiEmployeeStatusUpdate = {
  employee: ApiEmployee;
  cancelledAppointments: number;
  failedNotifications: number;
};

export type ApiAppointment = {
  _id: string;
  reference: string;
  customer: ApiPerson;
  service: ApiService;
  staff: ApiStaff | null;
  staffNameSnapshot?: string;
  start: string;
  end: string;
  status: AppointmentStatus;
  cancellationReason?: string;
};

export type AppointmentView = {
  id: string;
  start: string;
  reference: string;
  time: string;
  date: string;
  customer: string;
  initials: string;
  service: string;
  staff: string;
  status: AppointmentStatus;
};

export type AppointmentFilters = {
  status?: AppointmentStatus;
  from?: string;
  to?: string;
};

export type ApiQueueEntry = {
  _id: string;
  queueNumber: number;
  queueDate: string;
  status: "Waiting" | "Called" | "In Service" | "Completed" | "Cancelled";
  checkedInAt: string;
  calledAt?: string;
  appointment: ApiAppointment;
};

export type QueueView = {
  id: string;
  number: string;
  reference: string;
  checkedInAt: string;
  customer: string;
  service: string;
  staff: string;
  wait: string;
  serviceTime: string;
  status: ApiQueueEntry["status"];
};

export type ScheduleInterval = {
  day: number;
  from: string;
  to: string;
};

export type ApiSchedule = {
  staff: string | ApiStaff;
  weeklyIntervals: ScheduleInterval[];
  daysOff: number[];
  services: (string | ApiService)[];
};

export type ApiScheduleSaveResult = ApiSchedule & {
  cancelledAppointments: number;
  failedNotifications: number;
};

export type ScheduleFields = {
  weeklyIntervals: ScheduleInterval[];
  daysOff: number[];
  services: string[];
};

export type ServiceFields = {
  name: string;
  description: string;
  durationMinutes: number;
  price: number;
};

export type DashboardStats = {
  from: string;
  to: string;
  appointments: number;
  completed: number;
  cancelled: number;
  waiting: number;
  estimatedRevenue: number;
  sevenDayVolume: { date: string; count: number }[];
};

export type BookingFormFields = {
  service: string;
  staff: string;
  date: string;
  time: string;
};

export function getRecordId(record: { _id?: string; id?: string }): string {
  return record.id ?? record._id ?? "";
}

export function toAppointmentView(appointment: ApiAppointment): AppointmentView {
  const date = new Date(appointment.start);
  const customer = appointment.customer.fullName;
  const initials = customer
    .split(/\s+/)
    .map((part) => part[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return {
    id: appointment._id,
    start: appointment.start,
    reference: appointment.reference,
    date: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut" }).format(date),
    time: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Beirut",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date),
    customer,
    initials,
    service: appointment.service.name,
    staff: appointment.staff?.fullName ?? appointment.staffNameSnapshot ?? "Former staff member",
    status: appointment.status,
  };
}

export function toQueueView(entry: ApiQueueEntry): QueueView {
  const checkedInAt = new Date(entry.checkedInAt);
  const waitMinutes = Math.max(0, Math.floor((Date.now() - checkedInAt.getTime()) / 60_000));

  return {
    id: entry._id,
    number: `A-${String(entry.queueNumber).padStart(3, "0")}`,
    reference: entry.appointment.reference,
    checkedInAt: new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Beirut",
      hour: "2-digit",
      minute: "2-digit",
    }).format(checkedInAt),
    customer: entry.appointment.customer.fullName,
    service: entry.appointment.service.name,
    staff: entry.appointment.staff?.fullName ?? entry.appointment.staffNameSnapshot ?? "Former staff member",
    wait: `${waitMinutes} min`,
    serviceTime: entry.calledAt
      ? `${Math.max(0, Math.floor((Date.now() - new Date(entry.calledAt).getTime()) / 60_000))} min`
      : "",
    status: entry.status,
  };
}

export function getBeirutToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut" }).format(new Date());
}
