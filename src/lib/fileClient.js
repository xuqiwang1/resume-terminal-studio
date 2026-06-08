function desktopBridge() {
  if (typeof window === "undefined") return null;
  return window.desktopApp?.isDesktop ? window.desktopApp : null;
}

export function apiUrl(path) {
  const bridge = desktopBridge();
  if (!bridge?.bridgeBaseUrl) return path;
  return `${bridge.bridgeBaseUrl}${path}`;
}

export function authHeaders() {
  const token = desktopBridge()?.bridgeToken;
  return token ? { "x-resume-studio-token": token } : {};
}

export function eventSourceUrl(path) {
  const bridge = desktopBridge();
  if (!bridge?.bridgeBaseUrl) return path;
  const url = new URL(path, bridge.bridgeBaseUrl);
  if (bridge.bridgeToken) url.searchParams.set("token", bridge.bridgeToken);
  return url.toString();
}

export const contextApiUrlForTest = apiUrl;

function jsonHeaders() {
  return {
    "Content-Type": "application/json",
    ...authHeaders()
  };
}

export async function fetchBridgeHealth() {
  const response = await fetch(apiUrl("/api/health"), { headers: authHeaders() });
  if (!response.ok) throw new Error("Failed to fetch bridge health");
  return response.json();
}

export function isDesktopApp() {
  return typeof window !== "undefined" && Boolean(window.desktopApp?.isDesktop);
}

export async function fetchActiveResume() {
  const response = await fetch(apiUrl("/api/resume/active"), { headers: authHeaders() });
  if (!response.ok) throw new Error("Failed to fetch active resume");
  return response.json();
}

export async function fetchContext() {
  const response = await fetch(apiUrl("/api/context"), { headers: authHeaders() });
  if (!response.ok) throw new Error("Failed to fetch context");
  return response.json();
}

export async function syncContextSelection(selection) {
  const response = await fetch(apiUrl("/api/context/selection"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(selection)
  });
  if (!response.ok) throw new Error("Failed to sync context selection");
  return response.json();
}

export async function syncContextView(view) {
  const response = await fetch(apiUrl("/api/context/view"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(view)
  });
  if (!response.ok) throw new Error("Failed to sync context view");
  return response.json();
}

export async function syncContextDocument(document) {
  const response = await fetch(apiUrl("/api/context/document"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(document)
  });
  if (!response.ok) throw new Error("Failed to sync context document");
  return response.json();
}

export function subscribeResumeUpdates(onResume) {
  const source = new EventSource(eventSourceUrl("/api/resume/stream"));
  source.addEventListener("resume", (event) => {
    const payload = JSON.parse(event.data);
    onResume?.(payload.resume);
  });
  return () => source.close();
}

export async function fetchActivityState() {
  const response = await fetch(apiUrl("/api/activity/state"), { headers: authHeaders() });
  if (!response.ok) throw new Error("Failed to fetch activity state");
  return response.json();
}

export function subscribeActivityUpdates(handlers = {}) {
  const source = new EventSource(eventSourceUrl("/api/activity/stream"));
  source.addEventListener("state", (event) => {
    const payload = JSON.parse(event.data);
    handlers.state?.(payload);
  });
  source.addEventListener("activity", (event) => {
    const payload = JSON.parse(event.data);
    handlers.activity?.(payload);
  });
  return () => source.close();
}

export async function saveResumeToFile({ resume, fileName }) {
  const response = await fetch(apiUrl("/api/files/save"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ resume, fileName })
  });
  if (!response.ok) throw new Error("Failed to save resume");
  return response.json();
}

export async function listResumeFiles() {
  const response = await fetch(apiUrl("/api/files"), { headers: authHeaders() });
  if (!response.ok) throw new Error("Failed to list files");
  return response.json();
}

export async function listResumeHistory() {
  const response = await fetch(apiUrl("/api/resume/history"), { headers: authHeaders() });
  if (!response.ok) throw new Error("Failed to list resume history");
  return response.json();
}

export async function archiveCurrentResume(reason = "manual") {
  const response = await fetch(apiUrl("/api/resume/archive"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ reason })
  });
  if (!response.ok) throw new Error("Failed to archive resume");
  return response.json();
}

export async function createNewResume(reason = "new-resume") {
  const response = await fetch(apiUrl("/api/resume/new"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ reason })
  });
  if (!response.ok) throw new Error("Failed to create new resume");
  return response.json();
}

export async function openResumeArchive(fileName) {
  const response = await fetch(apiUrl("/api/resume/history/open"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ fileName })
  });
  if (!response.ok) throw new Error("Failed to open resume archive");
  return response.json();
}

export async function openResumeFile(fileName) {
  const response = await fetch(apiUrl("/api/files/open"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ fileName })
  });
  if (!response.ok) throw new Error("Failed to open file");
  return response.json();
}

export async function exportPdf() {
  if (window.desktopApp?.exportPdf) {
    const filePath = await window.desktopApp.exportPdf();
    return filePath;
  }
  // Browser fallback
  window.print();
}

export async function syncSelection({ fieldId, sectionId }) {
  const response = await fetch(apiUrl("/api/selection"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ fieldId, sectionId })
  });
  if (!response.ok) throw new Error("Failed to sync selection");
  return response.json();
}

export function subscribePendingUpdates(onPending) {
  const source = new EventSource(eventSourceUrl("/api/patch/stream"));
  source.addEventListener("pending", (event) => {
    const payload = JSON.parse(event.data);
    onPending?.(payload.pending || null);
  });
  return () => source.close();
}

export async function confirmPendingPatch(pendingId) {
  const response = await fetch(apiUrl("/api/patch/confirm"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ pendingId })
  });
  if (!response.ok) throw new Error("Failed to confirm patch");
  return response.json();
}

export async function rejectPendingPatch(pendingId) {
  const response = await fetch(apiUrl("/api/patch/reject"), {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ pendingId })
  });
  if (!response.ok) throw new Error("Failed to reject patch");
  return response.json();
}
