import type { CalculateResult, Device, Quantities } from "../types/index.ts";

// ApiError carries the backend's human-readable {error} message and HTTP status so
// the UI can surface a real message rather than a generic failure.
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  if (!res.ok) {
    let message = `request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // non-JSON error body; keep the generic message
    }
    throw new ApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export function fetchCatalog(signal?: AbortSignal): Promise<{ devices: Device[] }> {
  return request("/api/catalog", { signal });
}

export function calculate(
  quantities: Quantities,
  signal?: AbortSignal,
): Promise<CalculateResult> {
  return request("/api/calculate", {
    method: "POST",
    body: JSON.stringify({ quantities }),
    signal,
  });
}

export function saveSession(quantities: Quantities): Promise<{ code: string }> {
  return request("/api/sessions", {
    method: "POST",
    body: JSON.stringify({ quantities }),
  });
}

export function loadSession(
  code: string,
  signal?: AbortSignal,
): Promise<{ code: string; quantities: Quantities }> {
  return request(`/api/sessions/${encodeURIComponent(code)}`, { signal });
}