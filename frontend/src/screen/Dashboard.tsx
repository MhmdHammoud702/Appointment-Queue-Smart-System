import { useCallback, useEffect, useState } from "react";
import { AP_BarChart } from "../components/AP_BarChart";
import { AP_Button } from "../components/AP_Button";
import { AP_Error } from "../components/AP_Error";
import { AP_Loading } from "../components/AP_Loading";
import { AP_PageHeader } from "../components/AP_PageHeader";
import { AP_StatCard } from "../components/AP_StatCard";
import { AP_StatusPill } from "../components/AP_StatusPill";
import { AP_Table } from "../components/AP_Table";
import { appointmentsApi, dashboardApi, getErrorMessage, queueApi } from "../shared/api";
import {
  getBeirutToday,
  toAppointmentView,
  toQueueView,
  type AppointmentView,
  type DashboardStats,
  type QueueView,
  type ScreenName,
} from "../shared/types";
import "./Dashboard.css";

type DashboardProps = {
  onNavigate: (screen: ScreenName) => void;
};

function getWeekStart(date: string): string {
  const day = new Date(`${date}T12:00:00`).getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(`${date}T12:00:00`);
  monday.setDate(monday.getDate() + mondayOffset);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Beirut" }).format(monday);
}

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

export function Dashboard({ onNavigate }: DashboardProps) {
  const today = getBeirutToday();
  const [from, setFrom] = useState(getWeekStart(today));
  const [to, setTo] = useState(today);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [appointments, setAppointments] = useState<AppointmentView[]>([]);
  const [queue, setQueue] = useState<QueueView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [nextStats, apiAppointments, queueEntries] = await Promise.all([
        dashboardApi.stats(from, to),
        appointmentsApi.list({
          from: localDateTimeToIso(from, "00:00"),
          to: localDateTimeToIso(to, "23:59"),
        }),
        queueApi.list(),
      ]);
      setStats(nextStats);
      setAppointments(apiAppointments.map(toAppointmentView));
      setQueue(queueEntries.map(toQueueView));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void loadDashboard();
    const onQueueUpdate = () => void loadDashboard();
    window.addEventListener("queue-updated", onQueueUpdate);
    return () => window.removeEventListener("queue-updated", onQueueUpdate);
  }, [loadDashboard]);

  const waitingCount = queue.filter((entry) => entry.status === "Waiting").length;
  const nextAppointments = appointments.filter((appointment) =>
    appointment.date >= from && appointment.date <= to &&
    appointment.status !== "Cancelled" && appointment.status !== "No-show",
  );
  const chartData = stats?.sevenDayVolume ?? [];
  const formattedRange = `${from} – ${to}`;

  return (
    <>
      <AP_PageHeader
        title="Dashboard"
        description="Appointments, activity and the live queue for your clinic."
        action={{ label: "View appointments", onClick: () => onNavigate("Appointments") }}
      />

      <div className="screen-toolbar">
        <span className="demo-label"><span className="live-dot" /> Connected to backend</span>
        <div className="date-range">
          <label>From <input aria-label="Dashboard start date" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>To <input aria-label="Dashboard end date" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label>
          <AP_Button onClick={() => void loadDashboard()} size="small" variant="secondary">Refresh</AP_Button>
        </div>
      </div>

      {error && <AP_Error message={error} onRetry={() => void loadDashboard()} />}

      <section className="stats-grid" aria-label="Appointment summary">
        <AP_StatCard title="Appointments" value={loading ? "—" : String(stats?.appointments ?? 0)} detail={formattedRange} symbol="▣" color="teal" />
        <AP_StatCard title="Completed" value={loading ? "—" : String(stats?.completed ?? 0)} detail="In selected date range" symbol="✓" color="blue" />
        <AP_StatCard title="Cancelled" value={loading ? "—" : String(stats?.cancelled ?? 0)} detail="In selected date range" symbol="×" color="orange" />
        <AP_StatCard title="Waiting now" value={loading ? "—" : String(waitingCount)} detail={`${queue.length} active queue entries`} symbol="◷" color="purple" />
        <AP_StatCard title="Est. revenue" value={loading ? "—" : `$${(stats?.estimatedRevenue ?? 0).toFixed(2)}`} detail="Completed appointments" symbol="$" color="green" />
      </section>

      <section className="dashboard-panels">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <h2>Appointments, last 7 days</h2>
              <p>Daily volume from the backend</p>
            </div>
            <span className="muted-text">{loading ? "Loading" : `${chartData.reduce((total, item) => total + item.count, 0)} total`}</span>
          </div>
          {loading ? <AP_Loading label="Loading appointment chart" /> : <AP_BarChart data={chartData} />}
        </article>

        <article className="panel live-queue-panel">
          <div className="panel-heading">
            <div>
              <h2>Live queue</h2>
              <p><span className="live-dot" /> {waitingCount} waiting</p>
            </div>
            <AP_Button variant="text" onClick={() => onNavigate("Queue")}>View all</AP_Button>
          </div>
          {loading ? <AP_Loading label="Loading queue" /> : (
            <div className="queue-preview">
              {queue.slice(0, 3).map((entry) => (
                <div className="queue-preview-row" key={entry.id}>
                  <span className="queue-number">{entry.number}</span>
                  <span className="queue-person">
                    <strong>{entry.customer}</strong>
                    <small>{entry.service}</small>
                  </span>
                  <span className="wait-time">{entry.wait}</span>
                </div>
              ))}
              {queue.length === 0 && <p className="dashboard-empty">No active queue entries.</p>}
            </div>
          )}
          <AP_Button className="full-width" variant="secondary" onClick={() => onNavigate("Queue")}>Open queue</AP_Button>
        </article>

        <article className="panel appointments-panel">
          <div className="panel-heading">
            <div>
              <h2>Appointments</h2>
              <p>{loading ? "Loading appointments" : `${nextAppointments.length} appointments in range`}</p>
            </div>
            <AP_Button variant="text" onClick={() => onNavigate("Appointments")}>All appointments →</AP_Button>
          </div>
          <AP_Table
            columns={[
              { label: "Time", render: (appointment) => <span className="strong-cell">{appointment.time}</span>, sortValue: (appointment) => appointment.start },
              { label: "Customer", render: (appointment) => (
                <span className="customer-cell">
                  <span className="avatar">{appointment.initials}</span>
                  {appointment.customer}
                </span>
              ), sortValue: (appointment) => appointment.customer },
              { label: "Service", render: (appointment) => appointment.service, sortValue: (appointment) => appointment.service },
              { label: "Staff", render: (appointment) => appointment.staff, sortValue: (appointment) => appointment.staff },
              { label: "Status", render: (appointment) => <AP_StatusPill status={appointment.status} /> },
            ]}
            rows={nextAppointments}
            rowKey={(appointment) => appointment.id}
            loading={loading}
            error={error || undefined}
            onRetry={() => void loadDashboard()}
            emptyMessage="No appointments in this date range."
            emptyActionLabel="Book appointment"
            onEmptyAction={() => onNavigate("Book appointment")}
          />
        </article>
      </section>
    </>
  );
}
