import {
  ADMIN_API_BASE,
  ADMIN_CSRF_COOKIE,
  ADMIN_CSRF_HEADER,
  type AdminDataContext,
  type AdminEnvelope,
  type AdminErrorCode,
} from '@shared/admin';

const ERROR_CODES: readonly AdminErrorCode[] = [
  'ADMIN_UNAUTHENTICATED',
  'ADMIN_SESSION_EXPIRED',
  'ADMIN_SESSION_REVOKED',
  'ADMIN_FORBIDDEN',
  'ADMIN_CSRF_FAILED',
  'ADMIN_INVALID_CREDENTIALS',
  'ADMIN_AUTH_NOT_CONFIGURED',
  'ADMIN_ACCESS_DENIED',
  'ADMIN_VALIDATION_FAILED',
  'ADMIN_NOT_FOUND',
  'ADMIN_CONFLICT',
  'ADMIN_UNAVAILABLE',
  'RATE_LIMIT_EXCEEDED',
  'RATE_LIMIT_UNAVAILABLE',
  'INTERNAL_SERVER_ERROR',
];

export class AdminApiError extends Error {
  readonly status: number;
  readonly code: AdminErrorCode;

  constructor(status: number, code: AdminErrorCode, message: string) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
  }
}

export type AdminMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type AdminQueryValue = string | number | boolean | null | undefined;

export interface AdminRequestOptions {
  query?: Record<string, AdminQueryValue>;
  body?: unknown;
  signal?: AbortSignal;
  /** Login is exempt from the CSRF header; the server requires only a trusted Origin there. */
  skipCsrf?: boolean;
}

// In-memory fallback for the CSRF token returned by login (used when the cookie is not readable).
let memoryCsrfToken: string | null = null;

export function setMemoryCsrfToken(token: string | null): void {
  memoryCsrfToken = token;
}

export function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  for (const part of document.cookie.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== ADMIN_CSRF_COOKIE) continue;
    const value = decodeURIComponent(part.slice(separator + 1).trim());
    return value || null;
  }
  return null;
}

export function resolveCsrfToken(): string | null {
  return readCsrfCookie() ?? memoryCsrfToken;
}

type ContextListener = () => void;
let dataContext: AdminDataContext | null = null;
const contextListeners = new Set<ContextListener>();

/** Latest `context` returned by any admin response (environment and fixture marker). */
export function getAdminDataContext(): AdminDataContext | null {
  return dataContext;
}

export function subscribeAdminDataContext(listener: ContextListener): () => void {
  contextListeners.add(listener);
  return () => {
    contextListeners.delete(listener);
  };
}

function recordContext(candidate: unknown): void {
  if (!isRecord(candidate) || typeof candidate.environment !== 'string') return;
  if (!('fixtureDataset' in candidate)) return;
  dataContext = candidate as unknown as AdminDataContext;
  contextListeners.forEach((listener) => listener());
}

export type SessionFailureListener = (error: AdminApiError) => void;
const sessionFailureListeners = new Set<SessionFailureListener>();

// Endpoints that handle their own 401 (the login route, logout and the session guard on /me).
const SESSION_FAILURE_OWN_HANDLING = new Set(['/auth/login', '/auth/logout', '/me']);

/** Notified for 401 responses on ordinary admin requests so the shell can return to /login. */
export function onAdminSessionFailure(listener: SessionFailureListener): () => void {
  sessionFailureListeners.add(listener);
  return () => {
    sessionFailureListeners.delete(listener);
  };
}

export function isSessionFailure(error: unknown): error is AdminApiError {
  return (
    error instanceof AdminApiError &&
    (error.code === 'ADMIN_UNAUTHENTICATED' ||
      error.code === 'ADMIN_SESSION_EXPIRED' ||
      error.code === 'ADMIN_SESSION_REVOKED')
  );
}

function buildQueryString(query: AdminRequestOptions['query']): string {
  if (!query) return '';
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const text = params.toString();
  return text ? `?${text}` : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isErrorCode(value: unknown): value is AdminErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

function fallbackCode(status: number): AdminErrorCode {
  switch (status) {
    case 401:
      return 'ADMIN_UNAUTHENTICATED';
    case 403:
      return 'ADMIN_FORBIDDEN';
    case 404:
      return 'ADMIN_NOT_FOUND';
    case 409:
      return 'ADMIN_CONFLICT';
    case 429:
      return 'RATE_LIMIT_EXCEEDED';
    case 503:
      return 'ADMIN_UNAVAILABLE';
    default:
      return 'INTERNAL_SERVER_ERROR';
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function toApiError(status: number, payload: unknown): AdminApiError {
  const body = isRecord(payload) ? payload : {};
  const code = isErrorCode(body.code) ? body.code : fallbackCode(status);
  // The server message is Vietnamese and redacted; the UI renders its own copy per code.
  const message = typeof body.error === 'string' ? body.error : code;
  return new AdminApiError(status, code, message);
}

/** Single transport for every admin call: cookies, CSRF on writes, typed errors, no body logging. */
export async function adminFetch<T>(method: AdminMethod, path: string, options: AdminRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  let body: string | undefined;
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  if (method !== 'GET' && !options.skipCsrf) {
    const token = resolveCsrfToken();
    if (token) headers[ADMIN_CSRF_HEADER] = token;
  }

  let response: Response;
  try {
    response = await fetch(`${ADMIN_API_BASE}${path}${buildQueryString(options.query)}`, {
      method,
      headers,
      body,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new AdminApiError(0, 'ADMIN_UNAVAILABLE', 'Không kết nối được máy chủ quản trị.');
  }

  const payload = await readJson(response);
  if (!response.ok) {
    const error = toApiError(response.status, payload);
    if (error.status === 401 && !SESSION_FAILURE_OWN_HANDLING.has(path)) {
      sessionFailureListeners.forEach((listener) => listener(error));
    }
    throw error;
  }

  if (isRecord(payload)) recordContext(payload.context);
  return payload as T;
}

/** Returns the `data` member of a `{ data, context }` success envelope. */
export async function adminData<T>(method: AdminMethod, path: string, options?: AdminRequestOptions): Promise<T> {
  const envelope = await adminFetch<AdminEnvelope<T>>(method, path, options);
  return envelope.data;
}
