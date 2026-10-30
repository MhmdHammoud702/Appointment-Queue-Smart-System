import type { ScreenName, UserRole } from "./types";

export const screenPaths: Record<ScreenName, string> = {
  Dashboard: "/dashboard",
  Appointments: "/appointments",
  Queue: "/queue",
  Services: "/services",
  Staff: "/staff",
  "Book appointment": "/book",
  "My appointments": "/my-appointments",
};

export function getHomeScreen(role: UserRole): ScreenName {
  if (role === "Admin") return "Dashboard";
  if (role === "Customer") return "Book appointment";
  return "Appointments";
}

export function canAccessScreen(role: UserRole, screen: ScreenName): boolean {
  if (role === "Admin") {
    return screen !== "Book appointment" && screen !== "My appointments";
  }
  if (role === "Customer") return screen === "Book appointment" || screen === "My appointments";
  if (role === "Staff" || role === "Receptionist") {
    return screen === "Appointments" || screen === "Queue";
  }
  return false;
}

export function getActiveScreen(pathname: string, role: UserRole): ScreenName {
  if (/^\/appointments\/[^/]+\/reschedule$/.test(pathname)) {
    return role === "Customer" ? "My appointments" : "Appointments";
  }

  const screen = (Object.keys(screenPaths) as ScreenName[])
    .find((name) => screenPaths[name] === pathname);
  return screen ?? getHomeScreen(role);
}
