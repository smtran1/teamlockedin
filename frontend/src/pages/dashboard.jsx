import { useMemo, useState } from "react";

const SEED_APPLICATIONS = [
  {
    id: 1,
    title: "Software Engineer Intern",
    company: "Google",
    location: "Mountain View, CA",
    status: "Interviewing",
    next: "Interview • Feb 28, 2:00 PM",
    docs: 2,
    contacts: 1,
  },
  {
    id: 2,
    title: "Marketing Coordinator",
    company: "Amazon",
    location: "Seattle, WA",
    status: "Applied",
    next: "Follow-up • Feb 26",
    docs: 1,
    contacts: 1,
  },
  {
    id: 3,
    title: "Data Analyst",
    company: "Amazon",
    location: "Remote",
    status: "Offer",
    next: "Review offer",
    docs: 2,
    contacts: 2,
  },
  {
    id: 4,
    title: "UX Designer",
    company: "Boeing",
    location: "Everett, WA",
    status: "Saved",
    next: "Apply",
    docs: 1,
    contacts: 0,
  },
  {
    id: 5,
    title: "Project Manager",
    company: "Microsoft",
    location: "Redmond, WA",
    status: "Rejected",
    next: "Archive",
    docs: 1,
    contacts: 0,
  },
  {
    id: 6,
    title: "Business Analyst",
    company: "Chase",
    location: "Tempe, AZ",
    status: "Applied",
    next: "Follow-up",
    docs: 2,
    contacts: 1,
  },
];

const SEED_REMINDERS = [
  { id: 1, date: "Feb 26", text: "Follow-up Call (Amazon)", applicationId: 2 },
  { id: 2, date: "Feb 28", text: "Interview (Google)", applicationId: 1 },
  { id: 3, date: "Mar 1", text: "Application Deadline (Microsoft)", applicationId: 5 },
];

function normalize(value) {
  return String(value ?? "").toLowerCase().trim();
}

function StatusPill({ status }) {
  const normalized = normalize(status).replace(/\s+/g, "-");
  const className = `status-pill status-${normalized}`;
  return <span className={className}>{status}</span>;
}

function ApplicationCard({ app, onOpenDetails, onDelete }) {
  return (
    <article
      className="app-card"
      tabIndex={0}
      role="button"
      aria-label={`Open ${app.title} at ${app.company}`}
      onClick={() => onOpenDetails(app)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpenDetails(app);
      }}
    >
      <div className="app-card-header">
        <h3 className="app-title">{app.title}</h3>
        <StatusPill status={app.status} />
      </div>

      <div className="app-meta">
        {app.company} • {app.location}
      </div>

      <div className="app-line">Next: {app.next}</div>
      <div className="app-line">
        Docs: {app.docs} • Contacts: {app.contacts}
      </div>

      <div className="app-actions" onClick={(e) => e.stopPropagation()}>
        <button className="ghost-btn" type="button" onClick={() => onOpenDetails(app)}>
          View
        </button>
        <button className="ghost-btn" type="button" disabled>
          Edit
        </button>
        <button className="danger-btn" type="button" onClick={() => onDelete(app.id)}>
          Delete
        </button>
      </div>
    </article>
  );
}

export default function Dashboard({ onLogout }) {
  const [applications, setApplications] = useState(SEED_APPLICATIONS);
  const [reminders, setReminders] = useState(SEED_REMINDERS);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [viewMode, setViewMode] = useState("cards");

  const metrics = useMemo(() => {
    return {
      totalApplications: applications.length,
      activeContacts: applications.reduce((sum, a) => sum + (a.contacts || 0), 0),
      setReminders: reminders.length,
    };
  }, [applications, reminders]);

  const filteredApplications = useMemo(() => {
    const q = normalize(query);

    let list = applications.filter((a) => {
      const matchesQuery =
        !q ||
        normalize(a.title).includes(q) ||
        normalize(a.company).includes(q) ||
        normalize(a.location).includes(q);

      const matchesStatus = statusFilter === "all" ? true : normalize(a.status) === statusFilter;

      return matchesQuery && matchesStatus;
    });

    // With no createdAt yet, seed order represents "Newest".
    if (sortBy === "oldest") list = [...list].reverse();
    if (sortBy === "company") list = [...list].sort((x, y) => x.company.localeCompare(y.company));
    if (sortBy === "status") list = [...list].sort((x, y) => x.status.localeCompare(y.status));

    return list;
  }, [applications, query, statusFilter, sortBy]);

  function handleAddApplication() {
    const nextId = Math.max(0, ...applications.map((a) => a.id)) + 1;
    const newApp = {
      id: nextId,
      title: "New Application",
      company: "Company",
      location: "Location",
      status: "Saved",
      next: "Set next step",
      docs: 0,
      contacts: 0,
    };
    setApplications((prev) => [newApp, ...prev]);
  }

  function handleOpenDetails(app) {
    // Prototype: detailed job view becomes a route later.
    window.alert(`Detailed Job View (prototype)\n\n${app.title}\n${app.company} • ${app.location}`);
  }

  function handleDelete(appId) {
    setApplications((prev) => prev.filter((a) => a.id !== appId));
    setReminders((prev) => prev.filter((r) => r.applicationId !== appId));
  }

  function handleRefresh() {
    setApplications(SEED_APPLICATIONS);
    setReminders(SEED_REMINDERS);
    setQuery("");
    setStatusFilter("all");
    setSortBy("newest");
    setViewMode("cards");
  }

  const iconBtnInline = { lineHeight: 0 };
  const iconSvgInline = { display: "block" };

  return (
    <>
      <header className="top-nav">
        <div className="top-nav-inner">
          <div className="brand">
            <span className="brand-dot" aria-hidden="true" />
            <span className="brand-name">LockedIn Tracker</span>
          </div>

          <nav className="nav-links" aria-label="Primary">
            <a className="nav-link is-active" href="#">
              Dashboard
            </a>
            <a className="nav-link" href="#">
              Applications
            </a>
            <a className="nav-link" href="#">
              Reminders
            </a>
            <a className="nav-link" href="#">
              Contacts
            </a>
            <a className="nav-link" href="#">
              Documents
            </a>
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
            <div className="metric-label">Active Contacts</div>
            <div className="metric-value">{metrics.activeContacts}</div>
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
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search company, title, location..."
                aria-label="Search"
              />
            </div>

            <div className="control">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
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

            <button className="primary-btn" type="button" onClick={handleAddApplication}>
              + Add Application
            </button>
          </div>

          <div className="controls-row controls-row--secondary">
            <div className="control">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort">
                <option value="newest">Sort: Newest</option>
                <option value="oldest">Oldest</option>
                <option value="company">Company</option>
                <option value="status">Status</option>
              </select>
            </div>

            <div className="control">
              <select value={viewMode} onChange={(e) => setViewMode(e.target.value)} aria-label="View">
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
              <button className="ghost-btn" type="button" onClick={handleRefresh}>
                Refresh
              </button>
            </div>
          </div>
        </section>

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
            ) : filteredApplications.length ? (
              <div className="cards">
                {filteredApplications.map((app) => (
                  <ApplicationCard
                    key={app.id}
                    app={app}
                    onOpenDetails={handleOpenDetails}
                    onDelete={handleDelete}
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
                {reminders.map((r) => (
                  <li className="reminder-item" key={r.id}>
                    <span className="reminder-date">{r.date}</span>
                    {r.text}
                  </li>
                ))}
              </ul>
            )}

            <div className="panel-footnote">Detailed Job View opens when you click a card.</div>
          </aside>
        </section>
      </main>
    </>
  );
}
