import { useCallback, useEffect, useState } from "react";
import { AP_Button } from "../components/AP_Button";
import { AP_Error } from "../components/AP_Error";
import { AP_Loading } from "../components/AP_Loading";
import { AP_PageHeader } from "../components/AP_PageHeader";
import { AP_StatusPill } from "../components/AP_StatusPill";
import { AP_Success } from "../components/AP_Success";
import { appointmentsApi, getErrorMessage } from "../shared/api";
import { toAppointmentView, type ApiAppointment, type AppointmentView } from "../shared/types";
import "./MyAppointments.css";

type MyAppointmentsProps = {
  onReschedule: (appointment: ApiAppointment) => void;
};

export function MyAppointments({ onReschedule }: MyAppointmentsProps) {
  const [records, setRecords] = useState<ApiAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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

  async function cancelAppointment(appointment: AppointmentView) {
    if (!window.confirm(`Cancel appointment ${appointment.reference}?`)) return;
    setRequestError("");
    setSuccessMessage("");
    try {
      await appointmentsApi.cancel(appointment.id);
      setSuccessMessage(`Appointment ${appointment.reference} cancelled.`);
      await loadAppointments();
    } catch (error) {
      setRequestError(getErrorMessage(error));
    }
  }

  const appointments = records.map(toAppointmentView);

  return (
    <>
      <AP_PageHeader title="My appointments" description="Your bookings and appointment history." />
      <div className="screen-toolbar appointments-toolbar">
        <span className="demo-label"><span className="live-dot" /> Appointments for your account</span>
        <AP_Button onClick={() => void loadAppointments()} size="small" variant="secondary">Refresh</AP_Button>
      </div>
      {requestError && <AP_Error message={requestError} onRetry={() => void loadAppointments()} />}
      {successMessage && <AP_Success message={successMessage} />}
      {loading ? <AP_Loading label="Loading your appointments" /> : (
        <section className="my-appointment-list">
          {appointments.map((appointment) => {
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
                      <AP_Button onClick={() => void cancelAppointment(appointment)} variant="danger">Cancel</AP_Button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
          {appointments.length === 0 && <p className="appointments-empty">No appointments yet. Book an appointment to see it here.</p>}
        </section>
      )}
    </>
  );
}
