import { useEffect, useMemo, useState } from "react";
import lockedInLogo from "../assets/lockedindark.png";
import "../styles/dashboard.css";
import "../styles/documents.css";

const SEED_DOCUMENTS = [
  {
    id: 1,
    title: "Amazon Data Analyst Resume",
    documentType: "resume",
    uploadDate: "2026-03-01",
    notes: "Tailored for SQL-heavy analytics role.",
    linkedApplication: "Amazon — Data Analyst",
    fileName: "amazon-data-analyst-resume.pdf",
    fileSize: 218004,
    objectUrl: null,
  },
  {
    id: 2,
    title: "Google SWE Cover Letter",
    documentType: "cover_letter",
    uploadDate: "2026-02-26",
    notes: "Highlights distributed systems project work.",
    linkedApplication: "Google — Software Engineer Intern",
    fileName: "google-swe-cover-letter.pdf",
    fileSize: 126530,
    objectUrl: null,
  },
];

const INITIAL_FORM = {
  id: null,
  title: "",
  documentType: "resume",
  uploadDate: "",
  notes: "",
  linkedApplication: "",
  file: null,
};

function normalize(value) {
  return String(value ?? "").toLowerCase().trim();
}

function formatDocumentType(value) {
  return String(value)
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatFileSize(bytes) {
  if (!bytes || Number.isNaN(Number(bytes))) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
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

function DocumentForm({ initial, isEditing, onSave, onCancel }) {
  const [form, setForm] = useState({
    ...initial,
    uploadDate: initial.uploadDate || todayDateString(),
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

    onSave({
      ...form,
      title: form.title.trim(),
      notes: form.notes.trim(),
      linkedApplication: form.linkedApplication.trim(),
    });
  }

  return (
    <form className="document-form" onSubmit={submitForm}>
      {error ? <div className="form-error">{error}</div> : null}

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

        <label className="form-field">
          <span className="form-label">Linked Application (Optional)</span>
          <input
            value={form.linkedApplication}
            onChange={(event) => updateField("linkedApplication", event.target.value)}
            placeholder="e.g., Amazon — Data Analyst"
          />
        </label>

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
        <button className="ghost-btn" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="primary-btn" type="submit">
          {isEditing ? "Update Document" : "Save Document"}
        </button>
      </div>
    </form>
  );
}

export default function Documents({ onLogout, onNavigate }) {
  const [documents, setDocuments] = useState(SEED_DOCUMENTS);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [linkFilter, setLinkFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const [modalState, setModalState] = useState({ open: false, editing: null });
  const [deleteTarget, setDeleteTarget] = useState(null);

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

  function saveDocument(payload) {
    const nextFile = payload.file;
    const nextObjectUrl = nextFile ? URL.createObjectURL(nextFile) : payload.objectUrl ?? null;

    if (payload.id == null) {
      const nextId = Math.max(0, ...documents.map((item) => item.id)) + 1;
      const created = {
        id: nextId,
        title: payload.title,
        documentType: payload.documentType,
        uploadDate: payload.uploadDate,
        notes: payload.notes,
        linkedApplication: payload.linkedApplication,
        fileName: nextFile ? nextFile.name : "Uploaded file",
        fileSize: nextFile ? nextFile.size : 0,
        objectUrl: nextObjectUrl,
      };
      setDocuments((prev) => [created, ...prev]);
      closeModal();
      return;
    }

    setDocuments((prev) =>
      prev.map((item) => {
        if (item.id !== payload.id) return item;

        if (nextFile && item.objectUrl) {
          URL.revokeObjectURL(item.objectUrl);
        }

        return {
          ...item,
          title: payload.title,
          documentType: payload.documentType,
          uploadDate: payload.uploadDate,
          notes: payload.notes,
          linkedApplication: payload.linkedApplication,
          fileName: nextFile ? nextFile.name : item.fileName,
          fileSize: nextFile ? nextFile.size : item.fileSize,
          objectUrl: nextFile ? nextObjectUrl : item.objectUrl,
        };
      })
    );

    closeModal();
  }

  function confirmDelete(document) {
    setDeleteTarget(document);
  }

  function deleteDocument() {
    if (!deleteTarget) return;

    if (deleteTarget.objectUrl) {
      URL.revokeObjectURL(deleteTarget.objectUrl);
    }

    setDocuments((prev) => prev.filter((item) => item.id !== deleteTarget.id));
    setDeleteTarget(null);
  }

  function viewDocument(document) {
    if (document.objectUrl) {
      window.open(document.objectUrl, "_blank", "noopener,noreferrer");
      return;
    }

    window.alert("This seeded document has metadata only. Upload/replace it to enable preview.");
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

        <section className="documents-list" aria-label="Documents list">
          {!filtered.length ? (
            <div className="documents-empty">No documents match the current filters.</div>
          ) : (
            filtered.map((item) => (
              <article className="document-card" key={item.id}>
                <div className="document-head">
                  <div>
                    <h3 className="document-title-item">{item.title}</h3>
                    <p className="document-submeta">
                      {formatDocumentType(item.documentType)} • Uploaded {item.uploadDate}
                    </p>
                  </div>
                  <span className="document-pill">{formatDocumentType(item.documentType)}</span>
                </div>

                <div className="document-details-grid">
                  <div>File: {item.fileName || "No file"}</div>
                  <div>Size: {formatFileSize(item.fileSize)}</div>
                  <div>Linked App: {item.linkedApplication || "Not linked"}</div>
                </div>

                {item.notes ? <p className="document-notes">{item.notes}</p> : null}

                <div className="document-actions">
                  <button className="ghost-btn" type="button" onClick={() => viewDocument(item)}>
                    View
                  </button>
                  <button className="ghost-btn" type="button" onClick={() => openEditModal(item)}>
                    Replace / Edit
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
        <DocumentModal title={modalState.editing ? "Edit Document" : "New Document"} onClose={closeModal}>
          <DocumentForm
            initial={modalState.editing ?? INITIAL_FORM}
            isEditing={Boolean(modalState.editing)}
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
            <button className="ghost-btn" type="button" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button className="danger-btn" type="button" onClick={deleteDocument}>
              Delete
            </button>
          </div>
        </DocumentModal>
      ) : null}
    </>
  );
}
