import { authFetch, parseApiResponse } from "./api";

async function request(path, options = {}) {
  const response = await authFetch(path, options);
  const data = await parseApiResponse(response);

  if (!response.ok) {
    const fallback =
      response.status >= 500
        ? "Backend API unavailable. Make sure the server is running on port 3000."
        : `Request failed (HTTP ${response.status}).`;
    throw new Error(data.message || fallback);
  }

  return data;
}

export async function fetchApplications() {
  const data = await request("/api/jobs");
  return data.applications || [];
}

export async function createApplication(payload) {
  const data = await request("/api/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return data.job || data.application;
}

export async function updateApplication(applicationId, payload) {
  const data = await request(`/api/jobs/${applicationId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return data.job || data.application;
}

export async function deleteApplication(applicationId) {
  await request(`/api/jobs/${applicationId}`, {
    method: "DELETE",
  });
}
