import { useEffect, useState } from "react";
import Login from "./pages/login";
import Dashboard from "./pages/dashboard";

export default function App() {
  const [authStatus, setAuthStatus] = useState("loading");
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
          setAuthStatus("authenticated");
        }}
      />
    );
  }

  return (
    <Dashboard
      onLogout={() => {
        localStorage.removeItem("token");
        localStorage.removeItem("userEmail");
        setAuthStatus("unauthenticated");
      }}
    />
  );
}
