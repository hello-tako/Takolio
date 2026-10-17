import { describe, expect, it, vi } from 'vitest';
import adminWorker from '../../src/worker/admin-worker';
import { IdParam } from '../../src/worker/routes/admin/schemas';

vi.mock('../../src/worker/routes/admin', async () => {
  const { Hono } = await import('hono');
  return { adminRoutes: new Hono() };
});
vi.mock('../../src/worker/routes/admin/auth', () => ({
  adminSurfaceGate: async (_context: unknown, next: () => Promise<void>) => next(),
}));
vi.mock('../../src/worker/routes/admin/headers', () => ({
  adminSecurityHeaders: async (_context: unknown, next: () => Promise<void>) => next(),
}));

const ORIGIN = 'http://127.0.0.1:8790';
const assetFetch = vi.fn(async (input: string | URL) => {
  const pathname = new URL(input).pathname;
  return new Response(pathname === '/admin/' ? '<!doctype html><title>Admin</title>' : 'asset', {
    status: 200,
  });
});

const env = {
  ASSETS: { fetch: assetFetch },
  ENVIRONMENT: 'test',
  ADMIN_CONSOLE_ENABLED: 'true',
  ADMIN_ORIGIN: ORIGIN,
  ADMIN_AUTH_MODE: 'password',
  CUSTOMER_APP_URL: 'http://127.0.0.1:8787',
};

async function request(path: string) {
  return adminWorker.fetch(new Request(`${ORIGIN}${path}`), env as never, {
    props: {},
    waitUntil() {},
    passThroughOnException() {},
  });
}

describe('Admin R2 SPA routing', () => {
  it.each([
    '/admin/',
    '/admin/login',
    '/admin/users',
    '/admin/households',
    '/admin/billing',
    '/admin/ai',
    '/admin/recipes',
    '/admin/system',
    '/admin/audit',
    '/admin/settings',
    '/admin/users/usr.abc',
    '/admin/users/usr:abc',
    '/admin/users/usr_v1-abc',
    '/admin/recipes/recipe:abc.v2',
  ])('serves the app shell for allowlisted route %s', async (path) => {
    const response = await request(path);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>Admin</title>');
  });

  it.each(['/admin/private', '/admin/users/usr.abc/extra', '/admin/users/%2e%2e%2fsettings'])(
    'does not serve the shell for an unknown or malformed route %s',
    async (path) => {
      expect((await request(path)).status).toBe(404);
    },
  );

  it('serves only the existing static asset namespaces', async () => {
    expect((await request('/admin/assets/index-a1b2.js')).status).toBe(200);
    expect((await request('/admin/fonts/admin-regular.woff2')).status).toBe(200);
    expect((await request('/admin/private/admin.js')).status).toBe(404);
  });

  it('validates API identifiers with the bounded route charset, excluding dot-only segments', () => {
    for (const value of ['usr_abc', 'usr.abc', 'usr:abc', 'a-b', 'x'.repeat(128)]) {
      expect(IdParam.safeParse(value).success, value).toBe(true);
    }
    for (const value of ['', '.', '..', 'a/b', 'a%2Fb', 'x'.repeat(129)]) {
      expect(IdParam.safeParse(value).success, value).toBe(false);
    }
  });

  it('does not turn arbitrary encoded files into app-shell responses', async () => {
    assetFetch.mockClear();
    expect((await request('/admin/assets/unlisted%2fadmin.js')).status).toBe(404);
    expect(assetFetch).not.toHaveBeenCalled();
  });
});
