import { useMemo, useState } from "react";

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && password.trim().length > 0;
  }, [email, password]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Please enter an email and password.");
      return;
    }

    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      let data = {};

      if (contentType.includes("application/json")) {
        data = await response.json().catch(() => ({}));
      } else {
        const raw = await response.text().catch(() => "");
        if (raw) {
          data = { message: raw.slice(0, 180) };
        }
      }

      if (!response.ok || !data.token) {
        const fallback =
          response.status >= 500
            ? "Backend API unavailable. Make sure the server is running on port 3000."
            : `Login failed (HTTP ${response.status}).`;
        setError(data.message || fallback);
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("userEmail", email.trim());
      onLoginSuccess?.();
    } catch {
      setError("Unable to reach backend API. Start backend server (`npm run dev`) on port 3000.");
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="auth-title">Sign in</h1>
        <p className="auth-subtitle">Enter your credentials to access your dashboard.</p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label className="auth-label">
            Email
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              placeholder="you@example.com"
            />
          </label>

          <label className="auth-label">
            Password
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>

          {error ? <div className="auth-error">{error}</div> : null}

          <button className="primary-btn auth-btn" type="submit" disabled={!canSubmit}>
            Sign in
          </button>
        </form>

        <div className="auth-footnote">Sign in with your backend account credentials.</div>
      </div>
    </div>
  );
}
