import { useMemo, useState } from "react";
import lockedInLogo from "../assets/lockedindark.png";
import "../styles/dashboard.css";
import "../styles/reminders.css";

const SEED_REMINDERS = [
  {
    id: 1,
    title: "Google SWE intern interview prep",
    category: "interview",
    status: "pending",
    priority: "high",
    dueDate: "2026-03-05",
    dueTime: "10:00",
    company: "Google",
    role: "Software Engineer Intern",
    notes: "Review system design and behavioral stories.",
  },
  {
    id: 2,
    title: "Amazon follow-up email",
    category: "follow_up",
    status: "done",
    priority: "medium",
    dueDate: "2026-03-01",
    dueTime: "15:00",
    company: "Amazon",
    role: "Marketing Coordinator",
    notes: "Thank recruiter and ask for timeline.",
  },
  {
    id: 3,
    title: "Request reference letter",
    category: "reference",
    status: "pending",
    priority: "urgent",
    dueDate: "2026-03-03",
    dueTime: "09:30",
    company: "Microsoft",
    role: "Project Manager",
    notes: "Send draft bullet points to recommender.",
  },
];

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
  const [reminders, setReminders] = useState(SEED_REMINDERS);

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

  function openCreateModal() {
    setModalState({ open: true, editing: null });
  }

  function openEditModal(reminder) {
    setModalState({ open: true, editing: reminder });
  }

  function closeModal() {
    setModalState({ open: false, editing: null });
  }

  function saveReminder(payload) {
    if (payload.id == null) {
      const nextId = Math.max(0, ...reminders.map((item) => item.id)) + 1;
      setReminders((prev) => [{ ...payload, id: nextId }, ...prev]);
    } else {
      setReminders((prev) => prev.map((item) => (item.id === payload.id ? payload : item)));
    }

    closeModal();
  }

  function confirmDelete(reminder) {
    setDeleteTarget(reminder);
  }

  function deleteReminder() {
    if (!deleteTarget) return;
    setReminders((prev) => prev.filter((item) => item.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  function toggleReminderStatus(reminderId) {
    setReminders((prev) =>
      prev.map((item) =>
        item.id === reminderId
          ? {
              ...item,
              status: item.status === "done" ? "pending" : "done",
            }
          : item
      )
    );
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
          {!filtered.length ? (
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
