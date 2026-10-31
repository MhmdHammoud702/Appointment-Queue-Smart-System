import { useCallback, useEffect, useState } from "react";
import { AP_Button } from "../components/AP_Button";
import { AP_Error } from "../components/AP_Error";
import { AP_Loading } from "../components/AP_Loading";
import { AP_Modal } from "../components/AP_Modal";
import { AP_PageHeader } from "../components/AP_PageHeader";
import { AP_StatusPill } from "../components/AP_StatusPill";
import { AP_Success } from "../components/AP_Success";
import { appointmentsApi, getErrorMessage } from "../shared/api";
import { toAppointmentView, type ApiAppointment, type AppointmentStatus, type AppointmentView } from "../shared/types";
import "./MyAppointments.css";

const appointmentFilters: ("All" | AppointmentStatus)[] = [
  "All",
  "Pending",
  "Confirmed",
  "Checked In",
  "In Service",
  "Completed",
  "Cancelled",
  "No-show",
];
const pageSize = 5;

type MyAppointmentsProps = {
  onReschedule: (appointment: ApiAppointment) => void;
};

export function MyAppointments({ onReschedule }: MyAppointmentsProps) {
  const [records, setRecords] = useState<ApiAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [appointmentToCancel, setAppointmentToCancel] = useState<AppointmentView | null>(null);
  const [canceling, setCanceling] = useState(false);
  const [filter, setFilter] = useState<(typeof appointmentFilters)[number]>("All");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setRequestError("");
    try {
      setRecords(await appointmentsApi.list());
    } catch (error) {
      setRequestError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAppointments();
  }, [loadAppointments]);

  async function cancelAppointment() {
    if (!appointmentToCancel) return;
    setRequestError("");
    setSuccessMessage("");
    setCanceling(true);
    try {
      await appointmentsApi.cancel(appointmentToCancel.id);
      setSuccessMessage(`Appointment ${appointmentToCancel.reference} cancelled.`);
      setAppointmentToCancel(null);
      await loadAppointments();
    } catch (error) {
      setRequestError(getErrorMessage(error));
    } finally {
      setCanceling(false);
    }
  }

  const appointments = records.map(toAppointmentView);
  const dateFilteredAppointments = appointments.filter((appointment) => {
    const matchesStartDate = !dateFrom || appointment.date >= dateFrom;
    const matchesEndDate = !dateTo || appointment.date <= dateTo;
    return matchesStartDate && matchesEndDate;
  });
  const filteredAppointments = dateFilteredAppointments.filter(
    (appointment) => filter === "All" || appointment.status === filter
  );
  const pageCount = Math.max(1, Math.ceil(filteredAppointments.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visibleAppointments = filteredAppointments.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const firstAppointment = filteredAppointments.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const lastAppointment = Math.min(currentPage * pageSize, filteredAppointments.length);

  return (
    <>
      <AP_PageHeader title="My appointments" description="Your bookings and appointment history." />
      <div className="screen-toolbar appointments-toolbar">
        <span className="demo-label"><span className="live-dot" /> Appointments for your account</span>
        <AP_Button onClick={() => void loadAppointments()} size="small" variant="secondary">Refresh</AP_Button>
      </div>
      {requestError && <AP_Error message={requestError} onRetry={() => void loadAppointments()} />}
      {successMessage && <AP_Success message={successMessage} onDismiss={() => setSuccessMessage("")} />}
      {loading ? <AP_Loading label="Loading your appointments" /> : (
        <>
          <div className="my-appointments-filters" aria-label="Filter appointments by status">
            {appointmentFilters.map((status) => {
              const count = status === "All"
                ? dateFilteredAppointments.length
                : dateFilteredAppointments.filter((appointment) => appointment.status === status).length;
              return (
                <button
                  aria-pressed={filter === status}
                  className={`my-appointment-filter${filter === status ? " selected" : ""}`}
                  key={status}
                  onClick={() => {
                    setFilter(status);
                    setPage(1);
                  }}
                  type="button"
                >
                  {status}<span>{count}</span>
                </button>
              );
            })}
          </div>
          <div className="my-appointments-date-filters">
            <label>
              <span>From</span>
              <input
                aria-label="Appointments from date"
                max={dateTo || undefined}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setPage(1);
                }}
                type="date"
                value={dateFrom}
              />
            </label>
            <label>
              <span>To</span>
              <input
                aria-label="Appointments to date"
                min={dateFrom || undefined}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setPage(1);
                }}
                type="date"
                value={dateTo}
              />
            </label>
            {(dateFrom || dateTo) && (
              <AP_Button
                onClick={() => {
                  setDateFrom("");
                  setDateTo("");
                  setPage(1);
                }}
                size="small"
                variant="secondary"
              >
                Clear dates
              </AP_Button>
            )}
          </div>
          <section className="my-appointment-list">
            {visibleAppointments.map((appointment) => {
              const canChange = appointment.status === "Pending" || appointment.status === "Confirmed";
              const date = new Date(`${appointment.date}T12:00:00`);
              const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(date);
              const day = new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(date);
              const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date);
              return (
                <article className="panel my-appointment-card" key={appointment.id}>
                  <div className="appointment-date"><strong>{day}</strong><span>{month}</span></div>
                  <div className="my-appointment-details">
                    <div className="appointment-card-heading">
                      <h2>{appointment.service}</h2>
                      <AP_StatusPill status={appointment.status} />
                    </div>
                    <p>{weekday}, {appointment.date} · {appointment.time} · {appointment.staff} · Ref {appointment.reference}</p>
                    {canChange && (
                      <div className="card-actions">
                        <AP_Button
                          onClick={() => {
                            const record = records.find((item) => item._id === appointment.id);
                            if (record) onReschedule(record);
                          }}
                          variant="secondary"
                        >
                          Reschedule
                        </AP_Button>
                        <AP_Button
                          onClick={() => {
                            setRequestError("");
                            setAppointmentToCancel(appointment);
                          }}
                          variant="danger"
                        >
                          Cancel
                        </AP_Button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
            {filteredAppointments.length === 0 && (
              <p className="appointments-empty">
                {appointments.length === 0
                  ? "No appointments yet. Book an appointment to see it here."
                  : `No ${filter.toLowerCase()} appointments.`}
              </p>
            )}
          </section>
          {filteredAppointments.length > 0 && (
            <div className="my-appointments-pagination" aria-label="Appointment pages">
              <span>Showing {firstAppointment}–{lastAppointment} of {filteredAppointments.length}</span>
              <div>
                <AP_Button
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                  size="small"
                  variant="secondary"
                >
                  Previous
                </AP_Button>
                <span aria-live="polite">Page {currentPage} of {pageCount}</span>
                <AP_Button
                  disabled={currentPage === pageCount}
                  onClick={() => setPage(currentPage + 1)}
                  size="small"
                  variant="secondary"
                >
                  Next
                </AP_Button>
              </div>
            </div>
          )}
        </>
      )}
      <AP_Modal
        open={Boolean(appointmentToCancel)}
        title="Cancel this appointment?"
        body={
          <>
            <p>Cancel appointment {appointmentToCancel?.reference}? This action cannot be undone.</p>
            {requestError && <AP_Error message={requestError} />}
          </>
        }
        onClose={() => {
          if (!canceling) setAppointmentToCancel(null);
        }}
        actions={
          <>
            <AP_Button
              disabled={canceling}
              onClick={() => setAppointmentToCancel(null)}
              variant="secondary"
            >
              Keep appointment
            </AP_Button>
            <AP_Button loading={canceling} onClick={() => void cancelAppointment()} variant="danger">
              Confirm cancellation
            </AP_Button>
          </>
        }
      />
    </>
  );
}
