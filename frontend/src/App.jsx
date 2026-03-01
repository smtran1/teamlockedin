import { useEffect, useState } from "react";
import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import Applications from "./pages/applications";
import Reminders from "./pages/reminders";

export default function App() {
  const [authStatus, setAuthStatus] = useState("loading");
  const [currentPage, setCurrentPage] = useState("dashboard");
  // loading | authenticated | unauthenticated

  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem("token");
      if (!token) {
        setAuthStatus("unauthenticated");
        return;
      }

      try {
        const res = await fetch("/api/auth/me", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (res.ok) {
          setAuthStatus("authenticated");
        } else {
          setAuthStatus("unauthenticated");
        }
      } catch {
        setAuthStatus("unauthenticated");
      }
    }

    checkAuth();
  }, []);

  if (authStatus === "loading") {
    return null; // or loading spinner
  }

  if (authStatus === "unauthenticated") {
    return (
      <Login
        onLoginSuccess={() => {
          setCurrentPage("dashboard");
          setAuthStatus("authenticated");
        }}
      />
    );
  }

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userEmail");
    setCurrentPage("dashboard");
    setAuthStatus("unauthenticated");
  };

  if (currentPage === "applications") {
    return <Applications onLogout={handleLogout} onNavigate={setCurrentPage} />;
  }

  if (currentPage === "reminders") {
    return <Reminders onLogout={handleLogout} onNavigate={setCurrentPage} />;
  }

  return <Dashboard onLogout={handleLogout} onNavigate={setCurrentPage} />;
}
