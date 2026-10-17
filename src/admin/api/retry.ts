import { AdminApiError } from './client';

const MAX_SERVER_GUIDED_WAIT_SECONDS = 10;

/**
 * Query retry policy: terminal client errors (authorization, validation,
 * permission, conflict, not found) never retry; 429/503 retry once only when the
 * server says when; other failures retry twice with backoff. Mutations never
 * retry automatically (see createAdminQueryClient).
 */
export function adminQueryRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof AdminApiError) {
    if (error.status === 429 || error.status === 503) {
      return failureCount < 1 && error.retryAfterSeconds !== null && error.retryAfterSeconds <= MAX_SERVER_GUIDED_WAIT_SECONDS;
    }
    if (error.status >= 400 && error.status < 500) return false;
  }
  return failureCount < 2;
}

export function adminRetryDelay(failureCount: number, error: unknown): number {
  if (error instanceof AdminApiError && (error.status === 429 || error.status === 503) && error.retryAfterSeconds !== null) {
    return error.retryAfterSeconds * 1000;
  }
  return Math.min(1000 * 2 ** failureCount, 4000);
}
