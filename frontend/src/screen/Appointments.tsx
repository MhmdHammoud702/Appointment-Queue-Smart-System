import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { AP_Button } from "../components/AP_Button";
import { AP_Error } from "../components/AP_Error";
import { AP_Modal } from "../components/AP_Modal";
import { AP_PageHeader } from "../components/AP_PageHeader";
import { AP_StatusPill } from "../components/AP_StatusPill";
import { AP_Table } from "../components/AP_Table";
import { AP_Textbox } from "../components/AP_Textbox";
import { AP_Select } from "../components/AP_Select";
import { appointmentsApi, getErrorMessage, queueApi, staffApi } from "../shared/api";
import { getBeirutToday, toAppointmentView, type ApiAppointment, type AppointmentStatus, type AppointmentView, type UserRole } from "../shared/types";
import "./Appointments.css";

type AppointmentsProps = {
  role: UserRole;
  onReschedule: (appointment: ApiAppointment) => void;
};

const filters: ("All" | AppointmentStatus)[] = [
  "All",
  "Pending",
  "Confirmed",
  "Checked In",
  "In Service",
  "Completed",
  "Cancelled",
  "No-show",
];

type ActionMenuPosition = {
  appointmentId: string;
  anchor: HTMLButtonElement;
  top: number;
  left: number;
};

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

function nextDate(date: string): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function Appointments({ role, onReschedule }: AppointmentsProps) {
  const today = getBeirutToday();
  const [items, setItems] = useState<AppointmentView[]>([]);
  const [records, setRecords] = useState<ApiAppointment[]>([]);
  const [staffNames, setStaffNames] = useState<string[]>([]);
  const [staffError, setStaffError] = useState("");
  const [selectedDate, setSelectedDate] = useState(today);
  const [dateFilter, setDateFilter] = useState<"all" | "custom">("all");
  const [selectedStaff, setSelectedStaff] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState("");
  const [actionError, setActionError] = useState("");
  const [workingId, setWorkingId] = useState("");
  const [actionMenu, setActionMenu] = useState<ActionMenuPosition | null>(null);
  const [positionedMenuId, setPositionedMenuId] = useState("");
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const [appointmentToCancel, setAppointmentToCancel] = useState<AppointmentView | null>(null);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setRequestError("");
    try {
      const range = dateFilter === "custom"
        ? {
          from: localDateTimeToIso(selectedDate, "00:00"),
          to: new Date(new Date(localDateTimeToIso(nextDate(selectedDate), "00:00")).getTime() - 1).toISOString(),
        }
        : {};
      const results = await appointmentsApi.list(range);
      setRecords(results);
      setItems(results.map(toAppointmentView));
    } catch (error) {
      setRequestError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [dateFilter, selectedDate]);

  useEffect(() => {
    void loadAppointments();
    const onQueueUpdate = () => void loadAppointments();
    window.addEventListener("queue-updated", onQueueUpdate);
    return () => window.removeEventListener("queue-updated", onQueueUpdate);
  }, [loadAppointments]);

  useEffect(() => {
    if (!actionMenu) return;

    function closeFromOutside(event: MouseEvent) {
      const target = event.target;
      if (
        target instanceof Element &&
        !target.closest(".appointment-row-menu-items") &&
        !target.closest(".appointment-row-menu")
      ) {
        setActionMenu(null);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setActionMenu(null);
    }

    document.addEventListener("click", closeFromOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("click", closeFromOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [actionMenu]);

  useLayoutEffect(() => {
    if (!actionMenu) return;
    const currentMenu = actionMenu;

    function positionMenu() {
      const anchor = currentMenu.anchor;
      const menu = actionMenuRef.current;
      if (!anchor.isConnected || !menu) return;

      const anchorBounds = anchor.getBoundingClientRect();
      const menuBounds = menu.getBoundingClientRect();
      const left = Math.max(8, Math.min(anchorBounds.left, window.innerWidth - menuBounds.width - 8));
      const below = anchorBounds.bottom + 5;
      const top = below + menuBounds.height <= window.innerHeight - 8
        ? below
        : Math.max(8, anchorBounds.top - menuBounds.height - 5);

      setActionMenu((current) => {
        if (
          !current ||
          current.appointmentId !== currentMenu.appointmentId ||
          (current.top === top && current.left === left)
        ) {
          return current;
        }
        return { ...current, top, left };
      });
      setPositionedMenuId(currentMenu.appointmentId);
    }

    positionMenu();
    window.addEventListener("resize", positionMenu);
    window.addEventListener("scroll", positionMenu, true);
    return () => {
      window.removeEventListener("resize", positionMenu);
      window.removeEventListener("scroll", positionMenu, true);
    };
  }, [actionMenu]);

  const loadStaff = useCallback(async () => {
    if (role === "Customer") return;
    setStaffError("");
    try {
      const staff = await staffApi.list();
      setStaffNames([...new Set(staff.map((member) => member.fullName))].sort());
    } catch (error) {
      setStaffError(getErrorMessage(error));
    }
  }, [role]);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  const visibleAppointments = useMemo(() => items.filter((appointment) => {
    const matchesStatus = filter === "All" || appointment.status === filter;
    const matchesStaff = !selectedStaff || appointment.staff === selectedStaff;
    const searchText = `${appointment.reference} ${appointment.customer} ${appointment.service}`.toLowerCase();
    return matchesStatus && matchesStaff && searchText.includes(search.toLowerCase());
  }), [filter, items, search, selectedStaff]);

  const canConfirm = role === "Admin" || role === "Receptionist";
  const canCheckIn = role === "Admin" || role === "Receptionist";
  const canCancel = role === "Admin" || role === "Staff";
  const canReschedule = role === "Admin" || role === "Staff";
  const actionMenuAppointment = actionMenu
    ? visibleAppointments.find((appointment) => appointment.id === actionMenu.appointmentId) ?? null
    : null;

  async function updateAppointment(id: string, action: "confirm" | "cancel" | "check-in") {
    setWorkingId(id);
    setActionError("");
    setActionMenu(null);
    try {
      if (action === "confirm") {
        await appointmentsApi.confirm(id);
      } else if (action === "cancel") {
        await appointmentsApi.cancel(id);
        setAppointmentToCancel(null);
      } else {
        const appointment = items.find((item) => item.id === id);
        if (!appointment) return;
        await queueApi.checkIn(appointment.reference);
      }
      await loadAppointments();
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setWorkingId("");
    }
  }

  const staffOptions = [
    ...staffNames.map((name) => ({ value: name, label: name })),
  ];

  function toggleActionMenu(event: ReactMouseEvent<HTMLButtonElement>, appointmentId: string) {
    if (actionMenu?.appointmentId === appointmentId) {
      setActionMenu(null);
      setPositionedMenuId("");
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    setPositionedMenuId("");
    setActionMenu({
      appointmentId,
      anchor: event.currentTarget,
      top: bounds.bottom + 5,
      left: bounds.left,
    });
  }

  return (
    <>
      <AP_PageHeader
        title="Appointments"
        description={role === "Receptionist"
          ? "Review appointments, confirm pending bookings, and check customers in."
          : role === "Staff"
            ? "Review your assigned appointments and update their status."
            : "View appointments, filter by status, and manage booking changes."}
      />

      <div className="appointment-controls">
        <AP_Textbox
          className="appointment-search"
          label="Search appointments"
          placeholder="Search by reference or customer"
          value={search}
          onChange={setSearch}
        />
        <div className="appointment-date-control">
          <label htmlFor="appointment-date-filter">Date range</label>
          <select
            id="appointment-date-filter"
            aria-label="Appointment date filter"
            onChange={(event) => setDateFilter(event.target.value === "custom" ? "custom" : "all")}
            value={dateFilter}
          >
            <option value="all">All dates</option>
            <option value="custom">Custom date</option>
          </select>
          {dateFilter === "custom" && (
            <input
              aria-label="Appointment date"
              onChange={(event) => {
                if (event.target.value) setSelectedDate(event.target.value);
              }}
              type="date"
              value={selectedDate}
            />
          )}
        </div>
        {role !== "Customer" && (
          <AP_Select
            label="Staff"
            value={selectedStaff}
            options={staffOptions}
            placeholder="All staff"
            onChange={setSelectedStaff}
          />
        )}
        <span className="appointment-sort-label">Sorted by time</span>
      </div>

      <div className="filter-row" aria-label="Filter appointments by status">
        {filters.map((name) => {
          const count = name === "All" ? items.length : items.filter((item) => item.status === name).length;
          return (
            <button
              aria-pressed={filter === name}
              className={`appointment-filter${filter === name ? " selected" : ""}`}
              key={name}
              onClick={() => setFilter(name)}
              type="button"
            >
              {name}<span>{count}</span>
            </button>
          );
        })}
      </div>

      {staffError && <AP_Error message={staffError} onRetry={() => void loadStaff()} />}
      {actionError && <AP_Error message={actionError} onRetry={() => setActionError("")} />}
      <section className="panel table-panel appointments-table-panel">
        <AP_Table
          columns={[
            { label: "Time", render: (appointment) => <span className="appointment-time">{appointment.time}</span>, sortValue: (appointment) => appointment.start },
            { label: "Reference", render: (appointment) => <span className="appointment-reference">{appointment.reference}</span>, sortValue: (appointment) => appointment.reference },
            { label: "Customer", render: (appointment) => <span className="appointment-customer">{appointment.customer}</span>, sortValue: (appointment) => appointment.customer },
            { label: "Service", render: (appointment) => appointment.service, sortValue: (appointment) => appointment.service },
            { label: "Staff", render: (appointment) => appointment.staff, sortValue: (appointment) => appointment.staff },
            { label: "Status", render: (appointment) => <AP_StatusPill status={appointment.status} /> },
            {
              label: "",
              render: (appointment) => {
                const canCancelAppointment = canCancel &&
                  ["Pending", "Confirmed"].includes(appointment.status);
                const canRescheduleAppointment = canReschedule &&
                  ["Pending", "Confirmed"].includes(appointment.status);
                const hasActions = (canConfirm && appointment.status === "Pending") ||
                  (canCheckIn && appointment.status === "Confirmed") ||
                  canCancelAppointment ||
                  canRescheduleAppointment;

                if (!hasActions) return <span className="muted-text">—</span>;
                return (
                  <div className="appointment-row-menu">
                    <AP_Button
                      aria-expanded={actionMenu?.appointmentId === appointment.id}
                      aria-label={`Actions for ${appointment.reference}`}
                      disabled={workingId === appointment.id}
                      onClick={(event) => toggleActionMenu(event, appointment.id)}
                      size="small"
                      variant="secondary"
                    >···</AP_Button>
                  </div>
                );
              },
            },
          ]}
          rows={visibleAppointments}
          rowKey={(appointment) => appointment.id}
          loading={loading}
          error={requestError || undefined}
          onRetry={() => void loadAppointments()}
          emptyMessage="No appointments match this date and filter."
          emptyActionLabel={search || selectedStaff || filter !== "All" ? "Clear filters" : undefined}
          onEmptyAction={() => { setSearch(""); setSelectedStaff(""); setFilter("All"); }}
        />
      </section>
      {actionMenu && actionMenuAppointment && createPortal(
        <div
          ref={actionMenuRef}
          className="appointment-row-menu-items"
          role="menu"
          style={{
            position: "fixed",
            top: actionMenu.top,
            left: actionMenu.left,
            visibility: positionedMenuId === actionMenu.appointmentId ? "visible" : "hidden",
          }}
        >
          <small>{actionMenuAppointment.status} booking</small>
          {canCheckIn && actionMenuAppointment.status === "Confirmed" && (
            <button onClick={() => void updateAppointment(actionMenuAppointment.id, "check-in")} role="menuitem" type="button">
              Check in <span>adds to queue</span>
            </button>
          )}
          {canConfirm && actionMenuAppointment.status === "Pending" && (
            <button onClick={() => void updateAppointment(actionMenuAppointment.id, "confirm")} role="menuitem" type="button">
              Confirm
            </button>
          )}
          {canReschedule && ["Pending", "Confirmed"].includes(actionMenuAppointment.status) && (
            <button
              onClick={() => {
                setActionMenu(null);
                const record = records.find((item) => item._id === actionMenuAppointment.id);
                if (record) onReschedule(record);
              }}
              role="menuitem"
              type="button"
            >
              Reschedule
            </button>
          )}
          {canCancel && ["Pending", "Confirmed"].includes(actionMenuAppointment.status) && (
            <button
              className="cancel-action"
              onClick={() => {
                setActionError("");
                setActionMenu(null);
                setAppointmentToCancel(actionMenuAppointment);
              }}
              role="menuitem"
              type="button"
            >
              Cancel appointment
            </button>
          )}
        </div>,
        document.body
      )}
      <AP_Modal
        open={Boolean(appointmentToCancel)}
        title="Cancel this appointment?"
        body={
          <>
            <p>Cancel appointment {appointmentToCancel?.reference}? This action cannot be undone.</p>
            {actionError && <AP_Error message={actionError} />}
          </>
        }
        onClose={() => {
          if (!workingId) setAppointmentToCancel(null);
        }}
        actions={
          <>
            <AP_Button
              disabled={Boolean(workingId)}
              onClick={() => setAppointmentToCancel(null)}
              variant="secondary"
            >
              Keep appointment
            </AP_Button>
            <AP_Button
              disabled={!appointmentToCancel || workingId === appointmentToCancel.id}
              loading={Boolean(appointmentToCancel && workingId === appointmentToCancel.id)}
              onClick={() => appointmentToCancel && void updateAppointment(appointmentToCancel.id, "cancel")}
              variant="danger"
            >
              Confirm cancellation
            </AP_Button>
          </>
        }
      />
    </>
  );
}
