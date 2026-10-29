import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import * as yup from "yup";
import { AP_Button } from "../components/AP_Button";
import { AP_Error } from "../components/AP_Error";
import { AP_Modal } from "../components/AP_Modal";
import { AP_PageHeader } from "../components/AP_PageHeader";
import { AP_StatusPill } from "../components/AP_StatusPill";
import { AP_Success } from "../components/AP_Success";
import { AP_Table } from "../components/AP_Table";
import { AP_Textbox } from "../components/AP_Textbox";
import { getErrorMessage, servicesApi } from "../shared/api";
import type { ApiService, ServiceFields } from "../shared/types";
import { serviceSchema } from "../shared/validation";
import "./Services.css";

type ServiceForm = {
  name: string;
  description: string;
  durationMinutes: string;
  price: string;
};

const emptyForm: ServiceForm = { name: "", description: "", durationMinutes: "", price: "" };

export function Services() {
  const [services, setServices] = useState<ApiService[]>([]);
  const [showInactive, setShowInactive] = useState(false);
  const [serviceToDeactivate, setServiceToDeactivate] = useState<ApiService | null>(null);
  const [editingService, setEditingService] = useState<ApiService | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [requestError, setRequestError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadServices = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setServices(await servicesApi.list(true));
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  const visibleServices = useMemo(
    () => services.filter((service) => showInactive || service.active),
    [services, showInactive],
  );

  function openCreateForm() {
    setFormOpen(true);
    setEditingService(null);
    setForm(emptyForm);
    setErrors({});
    setRequestError("");
    setSuccessMessage("");
  }

  function openEditForm(service: ApiService) {
    setFormOpen(true);
    setEditingService(service);
    setForm({
      name: service.name,
      description: service.description,
      durationMinutes: String(service.durationMinutes),
      price: String(service.price),
    });
    setErrors({});
    setRequestError("");
    setSuccessMessage("");
  }

  async function saveService(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setRequestError("");

    try {
      const validated = await serviceSchema.validate({
        ...form,
        durationMinutes: Number(form.durationMinutes),
        price: Number(form.price),
      }, { abortEarly: false });
      const payload: ServiceFields = {
        name: validated.name,
        description: validated.description ?? "",
        durationMinutes: validated.durationMinutes,
        price: validated.price,
      };
      setSaving(true);
      if (editingService) {
        await servicesApi.update(editingService._id, payload);
      } else {
        await servicesApi.create(payload);
      }
      setSuccessMessage(editingService ? "Service updated." : "Service created.");
      setFormOpen(false);
      setEditingService(null);
      setForm(emptyForm);
      await loadServices();
    } catch (error) {
      if (error instanceof yup.ValidationError) {
        const nextErrors: Record<string, string> = {};
        error.inner.forEach((issue) => {
          if (issue.path) nextErrors[issue.path] = issue.message;
        });
        setErrors(nextErrors);
      } else {
        setRequestError(getErrorMessage(error));
      }
    } finally {
      setSaving(false);
    }
  }

  async function changeServiceStatus() {
    if (!serviceToDeactivate) return;

    setSaving(true);
    setRequestError("");
    try {
      await servicesApi.setActive(serviceToDeactivate._id, false);
      setSuccessMessage(`${serviceToDeactivate.name} deactivated.`);
      setServiceToDeactivate(null);
      await loadServices();
    } catch (error) {
      setRequestError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  async function activateService(service: ApiService) {
    setSaving(true);
    setRequestError("");
    try {
      await servicesApi.setActive(service._id, true);
      setSuccessMessage(`${service.name} activated.`);
      await loadServices();
    } catch (error) {
      setRequestError(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AP_PageHeader
        title="Services"
        description="Manage the services customers can book."
        action={{ label: "New service", onClick: openCreateForm }}
      />
      <div className="screen-toolbar services-toolbar">
        <span className="demo-label"><span className="live-dot" /> Backend services</span>
        <label className="checkbox-label">
          <input checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} type="checkbox" />
          Show inactive
        </label>
      </div>
      {requestError && <AP_Error message={requestError} onRetry={() => setRequestError("")} />}
      {successMessage && <AP_Success message={successMessage} />}
      <section className="panel services-table-panel">
        <AP_Table
          columns={[
            { label: "Service name", render: (service) => <span className="strong-cell">{service.name}</span>, sortValue: (service) => service.name },
            { label: "Duration", render: (service) => `${service.durationMinutes} min`, sortValue: (service) => service.durationMinutes },
            { label: "Price", render: (service) => `$${service.price.toFixed(2)}`, sortValue: (service) => service.price },
            { label: "Status", render: (service) => <AP_StatusPill status={service.active ? "Active" : "Inactive"} /> },
            {
              label: "Action",
              render: (service) => (
                <div className="service-actions">
                  <AP_Button onClick={() => openEditForm(service)} size="small" variant="secondary">Edit</AP_Button>
                  {service.active
                    ? <AP_Button onClick={() => setServiceToDeactivate(service)} size="small" variant="danger">Deactivate</AP_Button>
                    : <AP_Button loading={saving} onClick={() => void activateService(service)} size="small" variant="secondary">Activate</AP_Button>}
                </div>
              ),
            },
          ]}
          rows={visibleServices}
          rowKey={(service) => service._id}
          loading={loading}
          error={loadError || undefined}
          onRetry={() => void loadServices()}
          emptyMessage="No active services are available."
          emptyActionLabel={showInactive ? undefined : "Show inactive"}
          onEmptyAction={() => setShowInactive(true)}
        />
      </section>

      <AP_Modal
        open={formOpen}
        title={editingService ? "Edit service" : "New service"}
        body={
          <form id="service-form" onSubmit={(event) => void saveService(event)} noValidate>
            <AP_Textbox label="Name" value={form.name} error={errors.name} onChange={(value) => setForm({ ...form, name: value })} />
            <AP_Textbox label="Description" value={form.description} error={errors.description} onChange={(value) => setForm({ ...form, description: value })} />
            <AP_Textbox label="Duration in minutes" type="number" value={form.durationMinutes} error={errors.durationMinutes} onChange={(value) => setForm({ ...form, durationMinutes: value })} />
            <AP_Textbox label="Price" type="number" value={form.price} error={errors.price} onChange={(value) => setForm({ ...form, price: value })} />
          </form>
        }
        onClose={() => { setFormOpen(false); setEditingService(null); }}
        actions={
          <>
            <AP_Button onClick={() => { setFormOpen(false); setEditingService(null); }} variant="secondary">Cancel</AP_Button>
            <AP_Button form="service-form" loading={saving} type="submit">Save service</AP_Button>
          </>
        }
      />
      <AP_Modal
        open={Boolean(serviceToDeactivate)}
        title="Deactivate this service?"
        body={<p>{serviceToDeactivate?.name} will be hidden from new bookings. Past appointments will keep it.</p>}
        onClose={() => setServiceToDeactivate(null)}
        actions={
          <>
            <AP_Button onClick={() => setServiceToDeactivate(null)} variant="secondary">Keep active</AP_Button>
            <AP_Button loading={saving} onClick={() => void changeServiceStatus()} variant="danger">Deactivate</AP_Button>
          </>
        }
      />
    </>
  );
}
