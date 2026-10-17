// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminApiError, parseRetryAfter } from '../../src/admin/api/client';
import { adminQueryRetry, adminRetryDelay } from '../../src/admin/api/retry';
import { createAdminQueryClient } from '../../src/admin/App';
import { loginPathFor } from '../../src/admin/auth/AdminSession';
import { AdminErrorBoundary } from '../../src/admin/components/ErrorBoundary';
import { ErrorState, PermissionDenied } from '../../src/admin/components/ui';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const error = (status: number, code: ConstructorParameters<typeof AdminApiError>[1], retryAfter: number | null = null) => new AdminApiError(status, code, code, retryAfter);

describe('retry policy', () => {
  it.each([
    [400, 'ADMIN_VALIDATION_FAILED'], [401, 'ADMIN_SESSION_EXPIRED'], [403, 'ADMIN_FORBIDDEN'], [404, 'ADMIN_NOT_FOUND'], [409, 'ADMIN_CONFLICT'], [422, 'ADMIN_VALIDATION_FAILED'],
  ] as const)('never retries terminal %i', (status, code) => {
    expect(adminQueryRetry(0, error(status, code))).toBe(false);
  });
  it('retries 429/503 once, only with Retry-After <= 10s, waiting exactly that long', () => {
    expect(adminQueryRetry(0, error(429, 'RATE_LIMIT_EXCEEDED', 3))).toBe(true);
    expect(adminQueryRetry(1, error(429, 'RATE_LIMIT_EXCEEDED', 3))).toBe(false);
    expect(adminQueryRetry(0, error(429, 'RATE_LIMIT_EXCEEDED', null))).toBe(false);
    expect(adminQueryRetry(0, error(503, 'RATE_LIMIT_UNAVAILABLE', 30))).toBe(false);
    expect(adminQueryRetry(0, error(503, 'ADMIN_AUDIT_UNAVAILABLE', 5))).toBe(true);
    expect(adminRetryDelay(0, error(429, 'RATE_LIMIT_EXCEEDED', 3))).toBe(3000);
  });
  it('retries other server and network failures twice with bounded backoff', () => {
    expect(adminQueryRetry(0, error(500, 'INTERNAL_SERVER_ERROR'))).toBe(true);
    expect(adminQueryRetry(1, error(0, 'ADMIN_UNAVAILABLE'))).toBe(true);
    expect(adminQueryRetry(2, error(500, 'INTERNAL_SERVER_ERROR'))).toBe(false);
    expect([0, 1, 2, 5].map((n) => adminRetryDelay(n, error(500, 'INTERNAL_SERVER_ERROR')))).toEqual([1000, 2000, 4000, 4000]);
  });
  it('the query client never retries mutations', () => {
    const client = createAdminQueryClient();
    expect(client.getDefaultOptions().mutations?.retry).toBe(false);
    expect(client.getDefaultOptions().queries?.retry).toBe(adminQueryRetry);
  });
  it('parses Retry-After seconds only', () => {
    expect(parseRetryAfter('30')).toBe(30);
    expect(parseRetryAfter(' 7 ')).toBe(7);
    expect(parseRetryAfter('Wed, 21 Oct 2026 07:28:00 GMT')).toBeNull();
    expect(parseRetryAfter(null)).toBeNull();
  });
});

describe('session failure routing', () => {
  it('maps each session code to its login reason', () => {
    expect(loginPathFor('ADMIN_SESSION_EXPIRED')).toBe('/login?reason=expired');
    expect(loginPathFor('ADMIN_SESSION_REVOKED')).toBe('/login?reason=revoked');
    expect(loginPathFor('ADMIN_ACCESS_DENIED')).toBe('/login?reason=access');
    expect(loginPathFor('ADMIN_UNAUTHENTICATED', true)).toBe('/login?reason=ended');
    expect(loginPathFor('ADMIN_UNAUTHENTICATED')).toBe('/login');
  });
});

describe('permission denied and error states', () => {
  it('the denied view names the missing permission and links back', () => {
    const html = renderToStaticMarkup(<MemoryRouter><PermissionDenied permission="billing.read" /></MemoryRouter>);
    expect(html).toContain('data-testid="admin-permission-missing"');
    expect(html).toContain('Xem thanh toán và gói đăng ký');
    expect(html).toContain('href="/"');
  });
  it('an API 403 inside an allowed screen renders the denied panel', () => {
    const html = renderToStaticMarkup(<MemoryRouter><ErrorState error={error(403, 'ADMIN_FORBIDDEN')} /></MemoryRouter>);
    expect(html).toContain('admin-permission-denied');
  });
  it('new server codes have Vietnamese copy', () => {
    for (const code of ['ADMIN_AUDIT_UNAVAILABLE', 'ADMIN_SCHEMA_MISMATCH', 'ADMIN_FIXTURE_DATA_REJECTED'] as const) {
      expect(renderToStaticMarkup(<MemoryRouter><ErrorState error={error(503, code)} /></MemoryRouter>)).not.toContain(code);
    }
  });
});

describe('error boundary', () => {
  afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });
  it('renders a sanitized fallback and recovers after retry', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;
    function Flaky() {
      if (shouldThrow) throw new Error('secret stack detail');
      return <p data-testid="recovered">ok</p>;
    }
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => { root.render(<AdminErrorBoundary><Flaky /></AdminErrorBoundary>); });
    expect(container.querySelector('[data-testid="admin-error-boundary"]')).not.toBeNull();
    expect(container.innerHTML).not.toContain('secret stack detail');
    shouldThrow = false;
    await act(async () => { container.querySelector('button')!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    expect(container.querySelector('[data-testid="recovered"]')).not.toBeNull();
    await act(async () => root.unmount());
  });
});
