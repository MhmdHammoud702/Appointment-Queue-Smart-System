import { useId } from "react";
import "./AP_Textbox.css";

type AP_TextboxProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel" | "password" | "number";
  placeholder?: string;
  error?: string;
  help?: string;
  disabled?: boolean;
  className?: string;
};

export function AP_Textbox({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  error,
  help,
  disabled = false,
  className = "",
}: AP_TextboxProps) {
  const id = useId();

  return (
    <div className={`ap-field ${className}`}>
      <label className="form-field" htmlFor={id}>
        {label}
        <input
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error || help ? `${id}-message` : undefined}
          className="ap-input"
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          type={type}
          value={value}
        />
      </label>
      {error && <small className="field-error" id={`${id}-message`}>{error}</small>}
      {!error && help && <small className="field-help" id={`${id}-message`}>{help}</small>}
    </div>
  );
}
