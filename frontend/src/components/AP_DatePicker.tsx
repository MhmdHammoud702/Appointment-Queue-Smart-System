import { useId, useState } from "react";
import "./AP_DatePicker.css";

type AP_DatePickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  disabledDays?: number[];
  error?: string;
  help?: string;
  disabled?: boolean;
};

export function AP_DatePicker({
  label,
  value,
  onChange,
  min,
  disabledDays = [],
  error,
  help,
  disabled = false,
}: AP_DatePickerProps) {
  const id = useId();
  const [unavailableDay, setUnavailableDay] = useState(false);
  const selectedDay = value ? new Date(`${value}T00:00:00`).getDay() : -1;
  const selectedDayIsDisabled = disabledDays.includes(selectedDay);
  const message = unavailableDay || selectedDayIsDisabled
    ? "This day is unavailable. Choose another date."
    : error || help;

  return (
    <div className="ap-field">
      <label className="form-field" htmlFor={id}>
        {label}
        <input
          id={id}
          aria-invalid={Boolean(error || selectedDayIsDisabled || unavailableDay)}
          aria-describedby={message ? `${id}-message` : undefined}
          className="ap-input"
          disabled={disabled}
          min={min}
          onChange={(event) => {
            const nextDate = event.target.value;
            const nextDay = nextDate ? new Date(`${nextDate}T00:00:00`).getDay() : -1;
            const isUnavailable = disabledDays.includes(nextDay);
            setUnavailableDay(isUnavailable);
            onChange(isUnavailable ? "" : nextDate);
          }}
          type="date"
          value={value}
        />
      </label>
      {message && (
        <small className={error || selectedDayIsDisabled || unavailableDay ? "field-error" : "field-help"} id={`${id}-message`}>
          {message}
        </small>
      )}
    </div>
  );
}
