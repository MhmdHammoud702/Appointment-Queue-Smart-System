import { useCallback, useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import * as yup from "yup";
import { AP_Button } from "../components/AP_Button";
import { AP_Error } from "../components/AP_Error";
import { AP_Loading } from "../components/AP_Loading";
import { AP_Modal } from "../components/AP_Modal";
import { AP_PageHeader } from "../components/AP_PageHeader";
import { AP_Select } from "../components/AP_Select";
import { AP_Success } from "../components/AP_Success";
import { AP_Textbox } from "../components/AP_Textbox";
import { getErrorMessage, servicesApi, staffApi } from "../shared/api";
import type { ApiSchedule, ApiService, ApiStaff, EmployeeRole, RegisterFields, ScheduleFields } from "../shared/types";
import { getRecordId } from "../shared/types";
import { registerSchema } from "../shared/validation";
import "./Staff.css";

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const emptyStaffForm: RegisterFields = { fullName: "", email: "", phone: "", password: "" };

function getScheduleFields(schedule: ApiSchedule): ScheduleFields {
  return {
    weeklyIntervals: schedule.weeklyIntervals.filter((interval) => !schedule.daysOff.includes(interval.day)),
    daysOff: [],
    services: schedule.services.map((service) => typeof service === "string" ? service : getRecordId(service)),
  };
}

export function Staff() {
  const [staff, setStaff] = useState<ApiStaff[]>([]);
  const [services, setServices] = useState<ApiService[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<ApiStaff | null>(null);
  const [schedule, setSchedule] = useState<ScheduleFields>({ weeklyIntervals: [], daysOff: [], services: [] });
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [staffFormOpen, setStaffFormOpen] = useState(false);
  const [staffForm, setStaffForm] = useState(emptyStaffForm);
  const [employeeRole, setEmployeeRole] = useState<EmployeeRole>("Staff");
  const [accountSaving, setAccountSaving] = useState(false);
  const [staffErrors, setStaffErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [requestError, setRequestError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadStaff = useCallback(async () => {
    setLoading(true);
    setRequestError("");
    try {
      const [staffResult, serviceResult] = await Promise.all([staffApi.list(), servicesApi.list()]);
      setStaff(staffResult);
      setServices(serviceResult);
    } catch (error) {
      setRequestError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStaff();
  }, [loadStaff]);

  async function openSchedule(member: ApiStaff) {
    setSelectedStaff(member);
    setScheduleLoading(true);
    setScheduleError("");
    try {
      const result = await staffApi.getSchedule(getRecordId(member));
      setSchedule(getScheduleFields(result));
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setSchedule({ weeklyIntervals: [], daysOff: [], services: [] });
      } else {
        setScheduleError(getErrorMessage(error));
      }
    } finally {
      setScheduleLoading(false);
    }
  }

  async function createStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStaffErrors({});
    setRequestError("");
    try {
      const fields = await registerSchema.validate(staffForm, { abortEarly: false });
      setAccountSaving(true);
      if (employeeRole === "Receptionist") {
        await staffApi.createReceptionist(fields);
      } else {
        await staffApi.create(fields);
      }
      setStaffFormOpen(false);
      setStaffForm(emptyStaffForm);
      setSuccessMessage(`${employeeRole} account created.`);
      await loadStaff();
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const nextErrors: Record<string, string> = {};
        error.inner.forEach((issue) => {
          if (issue.path) nextErrors[issue.path] = issue.message;
        });
        setStaffErrors(nextErrors);
      } else {
        setRequestError(getErrorMessage(error));
      }
    } finally {
      setAccountSaving(false);
    }
  }

  async function saveSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedStaff) return;

    setScheduleSaving(true);
    setScheduleError("");
    try {
      await staffApi.saveSchedule(getRecordId(selectedStaff), schedule);
      setSuccessMessage(`Schedule saved for ${selectedStaff.fullName}.`);
      setSelectedStaff(null);
    } catch (error) {
      setScheduleError(getErrorMessage(error));
    } finally {
      setScheduleSaving(false);
    }
  }

  function updateDay(day: number, working: boolean) {
    const weeklyIntervals = schedule.weeklyIntervals.filter((item) => item.day !== day);
    const currentInterval = schedule.weeklyIntervals.find((item) => item.day === day);
    if (working) {
      weeklyIntervals.push(currentInterval ?? { day, from: "09:00", to: "17:00" });
    }
    setSchedule({
      ...schedule,
      weeklyIntervals,
      daysOff: schedule.daysOff.filter((item) => item !== day),
    });
  }

  function updateDayTime(day: number, field: "from" | "to", value: string) {
    setSchedule((current) => ({
      ...current,
      weeklyIntervals: current.weeklyIntervals.map((item) =>
        item.day === day ? { ...item, [field]: value } : item,
      ),
    }));
  }

  function toggleService(serviceId: string, checked: boolean) {
    const selected = checked
      ? [...schedule.services, serviceId]
      : schedule.services.filter((id) => id !== serviceId);
    setSchedule({ ...schedule, services: selected });
  }

  return (
    <>
      <AP_PageHeader
        title="Staff"
        description="Manage staff schedules and create staff or receptionist accounts."
        action={{ label: "Add employee", onClick: () => { setStaffFormOpen(true); setRequestError(""); setStaffErrors({}); } }}
      />
      <div className="screen-toolbar staff-toolbar">
        <span className="demo-label"><span className="live-dot" /> Staff accounts from backend</span>
        <span className="muted-text">{loading ? "Loading" : `${staff.length} staff members`}</span>
      </div>
      {requestError && <AP_Error message={requestError} onRetry={() => void loadStaff()} />}
      {successMessage && <AP_Success message={successMessage} />}
      {loading ? <AP_Loading label="Loading staff" /> : (
        <section className="staff-grid">
          {staff.map((member) => {
            const initials = member.fullName.split(/\s+/).map((part) => part[0] ?? "").join("").slice(0, 2).toUpperCase();
            return (
              <article className="panel staff-card" key={getRecordId(member)}>
                <div className="staff-profile">
                  <span className="avatar staff-avatar">{initials}</span>
                  <div className="staff-identity"><h2>{member.fullName}</h2><p>{member.email}</p></div>
                </div>
                <span className="staff-role">Staff member</span>
                <AP_Button className="full-width" onClick={() => void openSchedule(member)} variant="secondary">View and edit schedule</AP_Button>
              </article>
            );
          })}
          {staff.length === 0 && <p className="staff-empty">No staff accounts found. Add a staff account to get started.</p>}
        </section>
      )}

      <AP_Modal
        open={staffFormOpen}
        title={`Create ${employeeRole === "Receptionist" ? "receptionist" : "staff"} account`}
        body={
          <form id="staff-form" onSubmit={(event) => void createStaff(event)} noValidate>
            <AP_Select
              label="Account role"
              options={[
                { label: "Staff member", value: "Staff" },
                { label: "Receptionist", value: "Receptionist" },
              ]}
              value={employeeRole}
              onChange={(value) => {
                if (value === "Staff" || value === "Receptionist") setEmployeeRole(value);
              }}
              help={employeeRole === "Receptionist"
                ? "Receptionists can confirm appointments and check customers in."
                : "Staff accounts can manage their queue and assigned appointments."}
            />
            <AP_Textbox label="Full name" value={staffForm.fullName} error={staffErrors.fullName} onChange={(value) => setStaffForm({ ...staffForm, fullName: value })} />
            <AP_Textbox label="Email" type="email" value={staffForm.email} error={staffErrors.email} onChange={(value) => setStaffForm({ ...staffForm, email: value })} />
            <AP_Textbox label="Phone" type="tel" value={staffForm.phone} error={staffErrors.phone} onChange={(value) => setStaffForm({ ...staffForm, phone: value })} />
            <AP_Textbox label="Temporary password" type="password" value={staffForm.password} error={staffErrors.password} onChange={(value) => setStaffForm({ ...staffForm, password: value })} />
          </form>
        }
        onClose={() => setStaffFormOpen(false)}
        actions={
          <>
            <AP_Button onClick={() => setStaffFormOpen(false)} variant="secondary">Cancel</AP_Button>
            <AP_Button form="staff-form" loading={accountSaving} type="submit">Create account</AP_Button>
          </>
        }
      />

      <AP_Modal
        open={Boolean(selectedStaff)}
        title={`Schedule · ${selectedStaff?.fullName ?? ""}`}
        className="schedule-modal"
        body={scheduleLoading ? <AP_Loading label="Loading staff schedule" /> : scheduleError ? (
          <AP_Error message={scheduleError} onRetry={() => selectedStaff && void openSchedule(selectedStaff)} />
        ) : (
          <form id="schedule-form" className="schedule-form" onSubmit={(event) => void saveSchedule(event)}>
            <div className="schedule-section-heading">
              <div>
                <h3>Weekly availability</h3>
                <p>Turn on the days this staff member works, then set their hours.</p>
              </div>
              <span>Clinic time</span>
            </div>
            <div className="schedule-editor-header" aria-hidden="true">
              <span>Day</span><span>Working</span><span>Opens</span><span>Closes</span>
            </div>
            {weekdays.map((day, index) => {
              const interval = schedule.weeklyIntervals.find((item) => item.day === index);
              const working = Boolean(interval) && !schedule.daysOff.includes(index);
              return (
                <div className="schedule-editor-row" key={day}>
                  <strong>{day}</strong>
                  <label className="schedule-working-toggle">
                    <input checked={working} onChange={(event) => updateDay(index, event.target.checked)} type="checkbox" />
                    <span>{working ? "Working" : "Day off"}</span>
                  </label>
                  <input aria-label={`${day} opening time`} disabled={!working} onChange={(event) => updateDayTime(index, "from", event.target.value)} type="time" value={interval?.from ?? "09:00"} />
                  <input aria-label={`${day} closing time`} disabled={!working} onChange={(event) => updateDayTime(index, "to", event.target.value)} type="time" value={interval?.to ?? "17:00"} />
                </div>
              );
            })}
            <div className="schedule-section-heading schedule-services-heading">
              <div>
                <h3>Services</h3>
                <p>Select the services this staff member can provide.</p>
              </div>
            </div>
            <div className="schedule-service-list">
              {services.map((service) => (
                <label key={service._id}>
                  <input checked={schedule.services.includes(service._id)} onChange={(event) => toggleService(service._id, event.target.checked)} type="checkbox" />
                  {service.name}
                </label>
              ))}
              {services.length === 0 && <p>No services are available yet.</p>}
            </div>
          </form>
        )}
        onClose={() => setSelectedStaff(null)}
        actions={
          <>
            <AP_Button onClick={() => setSelectedStaff(null)} variant="secondary">Cancel</AP_Button>
            <AP_Button disabled={scheduleLoading || Boolean(scheduleError)} form="schedule-form" loading={scheduleSaving} type="submit">Save schedule</AP_Button>
          </>
        }
      />
    </>
  );
}
