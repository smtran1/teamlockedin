import { useEffect, useState } from "react";
import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import Applications from "./pages/applications";
import Reminders from "./pages/reminders";
import Contacts from "./pages/contacts";
import Documents from "./pages/documents";
import { getStoredToken, getStoredUserEmail, parseApiResponse } from "./lib/api";
import {
  createApplication,
  deleteApplication,
  fetchApplications,
  updateApplication,
} from "./lib/applicationsApi";

export default function App() {
  const [authStatus, setAuthStatus] = useState("loading");
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [pageState, setPageState] = useState({ applicationsEditingId: null });
  const [userEmail, setUserEmail] = useState(getStoredUserEmail());
  const [applications, setApplications] = useState([]);
  const [applicationsStatus, setApplicationsStatus] = useState("idle");
  const [applicationsError, setApplicationsError] = useState("");
  const [hasLoadedApplications, setHasLoadedApplications] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const token = getStoredToken();
      if (!token) {
        setAuthStatus("unauthenticated");
        setUserEmail("");
        return;
      }

      try {
        const response = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await parseApiResponse(response);

        if (response.ok && data.email) {
          setUserEmail(data.email);
          localStorage.setItem("userEmail", data.email);
          setAuthStatus("authenticated");
          return;
        }
      } catch {
        // Falls through to unauthenticated state.
      }

      setAuthStatus("unauthenticated");
      setUserEmail("");
    }

    checkAuth();
  }, []);

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }

    let cancelled = false;

    async function loadApplications() {
      setApplicationsStatus("loading");
      setApplicationsError("");
      setHasLoadedApplications(false);

      try {
        const nextApplications = await fetchApplications();
        if (!cancelled) {
          setApplications(nextApplications);
          setApplicationsStatus("ready");
          setHasLoadedApplications(true);
        }
      } catch (error) {
        if (!cancelled) {
          setApplications([]);
          setApplicationsStatus("error");
          setApplicationsError(error?.message || "Unable to load applications.");
          setHasLoadedApplications(true);
        }
      }
    }

    loadApplications();

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  if (authStatus === "loading") {
    return null;
  }

  if (authStatus === "unauthenticated") {
    return (
      <Login
        onLoginSuccess={() => {
          setCurrentPage("dashboard");
          setUserEmail(getStoredUserEmail());
          setAuthStatus("authenticated");
        }}
      />
    );
  }

  async function handleCreateApplication(payload) {
    const createdApplication = await createApplication(payload);
    setApplications((prev) => [{ ...createdApplication, doc_count: 0 }, ...prev]);
    return createdApplication;
  }

  async function handleUpdateApplication(applicationId, payload) {
    const updatedApplication = await updateApplication(applicationId, payload);
    setApplications((prev) =>
      prev.map((application) => {
        if (application.application_id !== applicationId) return application;
        return { ...updatedApplication, doc_count: application.doc_count };
      }),
    );
    return updatedApplication;
  }

  async function handleDeleteApplication(applicationId) {
    await deleteApplication(applicationId);
    setApplications((prev) =>
      prev.filter((application) => application.application_id !== applicationId),
    );
  }

  function handleNavigate(page, options = {}) {
    setCurrentPage(page);
    setPageState({
      applicationsEditingId: page === "applications" ? options.editingId ?? null : null,
    });
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    setApplications([]);
    setApplicationsStatus("idle");
    setApplicationsError("");
    setHasLoadedApplications(false);
    setUserEmail("");
    setCurrentPage("dashboard");
    setPageState({ applicationsEditingId: null });
    setAuthStatus("unauthenticated");
  }

  if (currentPage === "applications") {
    return (
      <Applications
        applications={applications}
        applicationsError={applicationsError}
        hasLoadedApplications={hasLoadedApplications}
        applicationsStatus={applicationsStatus}
        onCreateApplication={handleCreateApplication}
        onDeleteApplication={handleDeleteApplication}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
        onUpdateApplication={handleUpdateApplication}
        userEmail={userEmail}
        initialEditingId={pageState.applicationsEditingId}
      />
    );
  }

  if (currentPage === "reminders") {
    return <Reminders onLogout={handleLogout} onNavigate={handleNavigate} />;
  }

  if (currentPage === "contacts") {
    return <Contacts onLogout={handleLogout} onNavigate={handleNavigate} />;
  }

  if (currentPage === "documents") {
    return <Documents onLogout={handleLogout} onNavigate={handleNavigate} />;
  }

  return (
    <Dashboard
      applications={applications}
      applicationsError={applicationsError}
      hasLoadedApplications={hasLoadedApplications}
      applicationsStatus={applicationsStatus}
      onDeleteApplication={handleDeleteApplication}
      onLogout={handleLogout}
      onNavigate={handleNavigate}
      onUpdateApplication={handleUpdateApplication}
    />
  );
}
