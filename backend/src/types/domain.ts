export type UserRole = "Customer" | "Staff" | "Receptionist" | "Admin";

export type AppointmentStatus =
  | "Pending"
  | "Confirmed"
  | "Checked In"
  | "In Service"
  | "Completed"
  | "Cancelled"
  | "No-show";

export type QueueStatus = "Waiting" | "Called" | "In Service" | "Completed" | "Cancelled";

export interface AuthUser {
  id: string;
  role: UserRole;
  fullName: string;
}

export interface WorkingInterval {
  day: number;
  from: string;
  to: string;
}

export interface AppointmentFilters {
  status?: AppointmentStatus;
  from?: string;
  to?: string;
}

export interface DashboardFilters {
  from?: string;
  to?: string;
}

export interface RegisterUserInput {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface ServiceInput {
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  active?: boolean;
}

export interface ScheduleInput {
  weeklyIntervals: WorkingInterval[];
  daysOff: number[];
  services: string[];
}

export interface AppointmentBookingInput {
  service: string;
  staff: string;
  start?: string;
  date?: string;
  time?: string;
}

export interface AvailabilityInput {
  serviceId: string;
  staffId: string;
  date: string;
}
