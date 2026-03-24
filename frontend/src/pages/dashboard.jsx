import { useEffect, useMemo, useRef, useState } from "react";
import lockedInLogo from "../assets/lockedindark.png";
import { fetchDocumentBlob, fetchDocumentsForApplication, unlinkDocumentFromApplication } from "../lib/documentsApi";
import { toTitleCase } from "../lib/formatting";
import {
  getReminders,
  createReminder,
  updateReminder,
  deleteReminder,
} from "../lib/api";

const STATUS_OPTIONS = ["saved", "applied", "interviewing", "offer", "rejected"];

function normalize(value) {
  return String(value ?? "").toLowerCase().trim();
}

function formatReminderDate(dateValue) {
  if (!dateValue) return "";
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatReminderTime(timeValue) {
  if (!timeValue) return "";
  const value = String(timeValue).slice(0, 5);
  const [hours, minutes] = value.split(":");
  if (!hours || !minutes) return value;

  const hourNum = Number(hours);
  const suffix = hourNum >= 12 ? "PM" : "AM";
  const normalizedHour = hourNum % 12 || 12;
  return `${normalizedHour}:${minutes} ${suffix}`;
}

function normalizePositionType(value) {
  const normalized = String(value ?? "").trim();

  if (normalized === "full_time" || normalized === "full-time") return "Full-time";
  if (normalized === "part_time" || normalized === "part-time") return "Part-time";
  if (normalized.toLowerCase() === "contractor") return "Contractor";
  if (normalized.toLowerCase() === "internship") return "Internship";

  return normalized;
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
    position_type: normalizePositionType(application.position_type),
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
        <div className="app-card-badges">
          {app.doc_count > 0 && (
            <span
              className="app-doc-count"
              title={`${app.doc_count} linked document${app.doc_count !== 1 ? "s" : ""}`}
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
              {app.doc_count}
            </span>
          )}
          <StatusPill status={app.job_status} onClick={() => onOpenStatusEditor(app)} />
        </div>
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
  linkedDocuments,
  isLoadingDocs,
  onClose,
  onSave,
  onViewDocument,
  onUnlinkDocument,
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

          <div className="dashboard-copy-block">
            <span className="dashboard-detail-label">Linked Documents</span>
            {isLoadingDocs ? (
              <p className="dashboard-docs-loading">Loading documents...</p>
            ) : !linkedDocuments || linkedDocuments.length === 0 ? (
              <p className="dashboard-docs-empty">No documents linked to this application.</p>
            ) : (
              <ul className="dashboard-doc-list">
                {linkedDocuments.map((doc) => (
                  <li key={doc.id} className="dashboard-doc-item">
                    <span className="dashboard-doc-type">{toTitleCase(doc.documentType)}</span>
                    <span className="dashboard-doc-name">{doc.fileName || doc.title}</span>
                    <button
                      className="ghost-btn"
                      type="button"
                      onClick={() => onViewDocument(doc.id)}
                    >
                      View
                    </button>
                    <button
                      className="danger-btn"
                      type="button"
                      onClick={() => onUnlinkDocument(doc.id)}
                    >
                      Unlink
                    </button>
                  </li>
                ))}
              </ul>
            )}
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
  const [reminders, setReminders] = useState([]);
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
  const [linkedDocuments, setLinkedDocuments] = useState(null);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [isReminderDropdownOpen, setIsReminderDropdownOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderError, setReminderError] = useState("");
  const [reminderLoading, setReminderLoading] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState(null);
  const [reminderForm, setReminderForm] = useState({
    title: "",
    category: "",
    priority: "",
    status: "Pending",
    dueDate: "",
    dueTime: "",
    company: "",
    role: "",
    notes: "",
  });

  const viewedUrlsRef = useRef([]);
  const bellButtonRef = useRef(null);
  const reminderDropdownRef = useRef(null);

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

  useEffect(() => {
    async function loadReminders() {
      try {
        const data = await getReminders();
        setReminders(Array.isArray(data.reminders) ? data.reminders : []);
      } catch (error) {
        console.error("Failed to load reminders:", error);
      }
    }

    loadReminders();
  }, []);

  useEffect(() => {
    function handleClickOutside(event) {
      if (!isReminderDropdownOpen) return;

      const clickedBell = bellButtonRef.current?.contains(event.target);
      const clickedDropdown = reminderDropdownRef.current?.contains(event.target);

      if (!clickedBell && !clickedDropdown) {
        setIsReminderDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isReminderDropdownOpen]);

  const metrics = useMemo(() => ({
    totalApplications: applications.length,
    activeInterviews: applications.filter(
      (application) => normalize(application.job_status) === "interviewing",
    ).length,
  }), [applications]);

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

  function resetReminderForm() {
    setReminderForm({
      title: "",
      category: "",
      priority: "",
      status: "Pending",
      dueDate: "",
      dueTime: "",
      company: "",
      role: "",
      notes: "",
    });
    setEditingReminderId(null);
    setReminderError("");
  }

  function openCreateReminderModal() {
    resetReminderForm();
    setIsReminderModalOpen(true);
    setIsReminderDropdownOpen(false);
  }

  function closeReminderModal() {
    if (reminderLoading) return;
    resetReminderForm();
    setIsReminderModalOpen(false);
  }

  function handleReminderInputChange(event) {
    const { name, value } = event.target;
    setReminderForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function handleReminderSubmit(event) {
    event.preventDefault();
    setReminderLoading(true);
    setReminderError("");

    try {
      if (editingReminderId) {
        const data = await updateReminder(editingReminderId, reminderForm);
        setReminders((prev) =>
          prev.map((reminder) =>
            reminder.Reminder_ID === editingReminderId ? data.reminder : reminder
          )
        );
      } else {
        const data = await createReminder(reminderForm);
        setReminders((prev) => [data.reminder, ...prev]);
      }

      closeReminderModal();
    } catch (error) {
      setReminderError(error.message || "Failed to save reminder.");
    } finally {
      setReminderLoading(false);
    }
  }

  function handleEditReminder(reminder) {
    setEditingReminderId(reminder.Reminder_ID);
    setReminderForm({
      title: reminder.Reminder_Title || "",
      category: reminder.Reminder_Category || "",
      priority: reminder.Reminder_Priority || "",
      status: reminder.Reminder_Status || "Pending",
      dueDate: reminder.Reminder_Due_Date ? String(reminder.Reminder_Due_Date).slice(0, 10) : "",
      dueTime: reminder.Reminder_Due_Time ? String(reminder.Reminder_Due_Time).slice(0, 5) : "",
      company: reminder.Reminder_Company || "",
      role: reminder.Reminder_Role || "",
      notes: reminder.Reminder_Notes || "",
    });
    setReminderError("");
    setIsReminderModalOpen(true);
    setIsReminderDropdownOpen(false);
  }

  async function handleDeleteReminder(reminderId) {
    try {
      await deleteReminder(reminderId);
      setReminders((prev) => prev.filter((reminder) => reminder.Reminder_ID !== reminderId));
    } catch (error) {
      window.alert(error.message || "Failed to delete reminder.");
    }
  }

  async function handleDelete(applicationId) {
    setDeleteError("");
    setDeletingId(applicationId);

    try {
      await onDeleteApplication?.(applicationId);
    } catch (error) {
      setDeleteError(error?.message || "Unable to delete application.");
    } finally {
      setDeletingId(null);
    }
  }

  function openApplicationDetail(application, mode) {
    setSelectedApplication(application);
    setDetailStatus(application.job_status);
    setDetailError("");
    setDetailMode(mode);
    setLinkedDocuments(null);
    setIsLoadingDocs(true);
    fetchDocumentsForApplication(application.application_id)
      .then((docs) => setLinkedDocuments(docs))
      .catch(() => setLinkedDocuments([]))
      .finally(() => setIsLoadingDocs(false));
  }

  function handleOpenDetails(application) {
    openApplicationDetail(application, "view");
  }

  function handleOpenStatusEditor(application) {
    openApplicationDetail(application, "status");
  }

  function handleCloseDetails() {
    if (isSavingDetail) return;
    viewedUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    viewedUrlsRef.current = [];
    setSelectedApplication(null);
    setDetailStatus("");
    setDetailError("");
    setDetailMode("view");
    setLinkedDocuments(null);
    setIsLoadingDocs(false);
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

  async function handleViewDocument(documentId) {
    try {
      const blob = await fetchDocumentBlob(documentId);
      const url = URL.createObjectURL(blob);
      viewedUrlsRef.current.push(url);
      window.open(url, "_blank");
    } catch (error) {
      setDetailError(error?.message || "Could not open document.");
    }
  }

  async function handleUnlinkDocument(documentId) {
    if (!selectedApplication) return;
    try {
      await unlinkDocumentFromApplication(documentId, selectedApplication.application_id);
      setLinkedDocuments((prev) => (prev ?? []).filter((doc) => doc.id !== documentId));
    } catch (error) {
      setDetailError(error?.message || "Could not unlink document.");
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
            <button
              ref={bellButtonRef}
              className={`icon-btn ${isReminderDropdownOpen ? "is-open" : ""}`}
              style={iconBtnInline}
              type="button"
              aria-label="Notifications"
              onClick={() => setIsReminderDropdownOpen((prev) => !prev)}
            >
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

            {isReminderDropdownOpen && (
              <div
                ref={reminderDropdownRef}
                className="reminder-dropdown"
                role="dialog"
                aria-label="Reminders dropdown"
              >
                <div className="reminder-dropdown-header">
                  <div>
                    <h3 className="reminder-dropdown-title">Reminders</h3>
                    <p className="reminder-dropdown-subtitle">Upcoming reminders</p>
                  </div>

                  <button
                    className="icon-btn reminder-plus-btn"
                    type="button"
                    aria-label="Add reminder"
                    onClick={openCreateReminderModal}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path d="M12 5v14" />
                      <path d="M5 12h14" />
                    </svg>
                  </button>
                </div>

                <div className="reminder-dropdown-list">
                    {!reminders.length ? (
                      <div className="reminder-empty-state">No reminders yet.</div>
                    ) : (
                      reminders.map((reminder) => (
                        <div className="reminder-dropdown-item" key={reminder.Reminder_ID}>
                          <div className="reminder-dropdown-item-main">
                            <div className="reminder-dropdown-item-top">
                              <div>
                                <div className="reminder-dropdown-item-title">{reminder.Reminder_Title}</div>
                                <div className="reminder-dropdown-item-meta">
                                  {formatReminderDate(reminder.Reminder_Due_Date)}
                                  {reminder.Reminder_Due_Time ? ` • ${formatReminderTime(reminder.Reminder_Due_Time)}` : ""}
                                  {reminder.Reminder_Company ? ` • ${reminder.Reminder_Company}` : ""}
                                </div>
                                {reminder.Reminder_Notes ? (
                                  <div className="reminder-dropdown-item-notes">{reminder.Reminder_Notes}</div>
                                ) : null}
                              </div>

                              <div className="reminder-dropdown-item-actions reminder-dropdown-item-actions--icons">
                                <button
                                  className="reminder-icon-btn"
                                  type="button"
                                  aria-label="Edit reminder"
                                  title="Edit"
                                  onClick={() => handleEditReminder(reminder)}
                                >
                                  <svg
                                    width="15"
                                    height="15"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <path d="M12 20h9" />
                                    <path d="M16.5 3.5a2.12 2.12 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
                                  </svg>
                                </button>

                                <button
                                  className="reminder-icon-btn reminder-icon-btn--danger"
                                  type="button"
                                  aria-label="Delete reminder"
                                  title="Delete"
                                  onClick={() => handleDeleteReminder(reminder.Reminder_ID)}
                                >
                                  <svg
                                    width="15"
                                    height="15"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden="true"
                                  >
                                    <path d="M18 6L6 18" />
                                    <path d="M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
              </div>
            )}

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
        </section>
      </main>

      {selectedApplication ? (
        <ApplicationDetailModal
          application={selectedApplication}
          error={detailError}
          isSaving={isSavingDetail}
          isStatusFocused={detailMode === "status"}
          linkedDocuments={linkedDocuments}
          isLoadingDocs={isLoadingDocs}
          onClose={handleCloseDetails}
          onSave={handleSaveStatus}
          onViewDocument={handleViewDocument}
          onUnlinkDocument={handleUnlinkDocument}
          onStatusChange={setDetailStatus}
          statusValue={detailStatus}
        />
      ) : null}

      {isReminderModalOpen ? (
        <div
          className="reminder-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeReminderModal();
            }
          }}
        >
          <div
            className="reminder-modal"
            role="dialog"
            aria-modal="true"
            aria-label={editingReminderId ? "Edit reminder" : "Create reminder"}
          >
            <div className="reminder-modal-header">
              <div>
                <h2 className="reminder-modal-title">
                  {editingReminderId ? "Edit Reminder" : "Create Reminder"}
                </h2>
                <p className="reminder-modal-subtitle">
                  {editingReminderId ? "Update your reminder details" : "Add a new reminder for your job search"}
                </p>
              </div>

              <button className="icon-btn" type="button" aria-label="Close reminder modal" onClick={closeReminderModal}>
                ✕
              </button>
            </div>

            <form className="reminder-modal-form" onSubmit={handleReminderSubmit}>
              <div className="reminder-modal-grid">
                <label className="reminder-field">
                  <span>Title</span>
                  <input
                    name="title"
                    value={reminderForm.title}
                    onChange={handleReminderInputChange}
                    type="text"
                    placeholder="Interview follow-up"
                    required
                  />
                </label>

                <label className="reminder-field">
                  <span>Company</span>
                  <input
                    name="company"
                    value={reminderForm.company}
                    onChange={handleReminderInputChange}
                    type="text"
                    placeholder="Google"
                  />
                </label>

                <label className="reminder-field">
                  <span>Role</span>
                  <input
                    name="role"
                    value={reminderForm.role}
                    onChange={handleReminderInputChange}
                    type="text"
                    placeholder="Software Engineer Intern"
                  />
                </label>

                <label className="reminder-field">
                  <span>Category</span>
                  <select name="category" value={reminderForm.category} onChange={handleReminderInputChange}>
                    <option value="">Select category</option>
                    <option value="Interview">Interview</option>
                    <option value="Follow-up">Follow-up</option>
                    <option value="Reference">Reference</option>
                    <option value="Deadline">Deadline</option>
                    <option value="Networking">Networking</option>
                  </select>
                </label>

                <label className="reminder-field">
                  <span>Priority</span>
                  <select name="priority" value={reminderForm.priority} onChange={handleReminderInputChange}>
                    <option value="">Select priority</option>
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </label>

                <label className="reminder-field">
                  <span>Status</span>
                  <select name="status" value={reminderForm.status} onChange={handleReminderInputChange}>
                    <option value="Pending">Pending</option>
                    <option value="Done">Done</option>
                  </select>
                </label>

                <label className="reminder-field">
                  <span>Due date</span>
                  <input
                    name="dueDate"
                    value={reminderForm.dueDate}
                    onChange={handleReminderInputChange}
                    type="date"
                    required
                  />
                </label>

                <label className="reminder-field">
                  <span>Due time</span>
                  <input
                    name="dueTime"
                    value={reminderForm.dueTime}
                    onChange={handleReminderInputChange}
                    type="time"
                    required
                  />
                </label>
              </div>

              <label className="reminder-field">
                <span>Notes</span>
                <textarea
                  name="notes"
                  value={reminderForm.notes}
                  onChange={handleReminderInputChange}
                  rows="4"
                  placeholder="Add details for this reminder..."
                />
              </label>

              {reminderError ? <div className="auth-error">{reminderError}</div> : null}

              <div className="reminder-modal-actions">
                <button className="ghost-btn" type="button" onClick={closeReminderModal}>
                  Cancel
                </button>
                <button className="primary-btn" type="submit" disabled={reminderLoading}>
                  {reminderLoading ? "Saving..." : editingReminderId ? "Update Reminder" : "Create Reminder"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}