// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdminApiError,
  adminFetch,
  getAdminDataContext,
  onAdminSessionFailure,
  setMemoryCsrfToken,
} from '../../src/admin/api/client';

function setCookieString(value: string) {
  Object.defineProperty(document, 'cookie', { configurable: true, get: () => value });
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function lastInit(fetchMock: ReturnType<typeof vi.fn>): RequestInit & { headers: Record<string, string> } {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error('fetch was not called');
  return call[1] as RequestInit & { headers: Record<string, string> };
}

describe('admin API client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setMemoryCsrfToken(null);
    fetchMock = vi.fn(async () => jsonResponse(200, { data: { ok: true }, context: { environment: 'test', generatedAt: '2026-10-12T00:00:00.000Z', fixtureDataset: null } }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete (document as unknown as { cookie?: string }).cookie;
    setMemoryCsrfToken(null);
  });

  it('attaches X-Admin-CSRF from memory on writes, never on reads, and never from a cookie', async () => {
    // A cookie with the legacy name must be ignored: the token lives in memory only.
    setCookieString('theme=dark; __Host-takosan_admin_csrf=cookie-token');
    await adminFetch('PUT', '/preferences', { body: { density: 'compact' } });
    expect(lastInit(fetchMock).headers['X-Admin-CSRF']).toBeUndefined();

    setMemoryCsrfToken('memory-token');
    await adminFetch('GET', '/me');
    expect(lastInit(fetchMock).headers['X-Admin-CSRF']).toBeUndefined();
    expect(lastInit(fetchMock).credentials).toBe('same-origin');

    await adminFetch('PUT', '/preferences', { body: { density: 'compact' } });
    const init = lastInit(fetchMock);
    expect(init.headers['X-Admin-CSRF']).toBe('memory-token');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ density: 'compact' }));
    expect(String(fetchMock.mock.calls.at(-1)?.[0])).toBe('/api/v1/admin/preferences');
  });

  it('clears the in-memory token on any 401', async () => {
    setMemoryCsrfToken('memory-token');
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { error: 'revoked', code: 'ADMIN_SESSION_REVOKED' }));
    await expect(adminFetch('GET', '/users')).rejects.toBeInstanceOf(AdminApiError);
    await adminFetch('POST', '/recipes/r1/reviews', { body: { state: 'draft' } });
    expect(lastInit(fetchMock).headers['X-Admin-CSRF']).toBeUndefined();
  });

  it('does not send the CSRF header on login', async () => {
    setCookieString('__Host-takosan_admin_csrf=stale');
    await adminFetch('POST', '/auth/login', { skipCsrf: true });
    expect(lastInit(fetchMock).headers['X-Admin-CSRF']).toBeUndefined();
  });

  it('maps error bodies to AdminApiError with the server code', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(409, { error: 'Xung đột phiên bản', code: 'ADMIN_CONFLICT' }));
    const error = await adminFetch('POST', '/recipes/r1/reviews', { body: {} }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AdminApiError);
    expect(error).toMatchObject({ status: 409, code: 'ADMIN_CONFLICT' });
  });

  it('derives a code from the status when the body is not a known error envelope', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>proxy error</html>', { status: 503 }));
    const error = await adminFetch('GET', '/auth/config').catch((caught: unknown) => caught);
    expect(error).toMatchObject({ status: 503, code: 'ADMIN_UNAVAILABLE' });
  });

  it('reports network failures as ADMIN_UNAVAILABLE', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const error = await adminFetch('GET', '/me').catch((caught: unknown) => caught);
    expect(error).toMatchObject({ status: 0, code: 'ADMIN_UNAVAILABLE' });
  });

  it('notifies session listeners on 401 for ordinary requests but not for /me or login', async () => {
    const listener = vi.fn();
    const unsubscribe = onAdminSessionFailure(listener);
    fetchMock.mockResolvedValue(jsonResponse(401, { error: 'expired', code: 'ADMIN_SESSION_EXPIRED' }));

    await adminFetch('GET', '/overview').catch(() => undefined);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0]?.[0]).toMatchObject({ code: 'ADMIN_SESSION_EXPIRED' });

    await adminFetch('GET', '/me').catch(() => undefined);
    await adminFetch('POST', '/auth/login', { skipCsrf: true }).catch(() => undefined);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('records the response context used by the fixture banner', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        data: {},
        context: { environment: 'staging', generatedAt: '2026-10-12T00:00:00.000Z', fixtureDataset: 'takosan-demo-v1' },
      }),
    );
    await adminFetch('GET', '/overview');
    expect(getAdminDataContext()).toMatchObject({ environment: 'staging', fixtureDataset: 'takosan-demo-v1' });
  });
});
