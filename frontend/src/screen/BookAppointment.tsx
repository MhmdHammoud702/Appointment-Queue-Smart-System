import { useEffect, useMemo, useState, type FormEvent } from "react";
import * as yup from "yup";
import { AP_Button } from "../components/AP_Button";
import { AP_Error } from "../components/AP_Error";
import { AP_PageHeader } from "../components/AP_PageHeader";
import { AP_Success } from "../components/AP_Success";
import { AP_TimeSlotPicker, type AP_TimeSlot } from "../components/AP_TimeSlotPicker";
import { appointmentsApi, getErrorMessage, servicesApi, staffApi } from "../shared/api";
import { getBeirutToday, type ApiAppointment, type ApiService, type ApiStaff, type BookingFormFields } from "../shared/types";
import { bookingSchema } from "../shared/validation";
import "./BookAppointment.css";

const initialFields: BookingFormFields = { service: "", staff: "", date: "", time: "" };
const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const steps = ["Service", "Staff", "Date and time", "Confirm"];

type BookAppointmentProps = {
  rescheduleAppointment?: ApiAppointment | null;
  onRescheduleComplete?: () => void;
};

function dateString(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function formatLongDate(value: string): string {
  if (!value) return "Choose a date";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Beirut",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatSlotTime(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Beirut",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

export function BookAppointment({ rescheduleAppointment = null, onRescheduleComplete }: BookAppointmentProps) {
  const today = getBeirutToday();
  const [fields, setFields] = useState<BookingFormFields>(() => rescheduleAppointment
    ? {
      ...initialFields,
      service: rescheduleAppointment.service._id,
      staff: rescheduleAppointment.staff?.id ?? rescheduleAppointment.staff?._id ?? "",
    }
    : initialFields);
  const [services, setServices] = useState<ApiService[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [staff, setStaff] = useState<ApiStaff[]>([]);
  const [slots, setSlots] = useState<AP_TimeSlot[]>([]);
  const [dateAvailability, setDateAvailability] = useState<Record<string, boolean>>({});
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const [year, month] = today.split("-").map(Number);
    return new Date(Date.UTC(year!, month! - 1, 1));
  });
  const [currentStep, setCurrentStep] = useState(rescheduleAppointment ? 3 : 1);
  const [errors, setErrors] = useState<Partial<Record<keyof BookingFormFields, string>>>({});
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [loadingCalendarAvailability, setLoadingCalendarAvailability] = useState(false);
  const [availabilityRevision, setAvailabilityRevision] = useState(0);
  const [calendarAvailabilityRevision, setCalendarAvailabilityRevision] = useState(0);
  const [saving, setSaving] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [calendarAvailabilityError, setCalendarAvailabilityError] = useState("");
  const [bookingReference, setBookingReference] = useState("");

  const selectedService = services.find((service) => service._id === fields.service);
  const selectedStaff = staff.find((member) => (member.id ?? member._id) === fields.staff);
  const selectedSlot = slots.find((slot) => slot.time === fields.time);
  const isRescheduling = Boolean(rescheduleAppointment);
  const calendarYear = calendarMonth.getUTCFullYear();
  const calendarMonthIndex = calendarMonth.getUTCMonth();
  const visibleMonth = `${calendarYear}-${String(calendarMonthIndex + 1).padStart(2, "0")}`;
  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(calendarMonth);
  const calendarDates = useMemo(() => {
    const firstOfMonth = new Date(Date.UTC(calendarYear, calendarMonthIndex, 1));
    const mondayOffset = (firstOfMonth.getUTCDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) =>
      new Date(Date.UTC(calendarYear, calendarMonthIndex, index - mondayOffset + 1)),
    );
  }, [calendarMonthIndex, calendarYear]);

  useEffect(() => {
    servicesApi.list()
      .then(setServices)
      .catch((error: unknown) => setRequestError(getErrorMessage(error)))
      .finally(() => setLoadingServices(false));
  }, []);

  useEffect(() => {
    setStaff([]);
    if (!fields.service) return;

    let active = true;
    setLoadingStaff(true);
    staffApi.list(fields.service)
      .then((results) => {
        if (active) setStaff(results);
      })
      .catch((error: unknown) => {
        if (active) setRequestError(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoadingStaff(false);
      });

    return () => { active = false; };
  }, [fields.service]);

  useEffect(() => {
    if (!fields.service || !fields.staff || !fields.date) {
      setSlots([]);
      setLoadingSlots(false);
      return;
    }

    let active = true;
    setLoadingSlots(true);
    setRequestError("");
    appointmentsApi.availability(fields.service, fields.staff, fields.date)
      .then((results) => {
        if (active) {
          setSlots(results);
          if (fields.time && !results.some((slot) => slot.time === fields.time && slot.available)) {
            updateField("time", "");
          }
        }
      })
      .catch((error: unknown) => {
        if (active) setRequestError(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoadingSlots(false);
      });

    return () => { active = false; };
  }, [availabilityRevision, fields.date, fields.service, fields.staff]);

  useEffect(() => {
    if (!fields.service || !fields.staff) {
      setDateAvailability({});
      setCalendarAvailabilityError("");
      setLoadingCalendarAvailability(false);
      return;
    }

    const controller = new AbortController();
    const daysInMonth = new Date(Date.UTC(calendarYear, calendarMonthIndex + 1, 0)).getUTCDate();
    const dates = Array.from({ length: daysInMonth }, (_, index) =>
      dateString(new Date(Date.UTC(calendarYear, calendarMonthIndex, index + 1))),
    ).filter((date) => date >= today);

    setDateAvailability({});
    setCalendarAvailabilityError("");
    setLoadingCalendarAvailability(true);

    Promise.all(dates.map(async (date) => {
      const availableSlots = await appointmentsApi.availability(
        fields.service,
        fields.staff,
        date,
        controller.signal,
      );
      return [date, availableSlots.some((slot) => slot.available)] as const;
    }))
      .then((results) => {
        if (!controller.signal.aborted) {
          setDateAvailability(Object.fromEntries(results));
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setCalendarAvailabilityError(getErrorMessage(error));
          setLoadingCalendarAvailability(false);
          controller.abort();
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingCalendarAvailability(false);
        }
      });

    return () => controller.abort();
  }, [calendarAvailabilityRevision, calendarMonthIndex, calendarYear, fields.service, fields.staff, today]);

  useEffect(() => {
    const handleAvailabilityUpdate = (event: Event) => {
      const detail =
        (event as CustomEvent<{ staffId: string; serviceId: string; date: string } | null>).detail;
      if (!detail) {
        setAvailabilityRevision((revision) => revision + 1);
        setCalendarAvailabilityRevision((revision) => revision + 1);
        return;
      }

      if (detail.staffId !== fields.staff || detail.serviceId !== fields.service) return;
      if (detail.date === fields.date) {
        setAvailabilityRevision((revision) => revision + 1);
      }
      if (detail.date.startsWith(visibleMonth)) {
        setCalendarAvailabilityRevision((revision) => revision + 1);
      }
    };

    window.addEventListener("availability-updated", handleAvailabilityUpdate);
    return () => window.removeEventListener("availability-updated", handleAvailabilityUpdate);
  }, [fields.date, fields.service, fields.staff, visibleMonth]);

  const filteredServices = useMemo(() => {
    const query = serviceSearch.trim().toLowerCase();
    if (!query) return services;
    return services.filter((service) =>
      `${service.name} ${service.description}`.toLowerCase().includes(query),
    );
  }, [serviceSearch, services]);
  const minimumMonth = today.slice(0, 7);
  function updateField(field: keyof BookingFormFields, value: string) {
    setFields((current) => ({
      ...current,
      [field]: value,
      ...(field === "date" ? { time: "" } : {}),
    }));
    setErrors((current) => ({
      ...current,
      [field]: undefined,
      ...(field === "date" ? { time: undefined } : {}),
    }));
    setBookingReference("");
    setRequestError("");
  }

  function selectService(service: string) {
    setFields({ ...initialFields, service });
    setErrors({});
    setBookingReference("");
    setRequestError("");
  }

  function canOpenStep(step: number): boolean {
    if (step <= 2) return true;
    if (step === 3) return Boolean(fields.service && fields.staff);
    return Boolean(fields.service && fields.staff && fields.date &&
      slots.some((slot) => slot.time === fields.time && slot.available) && !loadingSlots);
  }

  function stepDetail(step: number): string {
    if (step === 1) return selectedService?.name ?? "Choose a service";
    if (step === 2) return selectedStaff?.fullName ?? "Choose a practitioner";
    if (step === 3) return fields.date ? formatLongDate(fields.date) : "Choose a slot";
    return bookingReference || "Get your reference";
  }

  async function submitBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setRequestError("");

    try {
      const validated = await bookingSchema.validate(fields, { abortEarly: false });
      setSaving(true);
      if (rescheduleAppointment) {
        await appointmentsApi.reschedule(rescheduleAppointment._id, {
          date: validated.date,
          time: validated.time,
        });
        onRescheduleComplete?.();
      } else {
        const appointment = await appointmentsApi.create(validated);
        setBookingReference(appointment.reference);
        setFields(initialFields);
        setCurrentStep(1);
      }
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const nextErrors: Partial<Record<keyof BookingFormFields, string>> = {};
        error.inner.forEach((issue) => {
          if (issue.path && issue.path in initialFields) {
            nextErrors[issue.path as keyof BookingFormFields] = issue.message;
          }
        });
        setErrors(nextErrors);
      } else {
        setRequestError(getErrorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  }

  function continueToNextStep() {
    setCurrentStep((step) => Math.min(step + 1, 4));
  }

  return (
    <>
      <AP_PageHeader
        title={isRescheduling ? "Reschedule appointment" : "Book appointment"}
        description={isRescheduling
          ? `Choose a new time for ${rescheduleAppointment?.reference}.`
          : "Pick a time that works for you. You can reschedule later from My appointments."}
      />
      {requestError && <AP_Error message={requestError} />}
      {bookingReference && (
        <AP_Success
          message="Appointment booked. It is awaiting confirmation."
          onDismiss={() => setBookingReference("")}
          reference={bookingReference}
        />
      )}

      <nav className={`booking-steps${isRescheduling ? " reschedule-steps" : ""}`} aria-label="Booking progress">
        {(isRescheduling
          ? [
            { label: "Appointment", screen: 2, detail: `${selectedService?.name ?? "Service"} · ${selectedStaff?.fullName ?? "Practitioner"}`, fixed: true },
            { label: "New date and time", screen: 3, detail: stepDetail(3), fixed: false },
            { label: "Confirm", screen: 4, detail: stepDetail(4), fixed: false },
          ]
          : steps.map((label, index) => ({
            label,
            screen: index + 1,
            detail: stepDetail(index + 1),
            fixed: false,
          }))).map((step, index) => {
          const complete = step.fixed || step.screen < currentStep;
          return (
            <button
              aria-current={step.screen === currentStep && !step.fixed ? "step" : undefined}
              className={`booking-step ${step.screen === currentStep && !step.fixed ? "current" : ""} ${complete ? "complete" : ""}`}
              disabled={step.fixed || !canOpenStep(step.screen)}
              key={step.label}
              onClick={() => setCurrentStep(step.screen)}
              type="button"
            >
              <span className="booking-step-number">{complete ? "✓" : index + 1}</span>
              <span className="booking-step-copy">
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </span>
              {index < (isRescheduling ? 2 : steps.length - 1) && <span className="booking-step-line" aria-hidden="true" />}
            </button>
          );
        })}
      </nav>

      <div className="booking-layout">
        <section className="panel booking-main">
          {!isRescheduling && currentStep === 1 && (
            <div className="booking-choice-step">
              <div className="booking-panel-heading">
                <div>
                  <h2>Choose a service</h2>
                  <p>Select the appointment you would like to book.</p>
                </div>
                <span>Step 1 of 4</span>
              </div>
              <div className="service-picker">
                <label className="service-search-label" htmlFor="service-search">Search services</label>
                <input
                  id="service-search"
                  className="ap-input service-search"
                  type="search"
                  placeholder="Search by service name"
                  value={serviceSearch}
                  disabled={loadingServices || services.length === 0}
                  onChange={(event) => setServiceSearch(event.target.value)}
                />
                {loadingServices ? (
                  <p className="service-picker-message">Loading services…</p>
                ) : services.length === 0 ? (
                  <p className="field-help">No active services are available right now.</p>
                ) : filteredServices.length === 0 ? (
                  <p className="service-picker-message">No services match your search.</p>
                ) : (
                  <div className="service-card-grid" aria-label="Available services">
                    {filteredServices.map((service) => (
                      <button
                        key={service._id}
                        type="button"
                        className={`service-card${fields.service === service._id ? " selected" : ""}`}
                        aria-pressed={fields.service === service._id}
                        onClick={() => selectService(service._id)}
                      >
                        <span className="service-card-copy">
                          <strong>{service.name}</strong>
                          <small>{service.description}</small>
                        </span>
                        <span className="service-card-meta">
                          <strong>${service.price.toFixed(2)}</strong>
                          <small>{service.durationMinutes} min</small>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {errors.service && <small className="field-error">{errors.service}</small>}
              </div>
              <div className="booking-step-actions">
                <AP_Button disabled={!fields.service} onClick={continueToNextStep} type="button">
                  Continue to staff <span aria-hidden="true">→</span>
                </AP_Button>
              </div>
            </div>
          )}

          {!isRescheduling && currentStep === 2 && (
            <div className="booking-choice-step">
              <div className="booking-panel-heading">
                <div>
                  <h2>Choose a practitioner</h2>
                  <p>{selectedService?.name ?? "Your selected service"}</p>
                </div>
                <span>Step 2 of 4</span>
              </div>
              {loadingStaff ? (
                <p className="service-picker-message" role="status">Loading practitioners…</p>
              ) : staff.length === 0 ? (
                <p className="service-picker-message">No practitioners are currently assigned to this service.</p>
              ) : (
                <div className="staff-card-grid" aria-label="Available practitioners">
                  {staff.map((member) => {
                    const memberId = member.id ?? member._id ?? "";
                    return (
                      <button
                        key={memberId}
                        type="button"
                        className={`staff-card${fields.staff === memberId ? " selected" : ""}`}
                        aria-pressed={fields.staff === memberId}
                        onClick={() => {
                          setFields((current) => ({ ...current, staff: memberId, date: "", time: "" }));
                          setErrors((current) => ({ ...current, staff: undefined, date: undefined, time: undefined }));
                          setBookingReference("");
                          setRequestError("");
                        }}
                      >
                        <span className="staff-card-avatar" aria-hidden="true">
                          {member.fullName.split(/\s+/).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase()}
                        </span>
                        <span className="staff-card-name">{member.fullName}</span>
                        <span className="choice-indicator" aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
              )}
              {errors.staff && <small className="field-error">{errors.staff}</small>}
              <div className="booking-step-actions">
                <AP_Button onClick={() => setCurrentStep(1)} variant="secondary" type="button">Back</AP_Button>
                <AP_Button disabled={!fields.staff} onClick={continueToNextStep} type="button">
                  Choose a date <span aria-hidden="true">→</span>
                </AP_Button>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="booking-date-step">
              <div className="booking-panel-heading booking-calendar-heading">
                <div>
                  <h2>Choose a date and time</h2>
                  <p>{selectedStaff?.fullName ?? "Your practitioner"} · Availability from the clinic schedule</p>
                </div>
                <span className="booking-timezone">◎ Times in Asia/Beirut</span>
              </div>

              <div className="booking-date-time">
                <section className="booking-calendar" aria-label="Choose appointment date">
                  <div className="calendar-month-heading">
                    <h3>{monthLabel}</h3>
                    <div>
                      <button
                        aria-label="Previous month"
                        disabled={visibleMonth <= minimumMonth}
                        onClick={() => setCalendarMonth(new Date(Date.UTC(calendarYear, calendarMonthIndex - 1, 1)))}
                        type="button"
                      >‹</button>
                      <button
                        aria-label="Next month"
                        onClick={() => setCalendarMonth(new Date(Date.UTC(calendarYear, calendarMonthIndex + 1, 1)))}
                        type="button"
                      >›</button>
                    </div>
                  </div>
                  <div className="calendar-grid calendar-weekdays" aria-hidden="true">
                    {weekDays.map((day) => <span key={day}>{day}</span>)}
                  </div>
                  <div className="calendar-grid">
                    {calendarDates.map((date) => {
                      const value = dateString(date);
                      const isCurrentMonth = date.getUTCMonth() === calendarMonthIndex;
                      const isPast = value < today;
                      const isSelected = fields.date === value;
                      const hasNoAvailability = dateAvailability[value] === false;
                      return (
                        <button
                          aria-label={hasNoAvailability
                            ? `${formatLongDate(value)} - no available times`
                            : formatLongDate(value)}
                          aria-pressed={isSelected}
                          className={[
                            "calendar-day",
                            isCurrentMonth ? "" : "outside-month",
                            isPast ? "past-day" : "",
                            hasNoAvailability ? "unavailable-day" : "",
                            isSelected ? "selected-day" : "",
                            value === today ? "today-day" : "",
                          ].filter(Boolean).join(" ")}
                          disabled={isPast || !isCurrentMonth || loadingCalendarAvailability || hasNoAvailability}
                          key={value}
                          onClick={() => updateField("date", value)}
                          type="button"
                        >
                          {date.getUTCDate()}
                        </button>
                      );
                    })}
                  </div>
                  {loadingCalendarAvailability && (
                    <p className="calendar-note" role="status">Checking available dates…</p>
                  )}
                  {calendarAvailabilityError && (
                    <p className="booking-validation-error" role="alert">
                      Could not check every date. Select a date to check its times individually.
                    </p>
                  )}
                  {!loadingCalendarAvailability && !calendarAvailabilityError && (
                    <p className="calendar-note">Unavailable dates are disabled.</p>
                  )}
                </section>

                <AP_TimeSlotPicker
                  dateLabel={fields.date ? formatLongDate(fields.date) : ""}
                  slots={slots}
                  selectedTime={fields.time}
                  loading={loadingSlots}
                  onSelect={(time) => updateField("time", time)}
                />
              </div>
              {errors.date && <p className="booking-validation-error">{errors.date}</p>}
              {errors.time && <p className="booking-validation-error">{errors.time}</p>}
              <div className="booking-step-actions">
                {!isRescheduling && (
                  <AP_Button onClick={() => setCurrentStep(2)} variant="secondary" type="button">Back</AP_Button>
                )}
                <AP_Button
                  disabled={!fields.date || !selectedSlot?.available || loadingSlots}
                  onClick={continueToNextStep}
                  type="button"
                >
                  Continue <span aria-hidden="true">→</span>
                </AP_Button>
              </div>
            </div>
          )}

          {currentStep === 4 && (
            <form
              className="booking-confirm-step"
              id="booking-confirmation-form"
              onSubmit={(event) => void submitBooking(event)}
              noValidate
            >
              <div className="booking-panel-heading">
                <div>
                  <h2>Confirm your appointment</h2>
                  <p>Check your details before sending the booking request.</p>
                </div>
                <span>{isRescheduling ? "Step 3 of 3" : "Step 4 of 4"}</span>
              </div>
              <div className="booking-confirm-details">
                <div><span>Service</span><strong>{selectedService?.name}</strong></div>
                <div><span>Practitioner</span><strong>{selectedStaff?.fullName}</strong></div>
                <div><span>Date</span><strong>{formatLongDate(fields.date)}</strong></div>
                <div><span>Time</span><strong>{selectedSlot ? `${formatSlotTime(selectedSlot.start)} – ${formatSlotTime(selectedSlot.end)}` : fields.time}</strong></div>
              </div>
              <p className="booking-confirm-note">The available time is checked again when you confirm. If it has just been booked, choose another time.</p>
              <div className="booking-step-actions">
                <AP_Button onClick={() => setCurrentStep(3)} variant="secondary" type="button">Back</AP_Button>
                <AP_Button loading={saving} type="submit">
                  {isRescheduling ? "Confirm new time" : "Confirm booking"}
                </AP_Button>
              </div>
            </form>
          )}
        </section>

        <aside className="panel booking-summary">
          <h2>{isRescheduling ? "Appointment to reschedule" : "Your booking"}</h2>
          <div className="summary-line">
            <span>Service</span>
            <strong>{selectedService?.name ?? "Choose a service"}</strong>
            {selectedService && <small>{selectedService.durationMinutes} min · ${selectedService.price.toFixed(2)}</small>}
          </div>
          <div className="summary-line">
            <span>With</span>
            <strong>{selectedStaff?.fullName ?? "Choose a practitioner"}</strong>
            {selectedStaff && <small>Practitioner</small>}
          </div>
          <div className="summary-line">
            <span>Date</span>
            <strong>{formatLongDate(fields.date)}</strong>
          </div>
          <div className="summary-line">
            <span>Time</span>
            <strong>{selectedSlot ? `${formatSlotTime(selectedSlot.start)} – ${formatSlotTime(selectedSlot.end)}` : "Choose a time"}</strong>
            {selectedSlot && selectedService && <small>Ends after the {selectedService.durationMinutes}-minute service</small>}
          </div>
          <p className="booking-recheck-note">Your booking is saved after the clinic confirms it.</p>
        </aside>
      </div>
    </>
  );
}
