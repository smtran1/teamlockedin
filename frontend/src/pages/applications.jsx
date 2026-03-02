import { useState } from "react";
import lockedInLogo from "../assets/lockedindark.png";
import "../styles/dashboard.css";
import "../styles/applications.css";

const INITIAL_FORM = {
  id: null,
  jobTitle: "",
  company: "",
  location: "",
  positionType: "full_time",
  postingDate: "",
  closingDate: "",
  salary: "",
  salaryType: "yearly",
  status: "applied",
  jobUrl: "",
  jobDescription: "",
  notes: "",
};

function formatPosition(positionType) {
  const map = {
    full_time: "Full-time",
    part_time: "Part-time",
    contractor: "Contractor",
    internship: "Internship",
  };
  return map[positionType] || positionType;
}

function formatMoney(amount, salaryType) {
  if (!amount) return "Not provided";
  const value = Number(amount);
  if (Number.isNaN(value)) return "Not provided";
  return salaryType === "hourly" ? `$${value}/hr` : `$${value.toLocaleString()}/yr`;
}

function toTitleCase(value) {
  return String(value)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function Applications({ onLogout, onNavigate }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState("");
  const [applications, setApplications] = useState([]);
  const [editingId, setEditingId] = useState(null);

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function validateForm() {
    if (!form.jobTitle.trim()) return "Job title is required.";
    if (!form.status) return "Application status is required.";
    if (!form.company.trim()) return "Company is required.";
    if (!form.location.trim()) return "Location is required.";
    if (!form.positionType) return "Position type is required.";

    if (form.jobUrl.trim()) {
      try {
        // Throws if URL is invalid.
        new URL(form.jobUrl.trim());
      } catch {
        return "Job URL must be a valid link.";
      }
    }

    if (form.postingDate && form.closingDate && form.closingDate < form.postingDate) {
      return "Closing date cannot be earlier than posting date.";
    }

    if (form.salary && Number.isNaN(Number(form.salary))) {
      return "Salary must be numeric.";
    }

    return "";
  }

  function handleSubmit(event) {
    event.preventDefault();
    const validationMessage = validateForm();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    const recordId = editingId ?? Math.max(0, ...applications.map((item) => item.id)) + 1;
    const record = {
      ...form,
      id: recordId,
      jobTitle: form.jobTitle.trim(),
      company: form.company.trim(),
      location: form.location.trim(),
      jobUrl: form.jobUrl.trim(),
      jobDescription: form.jobDescription.trim(),
      notes: form.notes.trim(),
      salary: form.salary ? Number(form.salary) : "",
      createdAt: new Date().toISOString(),
    };

    if (editingId == null) {
      setApplications((prev) => [record, ...prev]);
    } else {
      setApplications((prev) => prev.map((entry) => (entry.id === editingId ? record : entry)));
    }
    setForm(INITIAL_FORM);
    setEditingId(null);
    setError("");
  }

  function clearForm() {
    setForm(INITIAL_FORM);
    setEditingId(null);
    setError("");
  }

  function editApplication(application) {
    setForm({
      id: application.id,
      jobTitle: application.jobTitle ?? "",
      company: application.company ?? "",
      location: application.location ?? "",
      positionType: application.positionType ?? "full_time",
      postingDate: application.postingDate ?? "",
      closingDate: application.closingDate ?? "",
      salary: application.salary === "" ? "" : String(application.salary ?? ""),
      salaryType: application.salaryType ?? "yearly",
      status: application.status ?? "applied",
      jobUrl: application.jobUrl ?? "",
      jobDescription: application.jobDescription ?? "",
      notes: application.notes ?? "",
    });
    setEditingId(application.id);
    setError("");
  }

  function removeApplication(id) {
    setApplications((prev) => prev.filter((entry) => entry.id !== id));
  }

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
            <button className="danger-btn danger-btn--logout" type="button" onClick={onLogout}>
              Log Out
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard applications-page" aria-label="Applications">
        <section className="application-entry-card" aria-label="Application entry form">
          <div className="entry-head">
            <h1 className="entry-title">{editingId == null ? "New Job Application" : "Edit Job Application"}</h1>
            <p className="entry-subtitle">
              Capture core details first, then add optional information whenever you are ready.
            </p>
          </div>

          <form className="app-submit-form" onSubmit={handleSubmit}>
            {error ? <div className="form-error">{error}</div> : null}

            <div className="app-submit-grid">
              <label className="form-field">
                <span className="form-label">Job Title</span>
                <input
                  value={form.jobTitle}
                  onChange={(event) => updateField("jobTitle", event.target.value)}
                  placeholder="e.g., Software Engineer Intern"
                />
              </label>

              <label className="form-field">
                <span className="form-label">Company</span>
                <input
                  value={form.company}
                  onChange={(event) => updateField("company", event.target.value)}
                  placeholder="e.g., Google"
                />
              </label>

              <label className="form-field">
                <span className="form-label">Location</span>
                <input
                  value={form.location}
                  onChange={(event) => updateField("location", event.target.value)}
                  placeholder="e.g., Remote / Seattle, WA"
                />
              </label>

              <label className="form-field">
                <span className="form-label">Position Type</span>
                <select
                  value={form.positionType}
                  onChange={(event) => updateField("positionType", event.target.value)}
                >
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                  <option value="contractor">Contractor</option>
                  <option value="internship">Internship</option>
                </select>
              </label>

              <label className="form-field">
                <span className="form-label">Posting Date</span>
                <input
                  type="date"
                  value={form.postingDate}
                  onChange={(event) => updateField("postingDate", event.target.value)}
                />
              </label>

              <label className="form-field">
                <span className="form-label">Closing Date</span>
                <input
                  type="date"
                  value={form.closingDate}
                  onChange={(event) => updateField("closingDate", event.target.value)}
                />
              </label>

              <label className="form-field">
                <span className="form-label">Status</span>
                <select value={form.status} onChange={(event) => updateField("status", event.target.value)}>
                  <option value="applied">Applied</option>
                  <option value="interviewing">Interviewing</option>
                  <option value="offer">Offer</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>

              <label className="form-field form-field--salary">
                <span className="form-label">Salary</span>
                <div className="salary-row">
                  <input
                    value={form.salary}
                    onChange={(event) => updateField("salary", event.target.value)}
                    placeholder="Optional"
                    inputMode="numeric"
                  />
                  <select
                    value={form.salaryType}
                    onChange={(event) => updateField("salaryType", event.target.value)}
                    aria-label="Salary type"
                  >
                    <option value="yearly">/yr</option>
                    <option value="hourly">/hr</option>
                  </select>
                </div>
              </label>

              <label className="form-field form-field--full">
                <span className="form-label">Job URL</span>
                <input
                  type="url"
                  value={form.jobUrl}
                  onChange={(event) => updateField("jobUrl", event.target.value)}
                  placeholder="https://company.com/careers/job-123"
                />
              </label>

              <label className="form-field form-field--full">
                <span className="form-label">Job Description</span>
                <textarea
                  rows={5}
                  value={form.jobDescription}
                  onChange={(event) => updateField("jobDescription", event.target.value)}
                  placeholder="Paste or summarize the role responsibilities and requirements..."
                />
              </label>

              <label className="form-field form-field--full">
                <span className="form-label">Notes</span>
                <textarea
                  rows={3}
                  value={form.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  placeholder="Optional: recruiter contact, prep notes, follow-up reminders..."
                />
              </label>
            </div>

            <div className="submit-actions">
              <button className="ghost-btn" type="button" onClick={clearForm}>
                {editingId == null ? "Clear Form" : "Cancel Edit"}
              </button>
              <button className="primary-btn" type="submit">
                {editingId == null ? "Save Application" : "Update Application"}
              </button>
            </div>
          </form>
        </section>

        <section className="application-log-card" aria-label="Saved applications">
          <div className="entry-head">
            <h2 className="entry-title entry-title--small">Saved Applications</h2>
            <p className="entry-subtitle">{applications.length} saved</p>
          </div>

          {!applications.length ? (
            <div className="log-empty">No applications saved yet.</div>
          ) : (
            <div className="log-list">
              {applications.map((application) => (
                <article className="log-item" key={application.id}>
                  <div className="log-item-head">
                    <div>
                      <h3 className="log-title">{application.jobTitle}</h3>
                      <p className="log-company">
                        {application.company} • {application.location}
                      </p>
                    </div>
                    <span className={`status-pill status-${application.status}`}>{toTitleCase(application.status)}</span>
                  </div>

                  <div className="log-meta-grid">
                    <div>Position: {formatPosition(application.positionType)}</div>
                    <div>Salary: {formatMoney(application.salary, application.salaryType)}</div>
                    <div>Posting: {application.postingDate || "Not provided"}</div>
                    <div>Closing: {application.closingDate}</div>
                  </div>

                  <p className="log-description">{application.jobDescription}</p>

                  <div className="log-footer">
                    {application.jobUrl ? (
                      <a href={application.jobUrl} target="_blank" rel="noreferrer" className="ghost-btn log-link">
                        Open Job Link
                      </a>
                    ) : null}
                    <button className="ghost-btn" type="button" onClick={() => editApplication(application)}>
                      Edit
                    </button>
                    <button className="danger-btn" type="button" onClick={() => removeApplication(application.id)}>
                      Delete
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
