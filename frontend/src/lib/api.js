export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("userEmail");
}

export function getAuthHeaders(extraHeaders = {}) {
  const token = localStorage.getItem("token");

  return {
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function authenticatedFetch(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: getAuthHeaders(options.headers || {}),
  });

  if (response.status === 401 || response.status === 403) {
    clearAuth();
    window.location.reload();
    throw new Error("Your session expired. Please sign in again.");
  }

  return response;
}

export async function getReminders() {
  const response = await authenticatedFetch("/api/reminders");
  if (!response.ok) {
    throw new Error("Failed to load reminders.");
  }
  return response.json();
}

export async function createReminder(payload) {
  const response = await authenticatedFetch("/api/reminders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to create reminder.");
  }

  return data;
}

export async function updateReminder(id, payload) {
  const response = await authenticatedFetch(`/api/reminders/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Failed to update reminder.");
  }

  return data;
}

export async function deleteReminder(reminderId) {
  const response = await authenticatedFetch(`/api/reminders/${reminderId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    let message = "Failed to delete reminder.";

    try {
      const errorData = await response.json();
      message = errorData.message || message;
    } catch {
      // leave default message
    }

    throw new Error(message);
  }

  return true;
}
export async function getContacts() {
  const response = await authenticatedFetch("/api/contacts");
  if (!response.ok) {
    throw new Error("Failed to load contacts.");
  }
  return response.json();
}

export async function createContact(payload) {
  const response = await authenticatedFetch("/api/contacts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to create contact.");
  }
  return data;
}

export async function updateContact(id, payload) {
  const response = await authenticatedFetch(`/api/contacts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Failed to update contact.");
  }
  return data;
}

export async function deleteContact(contactId) {
  const response = await authenticatedFetch(`/api/contacts/${contactId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    let message = "Failed to delete contact.";
    try {
      const errorData = await response.json();
      message = errorData.message || message;
    } catch {
      // leave default message
    }
    throw new Error(message);
  }
  return true;
}

export async function getNotifications() {
  const response = await authenticatedFetch('/api/notifications');
  if (!response.ok) throw new Error('Failed to load notifications.');
  return response.json();
}

export async function markAllNotificationsRead() {
  const response = await authenticatedFetch('/api/notifications/read-all', { method: 'PUT' });
  if (!response.ok) throw new Error('Failed to mark notifications as read.');
  return response.json();
}

export async function clearNotifications() {
  const response = await authenticatedFetch('/api/notifications', { method: 'DELETE' });
  if (!response.ok) throw new Error('Failed to clear notifications.');
  return response.json();
}

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

export async function getDashboardPreferences() {
  const response = await authenticatedFetch('/api/dashboard-preferences');
  if (!response.ok) throw new Error('Failed to load dashboard preferences.');
  return response.json();
}

export async function saveDashboardPreferences(metrics) {
  const response = await authenticatedFetch('/api/dashboard-preferences', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metrics }),
  });
  if (!response.ok) throw new Error('Failed to save dashboard preferences.');
  return response.json();
}