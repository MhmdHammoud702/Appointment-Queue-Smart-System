import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./AP_Button.css";

type AP_ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "text";
  size?: "small" | "medium";
  loading?: boolean;
  children: ReactNode;
};

export function AP_Button({
  variant = "primary",
  size = "medium",
  loading = false,
  disabled = false,
  className = "",
  children,
  ...buttonProps
}: AP_ButtonProps) {
  const variantClass = {
    primary: "button-primary",
    secondary: "button-outline",
    danger: "button-danger",
    text: "button-text",
  }[variant];
  const sizeClass = size === "small" ? "button-small" : "";
  const classes = ["button", variantClass, sizeClass, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      {...buttonProps}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading}
    >
      {loading ? "Saving..." : children}
    </button>
  );
}
