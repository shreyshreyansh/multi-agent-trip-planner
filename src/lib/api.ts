import type { AuditMetrics, AuditRecord, TripPlanResponse } from '../../shared/contracts.js';

export async function planTrip(prompt: string): Promise<TripPlanResponse> {
  return requestJson<TripPlanResponse>('/api/trips/plan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
}

export async function fetchAudit(limit = 8): Promise<AuditRecord[]> {
  const payload = await requestJson<{ records: AuditRecord[] }>(`/api/audit?limit=${limit}`);
  return payload.records;
}

export async function fetchMetrics(): Promise<AuditMetrics> {
  return requestJson<AuditMetrics>('/api/metrics');
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }

  return payload as T;
}

function readErrorMessage(payload: unknown): string {
  if (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof payload.error === 'object' &&
    payload.error !== null &&
    'message' in payload.error &&
    typeof payload.error.message === 'string'
  ) {
    return payload.error.message;
  }

  return 'The trip planner could not complete the request.';
}
