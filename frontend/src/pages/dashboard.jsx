import { useEffect, useMemo, useState } from "react";
import lockedInLogo from "../assets/lockedindark.png";

const SEED_REMINDERS = [
  { id: 1, date: "Feb 26", text: "Follow-up Call", applicationId: 2 },
  { id: 2, date: "Feb 28", text: "Interview Prep", applicationId: 1 },
  { id: 3, date: "Mar 1", text: "Application Deadline", applicationId: 5 },
];

const STATUS_OPTIONS = ["saved", "applied", "interviewing", "offer", "rejected"];

function normalize(value) {
  return String(value ?? "").toLowerCase().trim();
}

function toTitleCase(value) {
  return String(value ?? "")
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatCardDate(value) {
  if (!value) return "Date not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDetailDate(value) {
  return value ? formatCardDate(value) : "Not provided";
}

function formatSalary(application) {
  if (application.job_salary === null || application.job_salary === undefined || application.job_salary === "") {
    return "Not provided";
  }

  const value = Number(application.job_salary);
  if (Number.isNaN(value)) return "Not provided";

  return application.salary_hourly ? `$${value}/hr` : `$${value.toLocaleString()}/yr`;
}

function buildApplicationSummary(application) {
  if (application.closing_date) {
    return `Closes: ${formatCardDate(application.closing_date)}`;
  }

  if (application.posting_date) {
    return `Posted: ${formatCardDate(application.posting_date)}`;
  }

  return "Dates not provided";
}

function buildApplicationDetail(application) {
  if (application.job_salary) {
    return application.salary_hourly
      ? `Compensation: $${Number(application.job_salary)}/hr`
      : `Compensation: $${Number(application.job_salary).toLocaleString()}/yr`;
  }

  if (application.job_url) {
    return "Job link saved";
  }

  return "No salary or link added";
}

function buildUpdatePayload(application, jobStatus) {
  return {
    job_title: application.job_title ?? "",
    company: application.company ?? "",
    job_location: application.job_location ?? "",
    position_type: application.position_type ?? "",
    posting_date: application.posting_date ? String(application.posting_date).slice(0, 10) : "",
    closing_date: application.closing_date ? String(application.closing_date).slice(0, 10) : "",
    job_status: jobStatus,
    job_salary:
      application.job_salary === null || application.job_salary === undefined
        ? ""
        : String(application.job_salary),
    salary_hourly: Boolean(application.salary_hourly),
    job_url: application.job_url ?? "",
    job_description: application.job_description ?? "",
    application_notes: application.application_notes ?? "",
  };
}

function StatusPill({ status, onClick }) {
  const normalized = normalize(status).replace(/\s+/g, "-");
  return (
    <button
      className={`status-pill status-${normalized} status-pill-button`}
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
    >
      {toTitleCase(status)}
    </button>
  );
}

function ApplicationCard({ app, deletingId, onDelete, onOpenDetails, onOpenStatusEditor, onEdit }) {
  const isDeleting = deletingId === app.application_id;

  return (
    <article
      className="app-card"
      tabIndex={0}
      role="button"
      aria-label={`Open ${app.job_title} at ${app.company}`}
      onClick={() => onOpenDetails(app)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpenDetails(app);
      }}
    >
      <div className="app-card-header">
        <h3 className="app-title">{app.job_title}</h3>
        <StatusPill status={app.job_status} onClick={() => onOpenStatusEditor(app)} />
      </div>

      <div className="app-meta">
        {app.company} • {app.job_location}
      </div>

      <div className="app-line">{buildApplicationSummary(app)}</div>
      <div className="app-line">{buildApplicationDetail(app)}</div>

      <div className="app-actions" onClick={(event) => event.stopPropagation()}>
        <button className="ghost-btn" type="button" onClick={() => onOpenDetails(app)}>
          View
        </button>
        <button className="ghost-btn" type="button" onClick={onEdit}>
          Edit
        </button>
        <button className="danger-btn" type="button" disabled={isDeleting} onClick={() => onDelete(app.application_id)}>
          {isDeleting ? "Deleting..." : "Delete"}
        </button>
      </div>
    </article>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="dashboard-detail-row">
      <span className="dashboard-detail-label">{label}</span>
      <span className="dashboard-detail-value">{value || "Not provided"}</span>
    </div>
  );
}

function ApplicationDetailModal({
  application,
  error,
  isSaving,
  isStatusFocused,
  onClose,
  onSave,
  statusValue,
  onStatusChange,
}) {
  if (!application) return null;

  return (
    <div
      className="dashboard-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Application details for ${application.job_title}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) onClose();
      }}
    >
      <div className="dashboard-modal-card">
        <div className="dashboard-modal-head">
          <div>
            <h3 className="dashboard-modal-title">{application.job_title}</h3>
            <p className="dashboard-modal-subtitle">
              {application.company} • {application.job_location}
            </p>
          </div>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose} disabled={isSaving}>
            ✕
          </button>
        </div>

        <div className="dashboard-modal-body">
          {error ? <div className="form-error">{error}</div> : null}

          {isStatusFocused ? (
            <div className="dashboard-inline-note">
              Update the application status and save to apply the change immediately on the dashboard.
            </div>
          ) : null}

          <div className="dashboard-detail-grid">
            <DetailRow label="Position Type" value={toTitleCase(application.position_type)} />
            <DetailRow label="Posting Date" value={formatDetailDate(application.posting_date)} />
            <DetailRow label="Closing Date" value={formatDetailDate(application.closing_date)} />
            <DetailRow label="Salary" value={formatSalary(application)} />
            <DetailRow label="Job URL" value={application.job_url || "Not provided"} />
          </div>

          <label className="dashboard-status-field">
            <span className="dashboard-detail-label">Job Status</span>
            <select value={statusValue} onChange={(event) => onStatusChange(event.target.value)} disabled={isSaving}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {toTitleCase(option)}
                </option>
              ))}
            </select>
          </label>

          <div className="dashboard-copy-block">
            <span className="dashboard-detail-label">Job Description</span>
            <p>{application.job_description || "No description saved."}</p>
          </div>

          <div className="dashboard-copy-block">
            <span className="dashboard-detail-label">Application Notes</span>
            <p>{application.application_notes || "No notes saved."}</p>
          </div>

          <div className="dashboard-modal-actions">
            {application.job_url ? (
              <a className="ghost-btn dashboard-modal-link" href={application.job_url} target="_blank" rel="noreferrer">
                Open Job Link
              </a>
            ) : <span />}
            <div className="dashboard-modal-actions-right">
              <button className="ghost-btn" type="button" onClick={onClose} disabled={isSaving}>
                Cancel
              </button>
              <button className="primary-btn" type="button" onClick={onSave} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save Status"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({
  applications,
  applicationsError,
  hasLoadedApplications,
  applicationsStatus,
  onDeleteApplication,
  onLogout,
  onNavigate,
  onUpdateApplication,
}) {
  const [reminders, setReminders] = useState(SEED_REMINDERS);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState("cards");
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState(null);
  const [selectedApplication, setSelectedApplication] = useState(null);
  const [detailStatus, setDetailStatus] = useState("");
  const [detailError, setDetailError] = useState("");
  const [isSavingDetail, setIsSavingDetail] = useState(false);
  const [detailMode, setDetailMode] = useState("view");

  useEffect(() => {
    if (!selectedApplication) return;

    const nextSelectedApplication = applications.find(
      (application) => application.application_id === selectedApplication.application_id,
    );

    if (!nextSelectedApplication) {
      setSelectedApplication(null);
      setDetailStatus("");
      setDetailError("");
      setIsSavingDetail(false);
      setDetailMode("view");
      return;
    }

    setSelectedApplication(nextSelectedApplication);
    setDetailStatus(nextSelectedApplication.job_status);
  }, [applications, selectedApplication]);

  const metrics = useMemo(() => ({
    totalApplications: applications.length,
    activeInterviews: applications.filter(
      (application) => normalize(application.job_status) === "interviewing",
    ).length,
    setReminders: reminders.length,
  }), [applications, reminders]);

  const filteredApplications = useMemo(() => {
    const q = normalize(query);

    let list = applications.filter((application) => {
      const matchesQuery =
        !q ||
        normalize(application.job_title).includes(q) ||
        normalize(application.company).includes(q) ||
        normalize(application.job_location).includes(q);

      const matchesStatus =
        statusFilter === "all" ? true : normalize(application.job_status) === statusFilter;

      return matchesQuery && matchesStatus;
    });

    if (sortBy === "oldest") {
      list = [...list].sort((left, right) => left.application_id - right.application_id);
    }

    if (sortBy === "company") {
      list = [...list].sort((left, right) => left.company.localeCompare(right.company));
    }

    if (sortBy === "status") {
      list = [...list].sort((left, right) => left.job_status.localeCompare(right.job_status));
    }

    return list;
  }, [applications, query, statusFilter, sortBy]);

  async function handleDelete(applicationId) {
    setDeleteError("");
    setDeletingId(applicationId);

    try {
      await onDeleteApplication?.(applicationId);
      setReminders((prev) => prev.filter((reminder) => reminder.applicationId !== applicationId));
    } catch (error) {
      setDeleteError(error?.message || "Unable to delete application.");
    } finally {
      setDeletingId(null);
    }
  }

  function handleOpenDetails(application) {
    setSelectedApplication(application);
    setDetailStatus(application.job_status);
    setDetailError("");
    setDetailMode("view");
  }

  function handleOpenStatusEditor(application) {
    setSelectedApplication(application);
    setDetailStatus(application.job_status);
    setDetailError("");
    setDetailMode("status");
  }

  function handleCloseDetails() {
    if (isSavingDetail) return;
    setSelectedApplication(null);
    setDetailStatus("");
    setDetailError("");
    setDetailMode("view");
  }

  async function handleSaveStatus() {
    if (!selectedApplication) return;

    setDetailError("");
    setIsSavingDetail(true);

    try {
      await onUpdateApplication?.(
        selectedApplication.application_id,
        buildUpdatePayload(selectedApplication, detailStatus),
      );
      handleCloseDetails();
    } catch (error) {
      setDetailError(error?.message || "Unable to update status.");
    } finally {
      setIsSavingDetail(false);
    }
  }

  function handleResetView() {
    setQuery("");
    setStatusFilter("all");
    setSortBy("newest");
    setViewMode("cards");
    setDeleteError("");
  }

  const iconBtnInline = { lineHeight: 0 };
  const iconSvgInline = { display: "block" };
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
            <button className="nav-link is-active" type="button" onClick={() => onNavigate?.("dashboard")}>
              Dashboard
            </button>
            <button className="nav-link" type="button" onClick={() => onNavigate?.("applications")}>
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
            <button className="icon-btn" style={iconBtnInline} type="button" aria-label="Notifications">
              <svg
                style={iconSvgInline}
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M18 8a6 6 0 10-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
                <path d="M13.73 21a2 2 0 01-3.46 0" />
              </svg>
            </button>

            <button className="icon-btn" style={iconBtnInline} type="button" aria-label="Settings">
              <svg
                style={iconSvgInline}
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06A1.65 1.65 0 0015 19.4a1.65 1.65 0 00-1 .6 1.65 1.65 0 00-.33 1.82V22a2 2 0 11-4 0v-.18a1.65 1.65 0 00-.33-1.82 1.65 1.65 0 00-1-.6 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-.6-1 1.65 1.65 0 00-1.82-.33H2a2 2 0 110-4h.18a1.65 1.65 0 001.82-.33 1.65 1.65 0 00.6-1 1.65 1.65 0 00-.33-1.82l-.06-.06A2 2 0 116.04 3.6l.06.06A1.65 1.65 0 008 4.6c.39 0 .77-.14 1.06-.4.29-.26.5-.62.57-1.01V3a2 2 0 114 0v.18c.07.39.28.75.57 1.01.29.26.67.4 1.06.4.39 0 .77-.14 1.06-.4l.06-.06A2 2 0 1120.4 6.04l-.06.06c-.26.29-.4.67-.4 1.06 0 .39.14.77.4 1.06.26.29.62.5 1.01.57H22a2 2 0 110 4h-.18c-.39.07-.75.28-1.01.57-.26.29-.4.67-.4 1.06z" />
              </svg>
            </button>

            <button className="icon-btn" style={iconBtnInline} type="button" aria-label="Profile">
              <svg
                style={iconSvgInline}
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                focusable="false"
              >
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

      <main className="dashboard" aria-label="Dashboard">
        <section className="metrics" aria-label="Key metrics">
          <div className="metric-card">
            <div className="metric-label">Total Applications</div>
            <div className="metric-value">{metrics.totalApplications}</div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Active Interviews</div>
            <div className="metric-value">{metrics.activeInterviews}</div>
          </div>

          <div className="metric-card">
            <div className="metric-label">Set Reminders</div>
            <div className="metric-value">{metrics.setReminders}</div>
          </div>
        </section>

        <section className="controls" aria-label="Dashboard controls">
          <div className="controls-row">
            <div className="control control--search">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search company, title, location..."
                aria-label="Search"
              />
            </div>

            <div className="control">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Status filter"
              >
                <option value="all">Status: All</option>
                <option value="saved">Saved</option>
                <option value="applied">Applied</option>
                <option value="interviewing">Interviewing</option>
                <option value="offer">Offer</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <button className="primary-btn" type="button" onClick={() => onNavigate?.("applications")}>
              + Add Application
            </button>
          </div>

          <div className="controls-row controls-row--secondary">
            <div className="control">
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort">
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Oldest</option>
                <option value="company">Company</option>
                <option value="status">Status</option>
              </select>
            </div>

            <div className="control">
              <select value={viewMode} onChange={(event) => setViewMode(event.target.value)} aria-label="View">
                <option value="cards">View: Cards</option>
                <option value="table" disabled>
                  Table (later)
                </option>
              </select>
            </div>

            <div className="quick-actions" aria-label="Quick actions">
              <button className="ghost-btn" type="button" disabled>
                Bulk Edit
              </button>
              <button className="ghost-btn" type="button" disabled>
                Export
              </button>
            </div>

            <div className="session-actions" aria-label="Session actions">
              <button className="ghost-btn" type="button" onClick={handleResetView}>
                Reset View
              </button>
            </div>
          </div>
        </section>

        {deleteError ? <div className="form-error">{deleteError}</div> : null}
        {hasLoadError ? <div className="form-error">{applicationsError}</div> : null}

        <section className="content" aria-label="Dashboard content">
          <section aria-label="Job applications">
            <div className="section-head">
              <div>
                <h2 className="section-title">Job Applications</h2>
                <p className="section-subtitle">Click a card to open the detailed job view.</p>
              </div>
              <div className="section-meta">
                <span className="meta-pill">Showing: {filteredApplications.length}</span>
              </div>
            </div>

            {viewMode !== "cards" ? (
              <div className="empty-state">
                <div className="empty-title">Table view is coming later.</div>
                <div className="empty-subtitle">For now, switch back to Cards.</div>
              </div>
            ) : isLoading ? (
              <div className="empty-state">
                <div className="empty-title">Loading applications...</div>
                <div className="empty-subtitle">Fetching your saved jobs from the backend.</div>
              </div>
            ) : filteredApplications.length ? (
              <div className="cards">
                {filteredApplications.map((application) => (
                  <ApplicationCard
                    key={application.application_id}
                    app={application}
                    deletingId={deletingId}
                    onDelete={handleDelete}
                    onEdit={() => onNavigate?.("applications", { editingId: application.application_id })}
                    onOpenDetails={handleOpenDetails}
                    onOpenStatusEditor={handleOpenStatusEditor}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-title">No applications match your filters.</div>
                <div className="empty-subtitle">Try clearing search or switching Status back to All.</div>
              </div>
            )}
          </section>

          <aside className="reminders" aria-label="Upcoming reminders">
            <h2 className="section-title">Upcoming Reminders</h2>

            {!reminders.length ? (
              <div className="empty-subtitle" style={{ marginTop: 10 }}>
                No reminders yet.
              </div>
            ) : (
              <ul className="reminder-list">
                {reminders.map((reminder) => (
                  <li className="reminder-item" key={reminder.id}>
                    <span className="reminder-date">{reminder.date}</span>
                    {reminder.text}
                  </li>
                ))}
              </ul>
            )}

            <div className="panel-footnote">Detailed Job View opens when you click a card.</div>
          </aside>
        </section>
      </main>

      {selectedApplication ? (
        <ApplicationDetailModal
          application={selectedApplication}
          error={detailError}
        isSaving={isSavingDetail}
        isStatusFocused={detailMode === "status"}
        onClose={handleCloseDetails}
        onSave={handleSaveStatus}
        onStatusChange={setDetailStatus}
          statusValue={detailStatus}
        />
      ) : null}
    </>
  );
}
