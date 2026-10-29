import "./AP_TimeSlotPicker.css";

export type AP_TimeSlot = {
  time: string;
  start: string;
  end: string;
  available: boolean;
};

type AP_TimeSlotPickerProps = {
  dateLabel: string;
  slots: AP_TimeSlot[];
  selectedTime: string;
  loading?: boolean;
  onSelect: (time: string) => void;
};

function formatSlotTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Beirut",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

export function AP_TimeSlotPicker({
  dateLabel,
  slots,
  selectedTime,
  loading = false,
  onSelect,
}: AP_TimeSlotPickerProps) {
  const groups = [
    { name: "Morning", times: slots.filter((slot) => Number(slot.time.slice(0, 2)) < 12) },
    { name: "Afternoon", times: slots.filter((slot) => Number(slot.time.slice(0, 2)) >= 12) },
  ];

  return (
    <section className="time-slot-picker" aria-label="Available appointment times">
      <div className="time-slot-heading">
        <h3>{dateLabel || "Choose a date"}</h3>
        {dateLabel && <span>Available times</span>}
      </div>
      {!dateLabel && <p className="time-slot-hint">Select a date on the calendar to see available times.</p>}
      {loading && <p className="time-slot-hint" role="status">Checking the clinic schedule…</p>}
      {!loading && dateLabel && slots.length === 0 && (
        <p className="time-slot-hint">No available times on this date. Try another date.</p>
      )}
      {!loading && groups.map((group) => group.times.length > 0 && (
        <div className="time-slot-group" key={group.name}>
          <h4>{group.name}</h4>
          <div className="time-slot-options">
            {group.times.map((slot) => (
              <button
                key={slot.start}
                type="button"
                disabled={!slot.available}
                aria-pressed={selectedTime === slot.time}
                className={`time-slot-option${slot.available ? "" : " unavailable"}${selectedTime === slot.time ? " selected" : ""}`}
                onClick={() => onSelect(slot.time)}
              >
                {formatSlotTime(slot.start)} – {formatSlotTime(slot.end)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
