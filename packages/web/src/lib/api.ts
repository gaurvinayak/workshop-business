import type { ErrorEnvelope } from '@workshopos/shared';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';

export class ApiError extends Error {
  code: string;
  fields?: Record<string, string>;
  constructor(env: ErrorEnvelope) {
    super(env.error.message);
    this.code = env.error.code;
    this.fields = env.error.fields;
  }
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new ApiError(
      body && body.error ? (body as ErrorEnvelope) : { error: { code: 'INTERNAL', message: res.statusText } },
    );
  }
  return body as T;
}

async function request<T>(method: string, path: string, payload?: unknown, retry = true): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    credentials: 'include',
    headers: payload !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });

  // Transparent one-shot refresh on an expired access token.
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    const refreshed = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (refreshed.ok) return request<T>(method, path, payload, false);
  }
  return parse<T>(res);
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
};
