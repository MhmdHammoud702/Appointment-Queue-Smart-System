import axios from "axios";
import type {
  ApiAppointment,
  ApiQueueEntry,
  ApiSchedule,
  ApiService,
  ApiStaff,
  ApiUser,
  AppointmentFilters,
  DashboardStats,
  LoginFields,
  RegisterFields,
  ScheduleFields,
  ServiceFields,
} from "./types";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  headers: { "Content-Type": "application/json" },
});

type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

async function request<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  const response = await promise;
  return response.data.data;
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError<{ error?: { message?: string } }>(error)) {
    return error.response?.data?.error?.message ?? error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export const authApi = {
  login: (fields: LoginFields) =>
    request<{ user: ApiUser; token: string }>(api.post("/auth/login", fields)),
  register: (fields: RegisterFields) =>
    request<{ user: ApiUser; token: string }>(api.post("/auth/register", fields)),
  me: () => request<ApiUser>(api.get("/auth/me")),
  logout: () => request<{ message: string }>(api.post("/auth/logout")),
};

export const servicesApi = {
  list: (includeInactive = false) =>
    request<ApiService[]>(api.get("/services", { params: includeInactive ? { includeInactive: true } : {} })),
  create: (fields: ServiceFields) => request<ApiService>(api.post("/services", fields)),
  update: (id: string, fields: ServiceFields) => request<ApiService>(api.put(`/services/${id}`, fields)),
  setActive: (id: string, active: boolean) =>
    request<ApiService>(api.patch(`/services/${id}/status`, { active })),
};

export const staffApi = {
  list: (serviceId?: string) =>
    request<ApiStaff[]>(api.get("/users/staff", { params: serviceId ? { serviceId } : {} })),
  create: (fields: RegisterFields) => request<ApiUser>(api.post("/users/staff", fields)),
  createReceptionist: (fields: RegisterFields) =>
    request<ApiUser>(api.post("/users/receptionists", fields)),
  getSchedule: (id: string) => request<ApiSchedule>(api.get(`/staff/${id}/schedule`)),
  saveSchedule: (id: string, fields: ScheduleFields) =>
    request<ApiSchedule>(api.put(`/staff/${id}/schedule`, fields)),
};

export const appointmentsApi = {
  list: (filters: AppointmentFilters = {}) =>
    request<ApiAppointment[]>(api.get("/appointments", { params: filters })),
  availability: (serviceId: string, staffId: string, date: string, signal?: AbortSignal) =>
    request<{ time: string; start: string; end: string; available: boolean }[]>(
      api.get("/appointments/availability", { params: { serviceId, staffId, date }, signal }),
    ),
  create: (fields: { service: string; staff: string; date: string; time: string }) =>
    request<ApiAppointment>(api.post("/appointments", fields)),
  confirm: (id: string) => request<ApiAppointment>(api.patch(`/appointments/${id}/confirm`)),
  cancel: (id: string) => request<ApiAppointment>(api.patch(`/appointments/${id}/cancel`)),
  reschedule: (id: string, fields: { date: string; time: string }) =>
    request<ApiAppointment>(api.patch(`/appointments/${id}/reschedule`, fields)),
};

export const queueApi = {
  list: () => request<ApiQueueEntry[]>(api.get("/queue/today")),
  checkIn: (reference: string) => request<ApiQueueEntry>(api.post("/queue/check-in", { reference })),
  call: (id: string) => request<ApiQueueEntry>(api.patch(`/queue/${id}/call`)),
  complete: (id: string) => request<ApiQueueEntry>(api.patch(`/queue/${id}/complete`)),
};

export const dashboardApi = {
  stats: (from?: string, to?: string) =>
    request<DashboardStats>(api.get("/dashboard/stats", { params: { from, to } })),
};
