import { useState } from "react";

export default function Login({ onLoginSuccess }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  async function parseResponse(response) {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return response.json().catch(() => ({}));
    }

    const raw = await response.text().catch(() => "");
    return raw ? { message: raw.slice(0, 180) } : {};
  }

  async function signInWithCredentials({ emailInput, passwordInput }) {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: emailInput.trim(),
        password: passwordInput,
      }),
    });

    const data = await parseResponse(response);

    if (!response.ok || !data.token) {
      const fallback =
        response.status >= 500
          ? "Backend API unavailable. Make sure the server is running on port 3000."
          : `Login failed (HTTP ${response.status}).`;
      throw new Error(data.message || fallback);
    }

    localStorage.setItem("token", data.token);
    localStorage.setItem("userEmail", emailInput.trim());
    onLoginSuccess?.();
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setInfo("");

    const formData = new FormData(e.currentTarget);
    const emailInput = String(formData.get("email") || "").trim();
    const passwordInput = String(formData.get("password") || "");
    const confirmPasswordInput = String(formData.get("confirmPassword") || "");

    setEmail(emailInput);
    setPassword(passwordInput);
    setConfirmPassword(confirmPasswordInput);

    const hasRequiredFields = mode === "create"
      ? emailInput.length > 0 && passwordInput.trim().length > 0 && confirmPasswordInput.trim().length > 0
      : emailInput.length > 0 && passwordInput.trim().length > 0;

    if (!hasRequiredFields) {
      setError(
        mode === "create"
          ? "Please enter email, password, and confirm password."
          : "Please enter an email and password."
      );
      return;
    }

    if (mode === "create" && passwordInput !== confirmPasswordInput) {
      setError("Passwords do not match.");
      return;
    }

    try {
      if (mode === "create") {
        const createRes = await fetch("/api/create-account", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: emailInput,
            password: passwordInput,
          }),
        });

        const createData = await parseResponse(createRes);
        if (!createRes.ok) {
          setError(createData.message || `Account creation failed (HTTP ${createRes.status}).`);
          return;
        }

        setInfo("Account created. Signing you in...");
      }

      await signInWithCredentials({ emailInput, passwordInput });
    } catch (err) {
      setError(
        err?.message
          || "Unable to reach backend API. Start backend server (`npm run dev`) on port 3000."
      );
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <h1 className="auth-title">{mode === "create" ? "Create account" : "Sign in"}</h1>
        <p className="auth-subtitle">
          {mode === "create"
            ? "Create an account, then you will be signed in automatically."
            : "Enter your credentials to access your dashboard."}
        </p>

        <form className="auth-form" onSubmit={onSubmit}>
          <label className="auth-label">
            Email
            <input
              className="auth-input"
              type="email"
              name="email"
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
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>

          {mode === "create" ? (
            <label className="auth-label">
              Confirm password
              <input
                className="auth-input"
                type="password"
                name="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
              />
            </label>
          ) : null}

          {error ? <div className="auth-error">{error}</div> : null}
          {info ? <div className="auth-footnote">{info}</div> : null}

          <button className="primary-btn auth-btn" type="submit">
            {mode === "create" ? "Create Account" : "Sign in"}
          </button>
        </form>

        <div className="auth-footnote">
          {mode === "create" ? "Already have an account?" : "Need an account?"}
          {" "}
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setMode((prev) => (prev === "create" ? "signin" : "create"));
              setError("");
              setInfo("");
              setPassword("");
              setConfirmPassword("");
            }}
          >
            {mode === "create" ? "Sign in instead" : "Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}
