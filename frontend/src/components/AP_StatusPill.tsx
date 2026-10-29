import "./AP_StatusPill.css";

export type AP_Status =
  | "Pending"
  | "Confirmed"
  | "Checked In"
  | "Checked in"
  | "In Service"
  | "In service"
  | "Called"
  | "Completed"
  | "Cancelled"
  | "No-show"
  | "Waiting"
  | "Active"
  | "Inactive";

type AP_StatusPillProps = {
  status: AP_Status;
};

export function AP_StatusPill({ status }: AP_StatusPillProps) {
  const className = status.toLowerCase().replaceAll(" ", "-");

  return <span className={`status-badge status-${className}`}>{status}</span>;
}
