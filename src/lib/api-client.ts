// Typed client for the app's REST endpoints (src/routes/api/**).
// Unwraps the resp.ts envelope: { code: 0 | -1, message, data? }.

import {
  WORKSPACE_MUTATION_HEADER,
  WORKSPACE_MUTATION_HEADER_VALUE,
} from './trusted-local-request';

export class ApiError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface PageResult<T> {
  items: T[];
  total: number;
}

export interface PageParams {
  page: number;
  pageSize: number;
  search?: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const isMutation = Boolean(init?.method && init.method !== 'GET');
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(isMutation
        ? { [WORKSPACE_MUTATION_HEADER]: WORKSPACE_MUTATION_HEADER_VALUE }
        : {}),
      ...init?.headers,
    },
  });
  const json = await res
    .json()
    .catch(() => ({ code: -1, message: res.statusText || 'Request failed' }));
  if (json.code !== 0) {
    throw new ApiError(json.code ?? -1, json.message || 'Request failed', json.data);
  }
  // respOk() omits data entirely — callers expecting void get undefined.
  return json.data as T;
}

async function requestJson<T>(
  url: string,
  init?: RequestInit,
  fallback = 'Request failed'
): Promise<T> {
  const isMutation = Boolean(init?.method && init.method !== 'GET');
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(isMutation
        ? { [WORKSPACE_MUTATION_HEADER]: WORKSPACE_MUTATION_HEADER_VALUE }
        : {}),
      ...init?.headers,
    },
  });
  const json = (await res.json().catch(() => null)) as
    | (Record<string, unknown> & { error?: string; message?: string })
    | null;

  if (!res.ok) {
    throw new ApiError(
      res.status,
      json?.error ?? json?.message ?? fallback,
      json
    );
  }

  return json as T;
}

export const apiGet = <T>(url: string) => request<T>(url);

export const apiPost = <T = void>(url: string, body?: unknown) =>
  request<T>(url, {
    method: 'POST',
    body: body == null ? undefined : JSON.stringify(body),
  });

export const apiPut = <T = void>(url: string, body?: unknown) =>
  request<T>(url, { method: 'PUT', body: JSON.stringify(body) });

export const apiPatch = <T = void>(url: string, body?: unknown) =>
  request<T>(url, { method: 'PATCH', body: JSON.stringify(body) });

export const apiDelete = <T = void>(url: string) =>
  request<T>(url, { method: 'DELETE' });

export const apiJsonGet = <T>(url: string, init?: RequestInit) =>
  requestJson<T>(url, init);

export const apiJsonPost = <T = void>(
  url: string,
  body?: unknown,
  init?: RequestInit
) =>
  requestJson<T>(url, {
    ...init,
    method: 'POST',
    body: body == null ? init?.body : JSON.stringify(body),
  });

export const apiJsonPut = <T = void>(
  url: string,
  body?: unknown,
  init?: RequestInit
) =>
  requestJson<T>(url, {
    ...init,
    method: 'PUT',
    body: body == null ? init?.body : JSON.stringify(body),
  });

export const apiJsonPatch = <T = void>(
  url: string,
  body?: unknown,
  init?: RequestInit
) =>
  requestJson<T>(url, {
    ...init,
    method: 'PATCH',
    body: body == null ? init?.body : JSON.stringify(body),
  });

export const apiJsonDelete = <T = void>(
  url: string,
  body?: unknown,
  init?: RequestInit
) =>
  requestJson<T>(url, {
    ...init,
    method: 'DELETE',
    body: body == null ? init?.body : JSON.stringify(body),
  });

// Query-string builder for paginated list endpoints.
export function pageQuery(base: string, p: PageParams) {
  const params = new URLSearchParams({
    page: String(p.page),
    pageSize: String(p.pageSize),
  });
  if (p.search) params.set('search', p.search);
  return `${base}?${params}`;
}
