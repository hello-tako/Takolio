import { AdminApiError } from '../api/client';
import { vi } from '../i18n/vi';

export function errorMessage(error: unknown): string {
  if (error instanceof AdminApiError) return vi.errors[error.code];
  return vi.errorGeneric;
}

/** Copy for the login form; the invalid-credentials message is intentionally generic. */
export function loginErrorMessage(error: unknown): string {
  if (error instanceof AdminApiError) {
    switch (error.code) {
      case 'ADMIN_INVALID_CREDENTIALS':
        return vi.errors.ADMIN_INVALID_CREDENTIALS;
      case 'RATE_LIMIT_EXCEEDED':
        return vi.errors.RATE_LIMIT_EXCEEDED;
      case 'ADMIN_AUTH_NOT_CONFIGURED':
        return vi.errors.ADMIN_AUTH_NOT_CONFIGURED;
      case 'ADMIN_ACCESS_DENIED':
        return vi.errors.ADMIN_ACCESS_DENIED;
      default:
        return vi.auth.loginError;
    }
  }
  return vi.auth.loginError;
}

export function isConflict(error: unknown): boolean {
  return error instanceof AdminApiError && error.code === 'ADMIN_CONFLICT';
}
