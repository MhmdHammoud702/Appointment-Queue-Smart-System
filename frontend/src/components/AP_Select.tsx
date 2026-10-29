import { useId } from "react";
import "./AP_Select.css";

export type AP_SelectOption = {
  label: string;
  value: string;
};

type AP_SelectProps = {
  label: string;
  value: string;
  options: AP_SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  help?: string;
  disabled?: boolean;
};

export function AP_Select({
  label,
  value,
  options,
  onChange,
  placeholder = "Choose an option",
  error,
  help,
  disabled = false,
}: AP_SelectProps) {
  const id = useId();

  return (
    <div className="ap-field">
      <label className="form-field" htmlFor={id}>
        {label}
        <select
          id={id}
          aria-invalid={Boolean(error)}
          aria-describedby={error || help ? `${id}-message` : undefined}
          className="ap-input"
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      {error && <small className="field-error" id={`${id}-message`}>{error}</small>}
      {!error && help && <small className="field-help" id={`${id}-message`}>{help}</small>}
    </div>
  );
}
