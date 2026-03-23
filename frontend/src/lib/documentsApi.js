import { authFetch, parseApiResponse } from "./api";

async function request(path, options = {}) {
  const response = await authFetch(path, options);
  const data = await parseApiResponse(response);

  if (!response.ok) {
    const fallback =
      response.status >= 500
        ? "Service temporarily unavailable. Please try again later."
        : `Request failed (HTTP ${response.status}).`;
    throw new Error(data.message || fallback);
  }

  return data;
}

function mapDocument(doc) {
  const linkedApplications = doc.linked_applications
    ? doc.linked_applications.split("\x1f")
    : [];
  return {
    id: doc.document_id,
    title: doc.title,
    documentType: doc.document_type,
    uploadDate: doc.upload_date ? String(doc.upload_date).slice(0, 10) : "",
    notes: doc.notes || "",
    applicationIds: doc.application_ids
      ? String(doc.application_ids).split(",").map(Number)
      : [],
    linkedApplications,
    linkedApplication: linkedApplications.join(", "),
    fileName: doc.original_filename || "",
    fileSize: doc.file_size || 0,
    objectUrl: null,
  };
}

export async function fetchDocuments() {
  const data = await request("/api/documents");
  return (data.documents || []).map(mapDocument);
}

export async function fetchDocumentsForApplication(applicationId) {
  const data = await request(`/api/documents?application_id=${applicationId}`);
  return (data.documents || []).map(mapDocument);
}

export async function createDocument(form) {
  const formData = new FormData();
  formData.append("title", form.title);
  formData.append("document_type", form.documentType);
  formData.append("upload_date", form.uploadDate);
  if (form.notes) formData.append("notes", form.notes);
  formData.append("application_ids", JSON.stringify(form.applicationIds || []));
  if (form.file) formData.append("file", form.file);

  const data = await request("/api/documents", {
    method: "POST",
    body: formData,
  });

  return mapDocument(data.document);
}

export async function updateDocument(documentId, form) {
  const formData = new FormData();
  formData.append("title", form.title);
  formData.append("document_type", form.documentType);
  formData.append("upload_date", form.uploadDate);
  if (form.notes) formData.append("notes", form.notes);
  formData.append("application_ids", JSON.stringify(form.applicationIds || []));
  if (form.file) formData.append("file", form.file);

  await request(`/api/documents/${documentId}`, {
    method: "PUT",
    body: formData,
  });
}

export async function deleteDocument(documentId) {
  await request(`/api/documents/${documentId}`, {
    method: "DELETE",
  });
}

export async function unlinkDocumentFromApplication(documentId, applicationId) {
  await request(`/api/documents/${documentId}/applications/${applicationId}`, {
    method: "DELETE",
  });
}

// Issue #12: parse error response before attempting blob() so server errors surface correctly.
// The response body can only be consumed once, so we branch on ok before calling .blob().
export async function fetchDocumentBlob(documentId) {
  const response = await authFetch(`/api/documents/${documentId}/file`);
  if (!response.ok) {
    const data = await parseApiResponse(response);
    throw new Error(data.message || "Could not load file.");
  }
  return response.blob();
}
