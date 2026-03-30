import { useEffect, useMemo, useState } from "react";
import lockedInLogo from "../assets/lockedindark.png";
import "../styles/dashboard.css";
import "../styles/contacts.css";
import { getContacts, createContact, updateContact, deleteContact as apiDeleteContact } from "../lib/api";

function fromBackend(row) {
  return {
    id: row.contact_id,
    name: row.contact_name || "",
    company: row.contact_company || "",
    role: row.contact_role || "",
    email: row.contact_email || "",
    phone: row.contact_phone || "",
    linkedin: row.contact_linkedin || "",
    relationshipStrength: (row.relationship_strength || "warm").toLowerCase(),
    communicationPreference: (row.preferred_communication || "email").toLowerCase(),
    lastContactedDate: row.last_contacted_date ? String(row.last_contacted_date).split("T")[0] : "",
    nextFollowUpDate: row.next_followup_date ? String(row.next_followup_date).split("T")[0] : "",
    notes: row.contact_notes || "",
  };
}

function toApiPayload(local) {
  return {
    name: local.name,
    company: local.company,
    role: local.role || null,
    contactEmail: local.email || null,
    phone: local.phone || null,
    linkedin: local.linkedin || null,
    relationshipStrength: local.relationshipStrength,
    preferredCommunication: local.communicationPreference,
    lastContactedDate: local.lastContactedDate || null,
    nextFollowupDate: local.nextFollowUpDate || null,
    notes: local.notes || null,
  };
}

const INITIAL_FORM = {
  id: null,
  name: "",
  company: "",
  role: "",
  email: "",
  phone: "",
  linkedin: "",
  relationshipStrength: "warm",
  communicationPreference: "email",
  lastContactedDate: "",
  nextFollowUpDate: "",
  notes: "",
};

function normalize(value) {
  return String(value ?? "").toLowerCase().trim();
}

function relationshipRank(value) {
  const map = { weak: 1, warm: 2, strong: 3, advocate: 4 };
  return map[value] ?? 0;
}

function toLabel(value) {
  return String(value)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function ContactModal({ title, children, onClose }) {
  return (
    <div
      className="contacts-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="contacts-modal-card">
        <div className="contacts-modal-head">
          <h3 className="contacts-modal-title">{title}</h3>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="contacts-modal-body">{children}</div>
      </div>
    </div>
  );
}

function ContactForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submitForm(event) {
    event.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Contact name is required.");
      return;
    }

    if (!form.company.trim()) {
      setError("Company is required.");
      return;
    }

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      setError("Email must be valid.");
      return;
    }

    if (form.linkedin.trim()) {
      try {
        new URL(form.linkedin.trim());
      } catch {
        setError("LinkedIn URL must be a valid link.");
        return;
      }
    }

    onSave({
      ...form,
      name: form.name.trim(),
      company: form.company.trim(),
      role: form.role.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      linkedin: form.linkedin.trim(),
      notes: form.notes.trim(),
    });
  }

  return (
    <form className="contact-form" onSubmit={submitForm}>
      {error ? <div className="form-error">{error}</div> : null}

      <div className="contact-form-grid">
        <label className="form-field">
          <span className="form-label">Name</span>
          <input
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="e.g., Jordan Lee"
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
          <span className="form-label">Role / Contact Type</span>
          <input
            value={form.role}
            onChange={(event) => updateField("role", event.target.value)}
            placeholder="e.g., Recruiter, Hiring Manager, Reference"
          />
        </label>

        <label className="form-field">
          <span className="form-label">Relationship Strength</span>
          <select
            value={form.relationshipStrength}
            onChange={(event) => updateField("relationshipStrength", event.target.value)}
          >
            <option value="weak">Weak</option>
            <option value="warm">Warm</option>
            <option value="strong">Strong</option>
            <option value="advocate">Advocate</option>
          </select>
        </label>

        <label className="form-field">
          <span className="form-label">Email</span>
          <input
            type="email"
            value={form.email}
            onChange={(event) => updateField("email", event.target.value)}
            placeholder="e.g., recruiter@company.com"
          />
        </label>

        <label className="form-field">
          <span className="form-label">Phone</span>
          <input
            value={form.phone}
            onChange={(event) => updateField("phone", event.target.value)}
            placeholder="e.g., (555) 000-0000"
          />
        </label>

        <label className="form-field form-field--full">
          <span className="form-label">LinkedIn URL</span>
          <input
            type="url"
            value={form.linkedin}
            onChange={(event) => updateField("linkedin", event.target.value)}
            placeholder="https://www.linkedin.com/in/..."
          />
        </label>

        <label className="form-field">
          <span className="form-label">Preferred Communication</span>
          <select
            value={form.communicationPreference}
            onChange={(event) => updateField("communicationPreference", event.target.value)}
          >
            <option value="email">Email</option>
            <option value="phone">Phone</option>
            <option value="linkedin">LinkedIn</option>
            <option value="text">Text</option>
            <option value="in_person">In Person</option>
          </select>
        </label>

        <label className="form-field">
          <span className="form-label">Last Contacted</span>
          <input
            type="date"
            value={form.lastContactedDate}
            onChange={(event) => updateField("lastContactedDate", event.target.value)}
          />
        </label>

        <label className="form-field">
          <span className="form-label">Next Follow-up</span>
          <input
            type="date"
            value={form.nextFollowUpDate}
            onChange={(event) => updateField("nextFollowUpDate", event.target.value)}
          />
        </label>

        <label className="form-field form-field--full">
          <span className="form-label">Notes</span>
          <textarea
            rows={4}
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="Context about conversations, interests, and follow-up intent..."
          />
        </label>
      </div>

      <div className="contacts-modal-actions">
        <button className="ghost-btn" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-btn" type="submit">
          Save Contact
        </button>
      </div>
    </form>
  );
}

export default function Contacts({ onLogout, onNavigate }) {
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [contactsError, setContactsError] = useState("");

  const [query, setQuery] = useState("");
  const [relationshipFilter, setRelationshipFilter] = useState("all");
  const [preferenceFilter, setPreferenceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("next_follow_up");

  const [modalState, setModalState] = useState({ open: false, editing: null });
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    setLoadingContacts(true);
    setContactsError("");
    getContacts()
      .then((data) => {
        setContacts(Array.isArray(data.contacts) ? data.contacts.map(fromBackend) : []);
      })
      .catch((err) => {
        setContactsError(err.message || "Failed to load contacts.");
      })
      .finally(() => setLoadingContacts(false));
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query);

    let list = contacts.filter((item) => {
      const matchesQuery =
        !q ||
        normalize(item.name).includes(q) ||
        normalize(item.company).includes(q) ||
        normalize(item.role).includes(q) ||
        normalize(item.email).includes(q) ||
        normalize(item.notes).includes(q);

      const matchesRelationship = relationshipFilter === "all" ? true : item.relationshipStrength === relationshipFilter;
      const matchesPreference = preferenceFilter === "all" ? true : item.communicationPreference === preferenceFilter;

      return matchesQuery && matchesRelationship && matchesPreference;
    });

    if (sortBy === "next_follow_up") {
      list = [...list].sort((a, b) => {
        const aDate = a.nextFollowUpDate || "9999-12-31";
        const bDate = b.nextFollowUpDate || "9999-12-31";
        return aDate.localeCompare(bDate);
      });
    }

    if (sortBy === "relationship") {
      list = [...list].sort((a, b) => relationshipRank(b.relationshipStrength) - relationshipRank(a.relationshipStrength));
    }

    if (sortBy === "recently_contacted") {
      list = [...list].sort((a, b) => String(b.lastContactedDate || "").localeCompare(String(a.lastContactedDate || "")));
    }

    return list;
  }, [contacts, query, relationshipFilter, preferenceFilter, sortBy]);

  function openCreateModal() {
    setModalState({ open: true, editing: null });
  }

  function openEditModal(contact) {
    setModalState({ open: true, editing: contact });
  }

  function closeModal() {
    setModalState({ open: false, editing: null });
  }

  async function saveContact(payload) {
    try {
      if (payload.id == null) {
        const data = await createContact(toApiPayload(payload));
        setContacts((prev) => [fromBackend(data.contact), ...prev]);
      } else {
        const data = await updateContact(payload.id, toApiPayload(payload));
        setContacts((prev) => prev.map((item) => (item.id === payload.id ? fromBackend(data.contact) : item)));
      }
      closeModal();
    } catch (err) {
      window.alert(err.message || "Failed to save contact.");
    }
  }

  async function markContactedToday(contactId) {
    const item = contacts.find((c) => c.id === contactId);
    if (!item) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      const data = await updateContact(contactId, toApiPayload({ ...item, lastContactedDate: today }));
      setContacts((prev) => prev.map((c) => (c.id === contactId ? fromBackend(data.contact) : c)));
    } catch (err) {
      window.alert(err.message || "Failed to update contact.");
    }
  }

  function confirmDelete(contact) {
    setDeleteTarget(contact);
  }

  async function deleteContact() {
    if (!deleteTarget) return;
    try {
      await apiDeleteContact(deleteTarget.id);
      setContacts((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      window.alert(err.message || "Failed to delete contact.");
    }
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
            <button className="nav-link" type="button" onClick={() => onNavigate?.("applications")}>
              Applications
            </button>
            <button className="nav-link" type="button" onClick={() => onNavigate?.("reminders")}>
              Reminders
            </button>
            <button className="nav-link is-active" type="button" onClick={() => onNavigate?.("contacts")}>
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

      <main className="dashboard contacts-page" aria-label="Contacts workspace">
        <section className="contacts-hero">
          <div>
            <h1 className="contacts-title">Contacts Workspace</h1>
            <p className="contacts-subtitle">
              Manage recruiters, hiring managers, references, and networking connections in one place.
            </p>
          </div>
          <div className="contacts-hero-actions">
            <span className="meta-pill">Total: {contacts.length}</span>
            <button className="primary-btn" type="button" onClick={openCreateModal}>
              + New Contact
            </button>
          </div>
        </section>

        <section className="controls contacts-controls" aria-label="Contacts controls">
          <div className="controls-row contacts-controls-row">
            <div className="control control--search">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, company, role, email, notes..."
                aria-label="Search contacts"
              />
            </div>

            <div className="control">
              <select
                value={relationshipFilter}
                onChange={(event) => setRelationshipFilter(event.target.value)}
                aria-label="Relationship filter"
              >
                <option value="all">Relationship: All</option>
                <option value="weak">Weak</option>
                <option value="warm">Warm</option>
                <option value="strong">Strong</option>
                <option value="advocate">Advocate</option>
              </select>
            </div>

            <div className="control">
              <select
                value={preferenceFilter}
                onChange={(event) => setPreferenceFilter(event.target.value)}
                aria-label="Preference filter"
              >
                <option value="all">Preference: All</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="linkedin">LinkedIn</option>
                <option value="text">Text</option>
                <option value="in_person">In Person</option>
              </select>
            </div>
          </div>

          <div className="controls-row controls-row--secondary contacts-controls-secondary">
            <div className="control">
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort contacts">
                <option value="next_follow_up">Sort: Next Follow-up</option>
                <option value="relationship">Relationship Strength</option>
                <option value="recently_contacted">Recently Contacted</option>
              </select>
            </div>

            <div className="section-meta">
              <span className="meta-pill">Showing: {filtered.length}</span>
            </div>
          </div>
        </section>

        <section className="contacts-list" aria-label="Contacts list">
          {loadingContacts ? (
            <div className="contacts-empty">Loading contacts…</div>
          ) : contactsError ? (
            <div className="contacts-empty">{contactsError}</div>
          ) : !filtered.length ? (
            <div className="contacts-empty">No contacts match the current filters.</div>
          ) : (
            filtered.map((contact) => (
              <article key={contact.id} className="contact-card">
                <div className="contact-head">
                  <div>
                    <h3 className="contact-name">{contact.name}</h3>
                    <p className="contact-meta">
                      {contact.company}
                      {contact.role ? ` • ${contact.role}` : ""}
                    </p>
                  </div>

                  <div className="contact-badges">
                    <span className={`contact-pill contact-pill--relationship-${contact.relationshipStrength}`}>
                      {toLabel(contact.relationshipStrength)}
                    </span>
                    <span className="contact-pill contact-pill--preference">{toLabel(contact.communicationPreference)}</span>
                  </div>
                </div>

                <div className="contact-details-grid">
                  <div>Email: {contact.email || "Not provided"}</div>
                  <div>Phone: {contact.phone || "Not provided"}</div>
                  <div>
                    LinkedIn:{" "}
                    {contact.linkedin ? (
                      <a href={contact.linkedin} target="_blank" rel="noreferrer" className="contact-link">
                        Open profile
                      </a>
                    ) : (
                      "Not provided"
                    )}
                  </div>
                  <div>Last Contacted: {contact.lastContactedDate || "Not set"}</div>
                  <div>Next Follow-up: {contact.nextFollowUpDate || "Not set"}</div>
                </div>

                {contact.notes ? <p className="contact-notes">{contact.notes}</p> : null}

                <div className="contact-actions">
                  <button className="ghost-btn" type="button" onClick={() => markContactedToday(contact.id)}>
                    Mark Contacted Today
                  </button>
                  <button className="ghost-btn" type="button" onClick={() => openEditModal(contact)}>
                    Edit
                  </button>
                  <button className="danger-btn" type="button" onClick={() => confirmDelete(contact)}>
                    Delete
                  </button>
                </div>
              </article>
            ))
          )}
        </section>
      </main>

      {modalState.open ? (
        <ContactModal title={modalState.editing ? "Edit Contact" : "New Contact"} onClose={closeModal}>
          <ContactForm initial={modalState.editing ?? INITIAL_FORM} onSave={saveContact} onCancel={closeModal} />
        </ContactModal>
      ) : null}

      {deleteTarget ? (
        <ContactModal title="Delete Contact" onClose={() => setDeleteTarget(null)}>
          <p className="delete-confirm-copy">
            Delete <strong>{deleteTarget.name}</strong> from contacts? This action cannot be undone.
          </p>
          <div className="contacts-modal-actions">
            <button className="ghost-btn" type="button" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button className="danger-btn" type="button" onClick={deleteContact}>
              Delete
            </button>
          </div>
        </ContactModal>
      ) : null}
    </>
  );
}
