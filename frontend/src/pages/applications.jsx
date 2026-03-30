import { useEffect, useState } from "react";
import lockedInLogo from "../assets/lockedindark.png";
import "../styles/dashboard.css";
import "../styles/applications.css";

const INITIAL_FORM = {
  job_title: "",
  company: "",
  job_location: "",
  position_type: "Full-time",
  posting_date: "",
  closing_date: "",
  job_status: "applied",
  job_salary: "",
  salary_hourly: false,
  job_url: "",
  job_description: "",
  application_notes: "",
};

function formatPosition(positionType) {
  const map = {
    "Full-time": "Full-time",
    "Part-time": "Part-time",
    Contractor: "Contractor",
    Internship: "Internship",
    full_time: "Full-time",
    part_time: "Part-time",
    contractor: "Contractor",
    internship: "Internship",
  };
  return map[positionType] || positionType;
}

function formatMoney(amount, salaryHourly) {
  if (amount === null || amount === undefined || amount === "") return "Not provided";
  const value = Number(amount);
  if (Number.isNaN(value)) return "Not provided";
  return salaryHourly ? `$${value}/hr` : `$${value.toLocaleString()}/yr`;
}

function toTitleCase(value) {
  return String(value ?? "")
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizePositionType(value) {
  const normalized = String(value ?? "").trim();

  if (normalized === "full_time" || normalized === "full-time") return "Full-time";
  if (normalized === "part_time" || normalized === "part-time") return "Part-time";
  if (normalized.toLowerCase() === "contractor") return "Contractor";
  if (normalized.toLowerCase() === "internship") return "Internship";

  return normalized || "Full-time";
}

function buildPayload(form, userEmail) {
  return {
    email: userEmail,
    job_title: form.job_title.trim(),
    company: form.company.trim(),
    job_location: form.job_location.trim(),
    position_type: form.position_type,
    posting_date: form.posting_date,
    closing_date: form.closing_date,
    job_status: form.job_status,
    job_salary: form.job_salary.trim(),
    salary_hourly: form.salary_hourly,
    job_url: form.job_url.trim(),
    job_description: form.job_description.trim(),
    application_notes: form.application_notes.trim(),
  };
}

function validateForm(form) {
  const nextErrors = {};

  if (!form.job_title.trim()) nextErrors.job_title = "Job title is required.";
  if (!form.company.trim()) nextErrors.company = "Company is required.";
  if (!form.job_location.trim()) nextErrors.job_location = "Location is required.";
  if (!form.position_type) nextErrors.position_type = "Position type is required.";
  if (!form.job_status) nextErrors.job_status = "Job status is required.";

  if (form.job_url.trim()) {
    try {
      new URL(form.job_url.trim());
    } catch {
      nextErrors.job_url = "Job URL must be a valid link.";
    }
  }

  if (form.job_salary.trim() && Number.isNaN(Number(form.job_salary.trim()))) {
    nextErrors.job_salary = "Salary must be numeric.";
  }

  if (form.posting_date && Number.isNaN(Date.parse(form.posting_date))) {
    nextErrors.posting_date = "Posting date must be valid.";
  }

  if (form.closing_date && Number.isNaN(Date.parse(form.closing_date))) {
    nextErrors.closing_date = "Closing date must be valid.";
  }

  if (form.posting_date && form.closing_date && form.closing_date < form.posting_date) {
    nextErrors.closing_date = "Closing date cannot be earlier than posting date.";
  }

  return nextErrors;
}

function FieldError({ message }) {
  if (!message) return null;
  return <span className="field-error">{message}</span>;
}

export default function Applications({
  applications,
  applicationsError,
  hasLoadedApplications,
  applicationsStatus,
  initialEditingId,
  onCreateApplication,
  onDeleteApplication,
  onLogout,
  onNavigate,
  onUpdateApplication,
  userEmail,
}) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    if (!applications.length && applicationsStatus !== "ready") {
      setIsFormOpen(true);
    }
  }, [applications.length, applicationsStatus]);

  useEffect(() => {
    if (!initialEditingId) {
      return;
    }

    const applicationToEdit = applications.find(
      (application) => application.application_id === initialEditingId,
    );

    if (applicationToEdit) {
      editApplication(applicationToEdit);
    }
  }, [applications, initialEditingId]);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      return { ...prev, [key]: "" };
    });
    setSubmitError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validateForm(form);
    setErrors(nextErrors);
    setSubmitError("");

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = buildPayload(form, userEmail);

      if (editingId == null) {
        await onCreateApplication?.(payload);
      } else {
        await onUpdateApplication?.(editingId, payload);
      }

      setForm(INITIAL_FORM);
      setErrors({});
      setEditingId(null);
      setIsFormOpen(false);
    } catch (error) {
      setSubmitError(error?.message || "Unable to save application.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function openNewForm() {
    setForm(INITIAL_FORM);
    setErrors({});
    setSubmitError("");
    setEditingId(null);
    setIsFormOpen(true);
  }

  function clearForm() {
    if (editingId == null) {
      setForm(INITIAL_FORM);
      setErrors({});
      setSubmitError("");
      return;
    }

    openNewForm();
  }

  function editApplication(application) {
    setForm({
      job_title: application.job_title ?? "",
      company: application.company ?? "",
      job_location: application.job_location ?? "",
      position_type: normalizePositionType(application.position_type),
      posting_date: application.posting_date ? String(application.posting_date).slice(0, 10) : "",
      closing_date: application.closing_date ? String(application.closing_date).slice(0, 10) : "",
      job_status: application.job_status ?? "applied",
      job_salary:
        application.job_salary === null || application.job_salary === undefined
          ? ""
          : String(application.job_salary),
      salary_hourly: Boolean(application.salary_hourly),
      job_url: application.job_url ?? "",
      job_description: application.job_description ?? "",
      application_notes: application.application_notes ?? "",
    });
    setEditingId(application.application_id);
    setErrors({});
    setSubmitError("");
    setIsFormOpen(true);
  }

  async function removeApplication(applicationId) {
    setDeletingId(applicationId);
    setSubmitError("");

    try {
      await onDeleteApplication?.(applicationId);
      if (editingId === applicationId) {
        openNewForm();
      }
    } catch (error) {
      setSubmitError(error?.message || "Unable to delete application.");
    } finally {
      setDeletingId(null);
    }
  }

  const isLoading = applicationsStatus === "loading";
  const hasLoadError =
    hasLoadedApplications && applicationsStatus === "error" && Boolean(applicationsError);

  return (
    <>
      <header className="top-nav">
        <div className="top-nav-inner">
          <div className="brand">
            <img className="brand-logo" src={lockedInLogo} alt="LockedIn" />
          </div>

          <nav className="nav-links" aria-label="Primary">
            <button className="nav-link" type="button" onClick={() => onNavigate?.("dashboard")}>
              Dashboard
            </button>
            <button className="nav-link is-active" type="button" onClick={() => onNavigate?.("applications")}>
              Applications
            </button>
            <button className="nav-link" type="button" onClick={() => onNavigate?.("reminders")}>
              Reminders
            </button>
            <button className="nav-link" type="button" onClick={() => onNavigate?.("contacts")}>
              Contacts
            </button>
            <button className="nav-link" type="button" onClick={() => onNavigate?.("documents")}>
              Documents
            </button>
          </nav>

          <div className="nav-actions" aria-label="Utilities">
            <button className="icon-btn" style={{ lineHeight: 0 }} type="button" aria-label="Notifications" onClick={() => onNavigate?.("reminders")}>
              <svg style={{ display: "block" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            </button>
            <button className="icon-btn" style={{ lineHeight: 0 }} type="button" aria-label="Settings">
              <svg style={{ display: "block" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06A1.65 1.65 0 0015 19.4a1.65 1.65 0 00-1 .6 1.65 1.65 0 00-.33 1.82V22a2 2 0 11-4 0v-.18a1.65 1.65 0 00-.33-1.82 1.65 1.65 0 00-1-.6 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-.6-1 1.65 1.65 0 00-1.82-.33H2a2 2 0 110-4h.18a1.65 1.65 0 001.82-.33 1.65 1.65 0 00.6-1 1.65 1.65 0 00-.33-1.82l-.06-.06A2 2 0 116.04 3.6l.06.06A1.65 1.65 0 008 4.6c.39 0 .77-.14 1.06-.4.29-.26.5-.62.57-1.01V3a2 2 0 114 0v.18c.07.39.28.75.57 1.01.29.26.67.4 1.06.4.39 0 .77-.14 1.06-.4l.06-.06A2 2 0 1120.4 6.04l-.06.06c-.26.29-.4.67-.4 1.06 0 .39.14.77.4 1.06.26.29.62.5 1.01.57H22a2 2 0 110 4h-.18c-.39.07-.75.28-1.01.57-.26.29-.4.67-.4 1.06z" />
              </svg>
            </button>
            <button className="icon-btn" style={{ lineHeight: 0 }} type="button" aria-label="Profile">
              <svg style={{ display: "block" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
            <button className="danger-btn danger-btn--logout" type="button" onClick={onLogout}>
              Log Out
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard applications-page" aria-label="Applications">
        <section className="application-entry-card" aria-label="Application entry form">
          <div className="entry-head entry-head--split">
            <div>
              <h1 className="entry-title">{editingId == null ? "New Job Application" : "Edit Job Application"}</h1>
              <p className="entry-subtitle">
                Capture core details first, then add optional information whenever you are ready.
              </p>
            </div>

            {!isFormOpen ? (
              <button className="primary-btn" type="button" onClick={openNewForm}>
                + Add Job
              </button>
            ) : null}
          </div>

          {submitError ? <div className="form-error">{submitError}</div> : null}
          {hasLoadError ? <div className="form-error">{applicationsError}</div> : null}

          {isFormOpen ? (
            <form className="app-submit-form" onSubmit={handleSubmit}>
              <div className="app-submit-grid">
                <label className="form-field">
                  <span className="form-label">Job Title</span>
                  <input
                    value={form.job_title}
                    onChange={(event) => updateField("job_title", event.target.value)}
                    placeholder="e.g., Software Engineer Intern"
                    aria-invalid={Boolean(errors.job_title)}
                  />
                  <FieldError message={errors.job_title} />
                </label>

                <label className="form-field">
                  <span className="form-label">Company</span>
                  <input
                    value={form.company}
                    onChange={(event) => updateField("company", event.target.value)}
                    placeholder="e.g., Google"
                    aria-invalid={Boolean(errors.company)}
                  />
                  <FieldError message={errors.company} />
                </label>

                <label className="form-field">
                  <span className="form-label">Location</span>
                  <input
                    value={form.job_location}
                    onChange={(event) => updateField("job_location", event.target.value)}
                    placeholder="e.g., Remote / Seattle, WA"
                    aria-invalid={Boolean(errors.job_location)}
                  />
                  <FieldError message={errors.job_location} />
                </label>

                <label className="form-field">
                  <span className="form-label">Position Type</span>
                  <select
                    value={form.position_type}
                    onChange={(event) => updateField("position_type", event.target.value)}
                    aria-invalid={Boolean(errors.position_type)}
                  >
                    <option value="Full-time">Full-time</option>
                    <option value="Part-time">Part-time</option>
                    <option value="Contractor">Contractor</option>
                    <option value="Internship">Internship</option>
                  </select>
                  <FieldError message={errors.position_type} />
                </label>

                <label className="form-field">
                  <span className="form-label">Posting Date</span>
                  <input
                    type="date"
                    value={form.posting_date}
                    onChange={(event) => updateField("posting_date", event.target.value)}
                    aria-invalid={Boolean(errors.posting_date)}
                  />
                  <FieldError message={errors.posting_date} />
                </label>

                <label className="form-field">
                  <span className="form-label">Closing Date</span>
                  <input
                    type="date"
                    value={form.closing_date}
                    onChange={(event) => updateField("closing_date", event.target.value)}
                    aria-invalid={Boolean(errors.closing_date)}
                  />
                  <FieldError message={errors.closing_date} />
                </label>

                <label className="form-field">
                  <span className="form-label">Status</span>
                  <select
                    value={form.job_status}
                    onChange={(event) => updateField("job_status", event.target.value)}
                    aria-invalid={Boolean(errors.job_status)}
                  >
                    <option value="saved">Saved</option>
                    <option value="applied">Applied</option>
                    <option value="interviewing">Interviewing</option>
                    <option value="offer">Offer</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <FieldError message={errors.job_status} />
                </label>

                <label className="form-field form-field--salary">
                  <span className="form-label">Salary</span>
                  <div className="salary-row salary-row--checkbox">
                    <input
                      value={form.job_salary}
                      onChange={(event) => updateField("job_salary", event.target.value)}
                      placeholder="Optional"
                      inputMode="decimal"
                      aria-invalid={Boolean(errors.job_salary)}
                    />
                    <label className="checkbox-field">
                      <input
                        type="checkbox"
                        checked={form.salary_hourly}
                        onChange={(event) => updateField("salary_hourly", event.target.checked)}
                      />
                      Hourly
                    </label>
                  </div>
                  <FieldError message={errors.job_salary} />
                </label>

                <label className="form-field form-field--full">
                  <span className="form-label">Job URL</span>
                  <input
                    type="url"
                    value={form.job_url}
                    onChange={(event) => updateField("job_url", event.target.value)}
                    placeholder="https://company.com/careers/job-123"
                    aria-invalid={Boolean(errors.job_url)}
                  />
                  <FieldError message={errors.job_url} />
                </label>

                <label className="form-field form-field--full">
                  <span className="form-label">Job Description</span>
                  <textarea
                    rows={5}
                    value={form.job_description}
                    onChange={(event) => updateField("job_description", event.target.value)}
                    placeholder="Paste or summarize the role responsibilities and requirements..."
                  />
                </label>

                <label className="form-field form-field--full">
                  <span className="form-label">Notes</span>
                  <textarea
                    rows={3}
                    value={form.application_notes}
                    onChange={(event) => updateField("application_notes", event.target.value)}
                    placeholder="Optional: recruiter contact, prep notes, follow-up reminders..."
                  />
                </label>
              </div>

              <div className="submit-actions">
                <button className="ghost-btn" type="button" onClick={clearForm}>
                  {editingId == null ? "Clear Form" : "Cancel Edit"}
                </button>
                <button className="primary-btn" type="submit" disabled={isSubmitting || !userEmail}>
                  {isSubmitting
                    ? "Saving..."
                    : editingId == null
                      ? "Save Application"
                      : "Update Application"}
                </button>
              </div>
            </form>
          ) : (
            <div className="form-collapsed-note">
              Your application was saved. Use the list below to review or edit it.
            </div>
          )}
        </section>

        <section className="application-log-card" aria-label="Saved applications">
          <div className="entry-head entry-head--split">
            <div>
              <h2 className="entry-title entry-title--small">Saved Applications</h2>
              <p className="entry-subtitle">{applications.length} saved</p>
            </div>

            <button className="ghost-btn" type="button" onClick={openNewForm}>
              Add Another
            </button>
          </div>

          {isLoading ? (
            <div className="log-empty">Loading applications...</div>
          ) : !applications.length ? (
            <div className="log-empty">No applications saved yet.</div>
          ) : (
            <div className="log-list">
              {applications.map((application) => (
                <article className="log-item" key={application.application_id}>
                  <div className="log-item-head">
                    <div>
                      <h3 className="log-title">{application.job_title}</h3>
                      <p className="log-company">
                        {application.company} • {application.job_location}
                      </p>
                    </div>
                    <span className={`status-pill status-${application.job_status}`}>
                      {toTitleCase(application.job_status)}
                    </span>
                  </div>

                  <div className="log-meta-grid">
                    <div>Position: {formatPosition(application.position_type)}</div>
                    <div>Salary: {formatMoney(application.job_salary, application.salary_hourly)}</div>
                    <div>Posting: {application.posting_date ? String(application.posting_date).slice(0, 10) : "Not provided"}</div>
                    <div>Closing: {application.closing_date ? String(application.closing_date).slice(0, 10) : "Not provided"}</div>
                  </div>

                  <p className="log-description">{application.job_description || "No description saved."}</p>

                  <div className="log-footer">
                    {application.job_url ? (
                      <a href={application.job_url} target="_blank" rel="noreferrer" className="ghost-btn log-link">
                        Open Job Link
                      </a>
                    ) : null}
                    <button className="ghost-btn" type="button" onClick={() => editApplication(application)}>
                      Edit
                    </button>
                    <button
                      className="danger-btn"
                      type="button"
                      disabled={deletingId === application.application_id}
                      onClick={() => removeApplication(application.application_id)}
                    >
                      {deletingId === application.application_id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
