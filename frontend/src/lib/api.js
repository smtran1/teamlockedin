export function getStoredToken() {
  return localStorage.getItem("token") || "";
}

export function getStoredUserEmail() {
  return localStorage.getItem("userEmail") || "";
}

export async function parseApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }

  const raw = await response.text().catch(() => "");
  return raw ? { message: raw.slice(0, 180) } : {};
}

export async function authFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = getStoredToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  return fetch(path, {
    ...options,
    headers,
  });
}
