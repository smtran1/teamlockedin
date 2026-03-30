import { useEffect, useMemo, useState } from "react";
import lockedInLogo from "../assets/lockedindark.png";
import "../styles/dashboard.css";
import "../styles/reminders.css";
import { getReminders, createReminder, updateReminder, deleteReminder as apiDeleteReminder } from "../lib/api";

const CATEGORY_TO_API = {
  interview: "Interview",
  follow_up: "Follow-up",
  reference: "Reference",
  deadline: "Deadline",
  networking: "Networking",
};

const PRIORITY_TO_API = { low: "Low", medium: "Medium", high: "High", urgent: "Urgent" };
const STATUS_TO_API = { pending: "Pending", done: "Done" };

function fromBackend(row) {
  const cat = (row.Reminder_Category || "").toLowerCase().replace(/-/g, "_");
  return {
    id: row.Reminder_ID,
    title: row.Reminder_Title || "",
    category: cat,
    priority: (row.Reminder_Priority || "medium").toLowerCase(),
    status: (row.Reminder_Status || "pending").toLowerCase(),
    dueDate: row.Reminder_Due_Date ? String(row.Reminder_Due_Date).split("T")[0] : "",
    dueTime: row.Reminder_Due_Time ? String(row.Reminder_Due_Time).slice(0, 5) : "",
    company: row.Reminder_Company || "",
    role: row.Reminder_Role || "",
    notes: row.Reminder_Notes || "",
  };
}

function toApiPayload(local) {
  return {
    title: local.title,
    category: CATEGORY_TO_API[local.category] || local.category,
    priority: PRIORITY_TO_API[local.priority] || local.priority,
    status: STATUS_TO_API[local.status] || local.status,
    dueDate: local.dueDate || null,
    dueTime: local.dueTime || null,
    company: local.company || null,
    role: local.role || null,
    notes: local.notes || null,
  };
}

const INITIAL_FORM = {
  id: null,
  title: "",
  category: "interview",
  status: "pending",
  priority: "medium",
  dueDate: "",
  dueTime: "",
  company: "",
  role: "",
  notes: "",
};

function normalize(value) {
  return String(value ?? "").toLowerCase().trim();
}

function toLabel(value) {
  return String(value)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function priorityScore(priority) {
  const map = { urgent: 4, high: 3, medium: 2, low: 1 };
  return map[priority] ?? 0;
}

function getDueTimestamp(reminder) {
  if (!reminder.dueDate) return Number.MAX_SAFE_INTEGER;
  const value = reminder.dueTime ? `${reminder.dueDate}T${reminder.dueTime}:00` : `${reminder.dueDate}T23:59:00`;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

function ReminderModal({ title, children, onClose }) {
  return (
    <div
      className="reminders-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="reminders-modal-card">
        <div className="reminders-modal-head">
          <h3 className="reminders-modal-title">{title}</h3>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="reminders-modal-body">{children}</div>
      </div>
    </div>
  );
}

function ReminderForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submitForm(event) {
    event.preventDefault();
    setError("");

    if (!form.title.trim()) {
      setError("Reminder title is required.");
      return;
    }

    onSave({
      ...form,
      title: form.title.trim(),
      company: form.company.trim(),
      role: form.role.trim(),
      notes: form.notes.trim(),
    });
  }

  return (
    <form className="reminder-form" onSubmit={submitForm}>
      {error ? <div className="form-error">{error}</div> : null}

      <div className="reminder-form-grid">
        <label className="form-field">
          <span className="form-label">Reminder Title</span>
          <input
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            placeholder="e.g., Send follow-up email"
          />
        </label>

        <label className="form-field">
          <span className="form-label">Category</span>
          <select value={form.category} onChange={(event) => updateField("category", event.target.value)}>
            <option value="interview">Interview</option>
            <option value="follow_up">Follow-up</option>
            <option value="reference">Reference</option>
            <option value="deadline">Deadline</option>
            <option value="networking">Networking</option>
          </select>
        </label>

        <label className="form-field">
          <span className="form-label">Priority</span>
          <select value={form.priority} onChange={(event) => updateField("priority", event.target.value)}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>

        <label className="form-field">
          <span className="form-label">Status</span>
          <select value={form.status} onChange={(event) => updateField("status", event.target.value)}>
            <option value="pending">Pending</option>
            <option value="done">Done</option>
          </select>
        </label>

        <label className="form-field">
          <span className="form-label">Due Date</span>
          <input type="date" value={form.dueDate} onChange={(event) => updateField("dueDate", event.target.value)} />
        </label>

        <label className="form-field">
          <span className="form-label">Due Time</span>
          <input type="time" value={form.dueTime} onChange={(event) => updateField("dueTime", event.target.value)} />
        </label>

        <label className="form-field">
          <span className="form-label">Company (Optional)</span>
          <input
            value={form.company}
            onChange={(event) => updateField("company", event.target.value)}
            placeholder="e.g., Google"
          />
        </label>

        <label className="form-field">
          <span className="form-label">Role (Optional)</span>
          <input
            value={form.role}
            onChange={(event) => updateField("role", event.target.value)}
            placeholder="e.g., Software Engineer Intern"
          />
        </label>

        <label className="form-field form-field--full">
          <span className="form-label">Notes</span>
          <textarea
            rows={4}
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="Optional context, checklist, or talking points..."
          />
        </label>
      </div>

      <div className="reminders-modal-actions">
        <button className="ghost-btn" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-btn" type="submit">
          Save Reminder
        </button>
      </div>
    </form>
  );
}

export default function Reminders({ onLogout, onNavigate }) {
  const [reminders, setReminders] = useState([]);
  const [loadingReminders, setLoadingReminders] = useState(true);
  const [remindersError, setRemindersError] = useState("");

  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sortBy, setSortBy] = useState("due_soon");

  const [modalState, setModalState] = useState({ open: false, editing: null });
  const [deleteTarget, setDeleteTarget] = useState(null);

  const filtered = useMemo(() => {
    const q = normalize(query);

    let list = reminders.filter((item) => {
      const matchesQuery =
        !q ||
        normalize(item.title).includes(q) ||
        normalize(item.notes).includes(q) ||
        normalize(item.company).includes(q) ||
        normalize(item.role).includes(q);

      const matchesCategory = categoryFilter === "all" ? true : item.category === categoryFilter;
      const matchesStatus = statusFilter === "all" ? true : item.status === statusFilter;
      const matchesPriority = priorityFilter === "all" ? true : item.priority === priorityFilter;

      return matchesQuery && matchesCategory && matchesStatus && matchesPriority;
    });

    if (sortBy === "due_soon") {
      list = [...list].sort((a, b) => getDueTimestamp(a) - getDueTimestamp(b));
    }

    if (sortBy === "priority") {
      list = [...list].sort((a, b) => priorityScore(b.priority) - priorityScore(a.priority));
    }

    if (sortBy === "status") {
      list = [...list].sort((a, b) => a.status.localeCompare(b.status));
    }

    return list;
  }, [reminders, query, categoryFilter, statusFilter, priorityFilter, sortBy]);

  useEffect(() => {
    setLoadingReminders(true);
    setRemindersError("");
    getReminders()
      .then((data) => {
        setReminders(Array.isArray(data.reminders) ? data.reminders.map(fromBackend) : []);
      })
      .catch((err) => {
        setRemindersError(err.message || "Failed to load reminders.");
      })
      .finally(() => setLoadingReminders(false));
  }, []);

  function openCreateModal() {
    setModalState({ open: true, editing: null });
  }

  function openEditModal(reminder) {
    setModalState({ open: true, editing: reminder });
  }

  function closeModal() {
    setModalState({ open: false, editing: null });
  }

  async function saveReminder(payload) {
    try {
      if (payload.id == null) {
        const data = await createReminder(toApiPayload(payload));
        setReminders((prev) => [fromBackend(data.reminder), ...prev]);
      } else {
        const data = await updateReminder(payload.id, toApiPayload(payload));
        setReminders((prev) => prev.map((item) => (item.id === payload.id ? fromBackend(data.reminder) : item)));
      }
      closeModal();
    } catch (err) {
      window.alert(err.message || "Failed to save reminder.");
    }
  }

  function confirmDelete(reminder) {
    setDeleteTarget(reminder);
  }

  async function deleteReminder() {
    if (!deleteTarget) return;
    try {
      await apiDeleteReminder(deleteTarget.id);
      setReminders((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      window.alert(err.message || "Failed to delete reminder.");
    }
  }

  async function toggleReminderStatus(reminderId) {
    const item = reminders.find((r) => r.id === reminderId);
    if (!item) return;
    const newStatus = item.status === "done" ? "pending" : "done";
    try {
      const data = await updateReminder(reminderId, toApiPayload({ ...item, status: newStatus }));
      setReminders((prev) => prev.map((r) => (r.id === reminderId ? fromBackend(data.reminder) : r)));
    } catch (err) {
      window.alert(err.message || "Failed to update reminder.");
    }
  }

  const pendingCount = reminders.filter((item) => item.status === "pending").length;

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
            <button className="nav-link" type="button" onClick={() => onNavigate?.("applications")}>
              Applications
            </button>
            <button className="nav-link is-active" type="button" onClick={() => onNavigate?.("reminders")}>
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

      <main className="dashboard reminders-page" aria-label="Reminders workspace">
        <section className="reminders-hero">
          <div>
            <h1 className="reminders-title">Reminders Workspace</h1>
            <p className="reminders-subtitle">Create, update, and track interview, follow-up, reference, deadline, and networking reminders.</p>
          </div>
          <div className="reminders-hero-actions">
            <span className="meta-pill">Pending: {pendingCount}</span>
            <button className="primary-btn" type="button" onClick={openCreateModal}>
              + New Reminder
            </button>
          </div>
        </section>

        <section className="controls reminders-controls" aria-label="Reminder controls">
          <div className="controls-row reminders-controls-row">
            <div className="control control--search">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, notes, company, role..."
                aria-label="Search reminders"
              />
            </div>

            <div className="control">
              <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Category filter">
                <option value="all">Category: All</option>
                <option value="interview">Interview</option>
                <option value="follow_up">Follow-up</option>
                <option value="reference">Reference</option>
                <option value="deadline">Deadline</option>
                <option value="networking">Networking</option>
              </select>
            </div>

            <div className="control">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Status filter">
                <option value="all">Status: All</option>
                <option value="pending">Pending</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div className="control">
              <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} aria-label="Priority filter">
                <option value="all">Priority: All</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div className="controls-row controls-row--secondary reminders-controls-secondary">
            <div className="control">
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort reminders">
                <option value="due_soon">Sort: Due Soon</option>
                <option value="priority">Priority</option>
                <option value="status">Status</option>
              </select>
            </div>

            <div className="section-meta">
              <span className="meta-pill">Showing: {filtered.length}</span>
            </div>
          </div>
        </section>

        <section className="reminders-list" aria-label="Reminder items">
          {loadingReminders ? (
            <div className="reminders-empty">Loading reminders…</div>
          ) : remindersError ? (
            <div className="reminders-empty">{remindersError}</div>
          ) : !filtered.length ? (
            <div className="reminders-empty">No reminders match the current filters.</div>
          ) : (
            filtered.map((item) => (
              <article key={item.id} className="reminder-card">
                <div className="reminder-head">
                  <div>
                    <h3 className="reminder-item-title">{item.title}</h3>
                    <p className="reminder-item-meta">
                      {toLabel(item.category)}
                      {item.company || item.role ? ` • ${item.company || "Company"}${item.role ? ` — ${item.role}` : ""}` : ""}
                    </p>
                  </div>

                  <div className="reminder-badges">
                    <span className={`reminder-pill reminder-pill--priority-${item.priority}`}>{toLabel(item.priority)}</span>
                    <span className={`reminder-pill reminder-pill--status-${item.status}`}>{toLabel(item.status)}</span>
                  </div>
                </div>

                <div className="reminder-body">
                  <div className="reminder-due">
                    Due: {item.dueDate ? item.dueDate : "No due date"}
                    {item.dueTime ? ` at ${item.dueTime}` : ""}
                  </div>
                  {item.notes ? <p className="reminder-notes">{item.notes}</p> : null}
                </div>

                <div className="reminder-actions">
                  <button className="ghost-btn" type="button" onClick={() => toggleReminderStatus(item.id)}>
                    Mark as {item.status === "done" ? "Pending" : "Done"}
                  </button>
                  <button className="ghost-btn" type="button" onClick={() => openEditModal(item)}>
                    Edit
                  </button>
                  <button className="danger-btn" type="button" onClick={() => confirmDelete(item)}>
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </main>

      {modalState.open ? (
        <ReminderModal title={modalState.editing ? "Edit Reminder" : "New Reminder"} onClose={closeModal}>
          <ReminderForm initial={modalState.editing ?? INITIAL_FORM} onSave={saveReminder} onCancel={closeModal} />
        </ReminderModal>
      ) : null}

      {deleteTarget ? (
        <ReminderModal title="Delete Reminder" onClose={() => setDeleteTarget(null)}>
          <p className="delete-confirm-copy">
            Delete <strong>{deleteTarget.title}</strong>? This action cannot be undone.
          </p>
          <div className="reminders-modal-actions">
            <button className="ghost-btn" type="button" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button className="danger-btn" type="button" onClick={deleteReminder}>
              Delete
            </button>
          </div>
        </ReminderModal>
      ) : null}
    </>
  );
}
