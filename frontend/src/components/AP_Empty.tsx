import type { ReactNode } from "react";
import { AP_Button } from "./AP_Button";
import "./AP_Empty.css";

type AP_EmptyProps = {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
};

export function AP_Empty({
  title,
  message,
  actionLabel,
  onAction,
  icon = "▦",
}: AP_EmptyProps) {
  return (
    <div className="ap-empty">
      <span className="empty-icon">{icon}</span>
      <strong>{title}</strong>
      <p>{message}</p>
      {actionLabel && onAction && (
        <AP_Button onClick={onAction} size="small">{actionLabel}</AP_Button>
      )}
    </div>
  );
}
