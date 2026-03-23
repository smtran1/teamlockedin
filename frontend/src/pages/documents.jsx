import { useEffect, useMemo, useRef, useState } from "react";
import lockedInLogo from "../assets/lockedindark.png";
import "../styles/dashboard.css";
import "../styles/documents.css";
import {
  fetchDocuments,
  createDocument,
  updateDocument,
  deleteDocument as apiDeleteDocument,
  fetchDocumentBlob,
} from "../lib/documentsApi";
import { fetchApplications } from "../lib/applicationsApi";
import { toTitleCase, formatFileSize } from "../lib/formatting";

const INITIAL_FORM = {
  id: null,
  title: "",
  documentType: "resume",
  uploadDate: "",
  notes: "",
  applicationIds: [],
  file: null,
};

function normalize(value) {
  return String(value ?? "").toLowerCase().trim();
}


function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function DocumentModal({ title, children, onClose }) {
  return (
    <div
      className="documents-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="documents-modal-card">
        <div className="documents-modal-head">
          <h3 className="documents-modal-title">{title}</h3>
          <button className="icon-btn" type="button" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="documents-modal-body">{children}</div>
      </div>
    </div>
  );
}

function MultiSelectDropdown({ options, selected, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function toggleOption(value) {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  const selectedLabels = options
    .filter((opt) => selected.includes(opt.value))
    .map((opt) => opt.label);

  const displayText =
    selectedLabels.length === 0
      ? "None"
      : selectedLabels.length === 1
      ? selectedLabels[0]
      : `${selectedLabels.length} applications selected`;

  return (
    <div className="multiselect" ref={containerRef}>
      <button
        type="button"
        className="multiselect-toggle"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        <span className="multiselect-label">{displayText}</span>
        <span className="multiselect-arrow">{isOpen ? "▲" : "▼"}</span>
      </button>
      {isOpen && (
        <div className="multiselect-dropdown" role="listbox" aria-multiselectable="true">
          {options.length === 0 ? (
            <div className="multiselect-empty">No applications available</div>
          ) : (
            options.map((opt) => (
              <label key={opt.value} className="multiselect-option">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={() => toggleOption(opt.value)}
                />
                {opt.label}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function DocumentForm({ initial, isEditing, applications, isSaving, onSave, onCancel }) {
  const [form, setForm] = useState({
    ...initial,
    uploadDate: initial.uploadDate || todayDateString(),
    applicationIds: initial.applicationIds ?? [],
    file: null,
  });
  const [error, setError] = useState("");

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function submitForm(event) {
    event.preventDefault();
    setError("");

    if (!form.title.trim()) {
      setError("Document title is required.");
      return;
    }

    if (!form.uploadDate) {
      setError("Upload date is required.");
      return;
    }

    if (!isEditing && !form.file) {
      setError("Please upload a file for this document.");
      return;
    }

    if (form.file) {
      const ALLOWED_EXTS = /\.(pdf|doc|docx|txt)$/i;
      const MAX_SIZE = 10 * 1024 * 1024;
      if (!ALLOWED_EXTS.test(form.file.name)) {
        setError("Only PDF, DOC, DOCX, and TXT files are allowed.");
        return;
      }
      if (form.file.size > MAX_SIZE) {
        setError("File size must not exceed 10 MB.");
        return;
      }
    }

    onSave({
      ...form,
      title: form.title.trim(),
      notes: form.notes.trim(),
    });
  }

  return (
    <form className="document-form" onSubmit={submitForm}>
      {error ? <div className="form-error" role="alert">{error}</div> : null}

      <div className="document-form-grid">
        <label className="form-field">
          <span className="form-label">Document Title</span>
          <input
            value={form.title}
            onChange={(event) => updateField("title", event.target.value)}
            placeholder="e.g., Amazon Data Analyst Resume"
          />
        </label>

        <label className="form-field">
          <span className="form-label">Document Type</span>
          <select
            value={form.documentType}
            onChange={(event) => updateField("documentType", event.target.value)}
          >
            <option value="resume">Resume</option>
            <option value="cover_letter">Cover Letter</option>
            <option value="portfolio">Portfolio</option>
            <option value="reference">Reference</option>
            <option value="transcript">Transcript</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className="form-field">
          <span className="form-label">Upload Date</span>
          <input
            type="date"
            value={form.uploadDate}
            onChange={(event) => updateField("uploadDate", event.target.value)}
          />
        </label>

        <div className="form-field">
          <span className="form-label">Linked Applications (Optional)</span>
          <MultiSelectDropdown
            options={applications.map((app) => ({
              value: app.application_id,
              label: `${app.company} — ${app.job_title}`,
            }))}
            selected={form.applicationIds}
            onChange={(ids) => updateField("applicationIds", ids)}
          />
        </div>

        <label className="form-field form-field--full">
          <span className="form-label">Notes (Optional)</span>
          <textarea
            rows={4}
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            placeholder="What this version was tailored for..."
          />
        </label>

        <label className="form-field form-field--full">
          <span className="form-label">{isEditing ? "Replace File (Optional)" : "Upload File"}</span>
          <input
            type="file"
            onChange={(event) => updateField("file", event.target.files?.[0] ?? null)}
            aria-label={isEditing ? "Replace file" : "Upload file"}
          />
        </label>
      </div>

      <div className="documents-modal-actions">
        <button className="ghost-btn" type="button" onClick={onCancel} disabled={isSaving}>
          Cancel
        </button>
        <button className="primary-btn" type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : isEditing ? "Update Document" : "Save Document"}
        </button>
      </div>
    </form>
  );
}

export default function Documents({ onLogout, onNavigate }) {
  const [documents, setDocuments] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [linkFilter, setLinkFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const [modalState, setModalState] = useState({ open: false, editing: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState(null);
  const [isViewingId, setIsViewingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([fetchDocuments(), fetchApplications()])
      .then(([docs, apps]) => {
        if (!cancelled) {
          setDocuments(docs);
          setApplications(apps);
          setApiError("");
        }
      })
      .catch((err) => {
        if (!cancelled) setApiError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      documents.forEach((item) => {
        if (item.objectUrl) URL.revokeObjectURL(item.objectUrl);
      });
    };
  }, [documents]);

  const filtered = useMemo(() => {
    const q = normalize(query);

    let list = documents.filter((item) => {
      const matchesQuery =
        !q ||
        normalize(item.title).includes(q) ||
        normalize(item.fileName).includes(q) ||
        normalize(item.notes).includes(q) ||
        normalize(item.linkedApplication).includes(q);

      const matchesType = typeFilter === "all" ? true : item.documentType === typeFilter;
      const hasLink = Boolean(item.linkedApplication);
      const matchesLink =
        linkFilter === "all" ? true : linkFilter === "linked" ? hasLink : !hasLink;

      return matchesQuery && matchesType && matchesLink;
    });

    if (sortBy === "newest") {
      list = [...list].sort((a, b) => String(b.uploadDate).localeCompare(String(a.uploadDate)));
    }

    if (sortBy === "oldest") {
      list = [...list].sort((a, b) => String(a.uploadDate).localeCompare(String(b.uploadDate)));
    }

    if (sortBy === "title") {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    }

    if (sortBy === "type") {
      list = [...list].sort((a, b) => a.documentType.localeCompare(b.documentType));
    }

    return list;
  }, [documents, query, typeFilter, linkFilter, sortBy]);

  function openCreateModal() {
    setModalState({ open: true, editing: null });
  }

  function openEditModal(document) {
    setModalState({ open: true, editing: document });
  }

  function closeModal() {
    setModalState({ open: false, editing: null });
  }

  async function saveDocument(payload) {
    if (isSaving) return;
    setIsSaving(true);
    setApiError("");
    try {
      if (payload.id == null) {
        const created = await createDocument(payload);
        setDocuments((prev) => [created, ...prev]);
      } else {
        await updateDocument(payload.id, payload);
        const linkedAppNames = (payload.applicationIds || [])
          .map((id) => applications.find((a) => a.application_id === id))
          .filter(Boolean)
          .map((a) => `${a.company} — ${a.job_title}`);
        setDocuments((prev) =>
          prev.map((item) => {
            if (item.id !== payload.id) return item;
            if (payload.file && item.objectUrl) URL.revokeObjectURL(item.objectUrl);
            return {
              ...item,
              title: payload.title,
              documentType: payload.documentType,
              uploadDate: payload.uploadDate,
              notes: payload.notes,
              applicationIds: payload.applicationIds,
              linkedApplications: linkedAppNames,
              linkedApplication: linkedAppNames.join(", "),
              fileName: payload.file ? payload.file.name : item.fileName,
              fileSize: payload.file ? payload.file.size : item.fileSize,
              objectUrl: payload.file ? null : item.objectUrl,
            };
          })
        );
      }
      closeModal();
    } catch (err) {
      setApiError(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  function confirmDelete(document) {
    setDeleteTarget(document);
  }

  async function deleteDocument() {
    if (!deleteTarget || isDeletingId === deleteTarget.id) return;

    setIsDeletingId(deleteTarget.id);
    setApiError("");
    try {
      await apiDeleteDocument(deleteTarget.id);
      if (deleteTarget.objectUrl) URL.revokeObjectURL(deleteTarget.objectUrl);
      setDocuments((prev) => prev.filter((item) => item.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setApiError(err.message);
      setDeleteTarget(null);
    } finally {
      setIsDeletingId(null);
    }
  }

  async function viewDocument(document) {
    if (document.objectUrl) {
      window.open(document.objectUrl, "_blank", "noopener,noreferrer");
      return;
    }

    if (isViewingId === document.id) return;

    setIsViewingId(document.id);
    setApiError("");
    try {
      const blob = await fetchDocumentBlob(document.id);
      const url = URL.createObjectURL(blob);
      setDocuments((prev) =>
        prev.map((item) => (item.id === document.id ? { ...item, objectUrl: url } : item))
      );
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setApiError(err.message);
    } finally {
      setIsViewingId(null);
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
            <button className="nav-link" type="button" onClick={() => onNavigate?.("contacts")}>
              Contacts
            </button>
            <button className="nav-link is-active" type="button" onClick={() => onNavigate?.("documents")}>
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

      <main className="dashboard documents-page" aria-label="Documents workspace">
        <section className="documents-hero">
          <div>
            <h1 className="documents-title">Documents Workspace</h1>
            <p className="documents-subtitle">
              Upload, organize, replace, and manage job-search documents across tailored applications.
            </p>
          </div>

          <div className="documents-hero-actions">
            <span className="meta-pill">Total: {documents.length}</span>
            <button className="primary-btn" type="button" onClick={openCreateModal}>
              + New Document
            </button>
          </div>
        </section>

        <section className="controls documents-controls" aria-label="Documents controls">
          <div className="controls-row documents-controls-row">
            <div className="control control--search">
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, file name, linked application, notes..."
                aria-label="Search documents"
              />
            </div>

            <div className="control">
              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Type filter">
                <option value="all">Type: All</option>
                <option value="resume">Resume</option>
                <option value="cover_letter">Cover Letter</option>
                <option value="portfolio">Portfolio</option>
                <option value="reference">Reference</option>
                <option value="transcript">Transcript</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="control">
              <select value={linkFilter} onChange={(event) => setLinkFilter(event.target.value)} aria-label="Link filter">
                <option value="all">Link: All</option>
                <option value="linked">Linked</option>
                <option value="unlinked">Unlinked</option>
              </select>
            </div>
          </div>

          <div className="controls-row controls-row--secondary documents-controls-secondary">
            <div className="control">
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sort documents">
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Oldest</option>
                <option value="title">Title</option>
                <option value="type">Type</option>
              </select>
            </div>

            <div className="section-meta">
              <span className="meta-pill">Showing: {filtered.length}</span>
            </div>
          </div>
        </section>

        {apiError ? <div className="form-error" role="alert">{apiError}</div> : null}

        <section className="documents-list" aria-label="Documents list">
          {loading ? (
            <div className="documents-empty">Loading documents...</div>
          ) : !filtered.length ? (
            <div className="documents-empty">No documents match the current filters.</div>
          ) : (
            filtered.map((item) => (
              <article className="document-card" key={item.id}>
                <div className="document-card-row">
                  <div className="document-card-main">
                    <h3 className="document-title-item">{item.title}</h3>
                    <span className="document-pill">{toTitleCase(item.documentType)}</span>
                  </div>
                  <div className="document-actions">
                    <button
                      className="doc-action-btn"
                      type="button"
                      onClick={() => viewDocument(item)}
                      disabled={isViewingId === item.id}
                    >
                      {isViewingId === item.id ? "Loading..." : "View"}
                    </button>
                    <button className="doc-action-btn" type="button" onClick={() => openEditModal(item)}>
                      Edit
                    </button>
                    <button
                      className="doc-action-btn doc-action-btn--danger"
                      type="button"
                      onClick={() => confirmDelete(item)}
                      disabled={isDeletingId === item.id}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <p className="document-meta-line">
                  {toTitleCase(item.documentType)} • {item.uploadDate} • {item.fileName || "No file"} • {formatFileSize(item.fileSize)}{item.linkedApplication ? ` • ${item.linkedApplication}` : ""}
                </p>

                {item.notes ? <p className="document-notes">{item.notes}</p> : null}
              </article>
            ))
          )}
        </section>
      </main>

      {modalState.open ? (
        <DocumentModal title={modalState.editing ? "Edit Document" : "New Document"} onClose={closeModal}>
          <DocumentForm
            initial={modalState.editing ?? INITIAL_FORM}
            isEditing={Boolean(modalState.editing)}
            applications={applications}
            isSaving={isSaving}
            onSave={saveDocument}
            onCancel={closeModal}
          />
        </DocumentModal>
      ) : null}

      {deleteTarget ? (
        <DocumentModal title="Delete Document" onClose={() => setDeleteTarget(null)}>
          <p className="delete-confirm-copy">
            Delete <strong>{deleteTarget.title}</strong>? This action cannot be undone.
          </p>
          <div className="documents-modal-actions">
            <button
              className="ghost-btn"
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeletingId === deleteTarget.id}
            >
              Cancel
            </button>
            <button
              className="danger-btn"
              type="button"
              onClick={deleteDocument}
              disabled={isDeletingId === deleteTarget.id}
            >
              Delete
            </button>
          </div>
        </DocumentModal>
      ) : null}
    </>
  );
}
