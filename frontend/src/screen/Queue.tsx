import { useCallback, useEffect, useState } from "react";
import * as yup from "yup";
import { AP_Button } from "../components/AP_Button";
import { AP_Error } from "../components/AP_Error";
import { AP_StatusPill } from "../components/AP_StatusPill";
import { AP_Table, type AP_TableColumn } from "../components/AP_Table";
import { AP_Textbox } from "../components/AP_Textbox";
import { appointmentsApi, getErrorMessage, queueApi } from "../shared/api";
import { getBeirutToday, toAppointmentView, toQueueView, type AppointmentView, type QueueView, type UserRole } from "../shared/types";
import "./Queue.css";

type QueueProps = {
  role: UserRole;
};

const checkInSchema = yup.object({
  reference: yup.string().trim().required("Enter the appointment reference."),
});

function localDateTimeToIso(date: string, time: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const reference = new Date(Date.UTC(year!, month! - 1, day!, 12));
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Beirut",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(reference);
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value);
  const localAsUtc = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"));
  const offset = localAsUtc - reference.getTime();
  const [hour, minute] = time.split(":").map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!, hour!, minute!) - offset).toISOString();
}

function dayRange(date: string) {
  const nextDate = new Date(`${date}T12:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  const nextDateString = nextDate.toISOString().slice(0, 10);
  return {
    from: localDateTimeToIso(date, "00:00"),
    to: new Date(new Date(localDateTimeToIso(nextDateString, "00:00")).getTime() - 1).toISOString(),
  };
}

export function Queue({ role }: QueueProps) {
  const today = getBeirutToday();
  const [entries, setEntries] = useState<QueueView[]>([]);
  const [dailyAppointments, setDailyAppointments] = useState<AppointmentView[]>([]);
  const [selectedDate, setSelectedDate] = useState(today);
  const [reference, setReference] = useState("");
  const [referenceError, setReferenceError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [actionError, setActionError] = useState("");
  const [checkInError, setCheckInError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [workingId, setWorkingId] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadQueue = useCallback(async () => {
    setRequestError("");
    try {
      if (role === "Receptionist") {
        const [appointments, queue] = await Promise.all([
          appointmentsApi.list(dayRange(selectedDate)),
          selectedDate === today ? queueApi.list() : Promise.resolve([]),
        ]);
        setDailyAppointments(appointments.map(toAppointmentView));
        setEntries(queue.map(toQueueView));
      } else {
        const result = await queueApi.list();
        setEntries(result.map(toQueueView));
      }
      setLastUpdated(new Date());
    } catch (error) {
      setRequestError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [role, selectedDate, today]);

  useEffect(() => {
    setLoading(true);
    void loadQueue();
    const onQueueUpdate = () => void loadQueue();
    window.addEventListener("queue-updated", onQueueUpdate);
    return () => window.removeEventListener("queue-updated", onQueueUpdate);
  }, [loadQueue]);

  async function checkInCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReferenceError("");
    setCheckInError("");
    setActionSuccess("");
    try {
      const fields = await checkInSchema.validate({ reference }, { abortEarly: false });
      const appointment = dailyAppointments.find(
        (item) => item.reference.toLowerCase() === fields.reference.toLowerCase(),
      );
      if (appointment && appointment.status !== "Confirmed") {
        setCheckInError(appointment.status === "Pending"
          ? "This appointment is pending. Confirm it from Appointments before checking it in."
          : `This appointment is already ${appointment.status.toLowerCase()} and cannot be checked in again.`);
        return;
      }
      setSaving(true);
      const entry = await queueApi.checkIn(fields.reference.toUpperCase());
      setReference("");
      setActionSuccess(`Checked in successfully. Queue number A-${String(entry.queueNumber).padStart(3, "0")}.`);
      await loadQueue();
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        setReferenceError(error.message);
      } else {
        setCheckInError(getErrorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  }

  async function checkInAppointment(appointmentReference: string, id: string) {
    setWorkingId(id);
    setCheckInError("");
    setActionSuccess("");
    try {
      const entry = await queueApi.checkIn(appointmentReference);
      setActionSuccess(`Checked in successfully. Queue number A-${String(entry.queueNumber).padStart(3, "0")}.`);
      await loadQueue();
    } catch (error) {
      setCheckInError(getErrorMessage(error));
    } finally {
      setWorkingId("");
    }
  }

  async function updateEntry(id: string, action: "call" | "complete") {
    setWorkingId(id);
    setActionError("");
    setActionSuccess("");
    try {
      if (action === "call") {
        await queueApi.call(id);
      } else {
        await queueApi.complete(id);
      }
      await loadQueue();
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setWorkingId("");
    }
  }

  const isReceptionist = role === "Receptionist";
  const canCheckInOnSelectedDay = selectedDate === today;
  const receptionistReady = dailyAppointments.filter((item) => item.status === "Confirmed").length;
  const waitingEntries = entries.filter((entry) => entry.status === "Waiting");
  const inServiceEntries = entries.filter((entry) => entry.status === "In Service");
  const latestQueueEntry = entries[entries.length - 1];
  const averageWait = waitingEntries.length
    ? Math.round(waitingEntries.reduce((total, entry) => total + Number.parseInt(entry.wait, 10), 0) / waitingEntries.length)
    : 0;
  const waitingColumns: AP_TableColumn<QueueView>[] = [
    { label: "Number", render: (entry) => <span className="queue-number">{entry.number}</span>, sortValue: (entry) => entry.number },
    { label: "Customer", render: (entry) => <span className="strong-cell">{entry.customer}</span>, sortValue: (entry) => entry.customer },
    { label: "Service", render: (entry) => entry.service, sortValue: (entry) => entry.service },
    { label: "Staff", render: (entry) => entry.staff, sortValue: (entry) => entry.staff },
    { label: "Checked in", render: (entry) => entry.checkedInAt, sortValue: (entry) => entry.checkedInAt },
    { label: "Waiting", render: (entry) => entry.wait, sortValue: (entry) => Number.parseInt(entry.wait, 10) },
  ];

  if (!isReceptionist) {
    waitingColumns.push({
      label: "Action",
      render: (entry) => (
        <AP_Button
          loading={workingId === entry.id}
          onClick={() => void updateEntry(entry.id, "call")}
          size="small"
        >Call</AP_Button>
      ),
    });
  }

  const queueDate = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Beirut",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${isReceptionist ? selectedDate : today}T12:00:00Z`));
  const updatedTime = lastUpdated
    ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(lastUpdated)
    : "Connecting";

  return (
    <>
      <div className="queue-page-heading">
        <div className="queue-page-title">
          <h1>Live queue</h1>
          <span>{queueDate} · Queue A{isReceptionist ? " · Appointments" : ""}</span>
        </div>
        <span className="queue-updated-time">Updated {updatedTime}</span>
      </div>
      <div className="queue-toolbar">
        {isReceptionist ? (
          <label className="queue-date-field">
            Appointment day
            <input
              aria-label="Appointments day"
              onChange={(event) => {
                if (event.target.value) {
                  setSelectedDate(event.target.value);
                  setLoading(true);
                }
              }}
              type="date"
              value={selectedDate}
            />
          </label>
        ) : (
          <div className="queue-status-strip">
            {role === "Admin" ? <span>Check in, call, and complete today's appointments.</span> : <span>Call and complete customers in your queue.</span>}
          </div>
        )}
        <div className="queue-toolbar-actions">
          <span className="queue-polling-note">Live updates enabled</span>
          <AP_Button onClick={() => void loadQueue()} size="small" variant="secondary">Refresh</AP_Button>
        </div>
      </div>
      {actionSuccess && <p className="queue-action-success queue-global-action-success" role="status">{actionSuccess}</p>}
      {actionError && <p className="queue-action-error queue-global-action-error" role="alert">{actionError}</p>}
      {requestError && <AP_Error message={requestError} onRetry={() => void loadQueue()} />}

      {!canCheckInOnSelectedDay && isReceptionist && (
        <p className="queue-day-note">Live queue numbers and waiting times are available for today. This view is showing appointments for the selected date.</p>
      )}

      <section className={`queue-stage${role === "Admin" ? " queue-stage-admin" : ""}${isReceptionist ? " queue-stage-receptionist" : ""}`}>
        {(role === "Admin" || isReceptionist) && (
          <section className={`panel queue-checkin-panel${isReceptionist ? " queue-reception-checkin" : " queue-admin-checkin"}`}>
            <div className="panel-heading">
              <div>
                <h2>Check in a customer</h2>
                <p>{isReceptionist ? "Only confirmed appointments can be checked in." : "Booking reference"}</p>
              </div>
              {isReceptionist && <span className="queue-ready-count">{loading ? "—" : `${receptionistReady} ready`}</span>}
            </div>
            {!canCheckInOnSelectedDay && isReceptionist && <p className="queue-day-note">Check-in is available for today's appointments only.</p>}
            <form className="queue-checkin-form" onSubmit={(event) => void checkInCustomer(event)} noValidate>
              <AP_Textbox
                label="Appointment reference"
                placeholder="For example, APT-7K3Q9M"
                value={reference}
                error={referenceError}
                onChange={(value) => { setReference(value); setReferenceError(""); setCheckInError(""); }}
                disabled={isReceptionist && !canCheckInOnSelectedDay}
              />
              <AP_Button disabled={isReceptionist && !canCheckInOnSelectedDay} loading={saving} type="submit">Check in</AP_Button>
            </form>
            {checkInError && <p className="queue-checkin-error" role="alert">{checkInError}</p>}
            {!isReceptionist && <p className="queue-checkin-hint">Only confirmed appointments can be checked in.</p>}
            {latestQueueEntry && (
              <small className="queue-last-checkin">
                Last check-in: {latestQueueEntry.number} · {latestQueueEntry.customer}, {latestQueueEntry.checkedInAt}
              </small>
            )}
          </section>
        )}
        {loading ? (
          <div className="panel queue-service-empty">Loading in-service customers…</div>
        ) : inServiceEntries.length > 0 ? (
          <div className="queue-service-grid">
            {inServiceEntries.map((entry) => (
              <article className="panel queue-service-card" key={entry.id}>
                <div className="queue-service-card-top">
                  <strong>In service</strong>
                  <AP_StatusPill status={entry.status} />
                </div>
                <span className="queue-service-number">{entry.number}</span>
                <strong className="queue-service-customer">{entry.customer}</strong>
                <span className="queue-service-name">{entry.service}</span>
                <small>{entry.staff}</small>
                <span className="queue-service-time">
                  <span className="live-dot" /> In service{entry.serviceTime ? `, ${entry.serviceTime}` : ""}
                </span>
                {role !== "Receptionist" && (
                  <AP_Button
                    className="queue-complete-button"
                    loading={workingId === entry.id}
                    onClick={() => void updateEntry(entry.id, "complete")}
                    size="small"
                    variant="secondary"
                  >Complete</AP_Button>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div className="panel queue-service-empty">No customers are currently in service.</div>
        )}
      </section>

      <section className="panel queue-table-panel">
        <div className="queue-section-heading queue-waiting-heading">
          <div>
            <h2>Waiting list <span>{loading ? "—" : waitingEntries.length}</span></h2>
            <p>Customers are shown in check-in order.</p>
          </div>
          <span>{loading ? "Avg. wait —" : `Avg. wait ${averageWait} min`}</span>
        </div>
        <AP_Table
          columns={waitingColumns}
          rows={waitingEntries}
          rowKey={(entry) => entry.id}
          loading={loading}
          emptyMessage="There are no customers waiting in today's queue."
        />
      </section>

      {isReceptionist && (
        <section className="panel queue-table-panel queue-appointments-panel">
          <div className="queue-section-heading queue-waiting-heading">
            <div>
              <h2>Daily appointments <span>{loading ? "—" : dailyAppointments.length}</span></h2>
              <p>Appointments for {selectedDate}. Only confirmed bookings can be checked in.</p>
            </div>
          </div>
          <AP_Table
            columns={[
              { label: "Time", render: (item) => <span className="strong-cell">{item.time}</span>, sortValue: (item) => item.start },
              { label: "Reference", render: (item) => item.reference, sortValue: (item) => item.reference },
              { label: "Customer", render: (item) => <span className="strong-cell">{item.customer}</span>, sortValue: (item) => item.customer },
              { label: "Service", render: (item) => item.service, sortValue: (item) => item.service },
              { label: "Staff", render: (item) => item.staff, sortValue: (item) => item.staff },
              { label: "Status", render: (item) => <AP_StatusPill status={item.status} /> },
              {
                label: "Action",
                render: (item) => item.status === "Confirmed" && canCheckInOnSelectedDay
                  ? <AP_Button
                    loading={workingId === item.id}
                    onClick={() => void checkInAppointment(item.reference, item.id)}
                    size="small"
                  >Check in</AP_Button>
                  : <span className="muted-text">—</span>,
              },
            ]}
            rows={dailyAppointments}
            rowKey={(item) => item.id}
            loading={loading}
            emptyMessage={`No appointments found for ${selectedDate}.`}
          />
        </section>
      )}
    </>
  );
}
