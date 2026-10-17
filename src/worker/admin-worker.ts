import { Hono } from 'hono';
import { buildRequestTelemetry, createRequestCorrelation, emitRequestTelemetry } from './observability/request-telemetry';
import { adminRoutes } from './routes/admin';
import { adminSurfaceGate } from './routes/admin/auth';
import { adminSecurityHeaders } from './routes/admin/headers';
import type { AdminApp, AdminContext } from './routes/admin/http';

/**
 * Takosan Admin Console Worker (wrangler.admin.jsonc): a deployment boundary
 * separate from the customer Worker. Every request (documents, assets, API)
 * passes the surface gate first; assets are configured with run_worker_first so
 * the static asset layer can never answer for the admin app on its own.
 */
const app = new Hono<AdminApp>();

app.use('*', async (c, next) => {
  const { requestId, responseRequestId } = createRequestCorrelation(c.req.header('X-Request-Id'));
  c.set('requestId', requestId);
  const startedAt = Date.now();
  try {
    await next();
  } finally {
    c.header('X-Request-Id', responseRequestId);
    emitRequestTelemetry(buildRequestTelemetry({
      requestId, method: c.req.method, routePath: c.req.routePath, registeredRoutes: telemetryRouteTemplates,
      status: c.res.status, durationMs: Date.now() - startedAt, environment: c.env.ENVIRONMENT,
    }));
  }
});
app.use('*', adminSecurityHeaders);
app.use('*', adminSurfaceGate);

app.onError((_error, c) => {
  console.error(JSON.stringify({ level: 'error', requestId: c.get('requestId'), code: 'ADMIN_WORKER_ERROR' }));
  return c.text('Internal Server Error', 500);
});

app.route('/api/v1/admin', adminRoutes);

app.get('/', (c) => c.redirect('/admin/', 302));
app.get('/admin', (c) => c.redirect('/admin/', 302));

// Raw (still percent-encoded) pathname is matched, so encoded variants never reach ASSETS.
const STATIC_FILE = /^\/admin\/(?:assets\/[A-Za-z0-9][A-Za-z0-9_-]*\.(?:js|css|svg|png|woff2)|fonts\/[A-Za-z0-9][A-Za-z0-9-]*\.(?:woff2|txt)|favicon\.svg)$/;
const SHELL_PAGE = /^\/admin\/(?:login|users|households|billing|ai|recipes|system|audit|settings)\/?$/;
const SHELL_DETAIL = /^\/admin\/(?:users|recipes)\/([A-Za-z0-9_.:-]{1,128})\/?$/;

function isAdminShellRoute(pathname: string): boolean {
  if (pathname === '/admin' || pathname === '/admin/' || SHELL_PAGE.test(pathname)) return true;
  const identifier = SHELL_DETAIL.exec(pathname)?.[1];
  return identifier !== undefined && identifier !== '.' && identifier !== '..';
}

async function serveAdminFile(c: AdminContext) {
  const url = new URL(c.req.url);
  const pathname = url.pathname;
  if (pathname === '/admin/index.html') return c.redirect('/admin/', 302);
  const assets = c.env.ASSETS;
  if (!assets) return c.text('Admin Console assets are not attached.', 503);
  if (STATIC_FILE.test(pathname)) {
    const asset = await assets.fetch(new URL(pathname, url.origin).toString());
    if (!asset.ok) return c.text('Not Found', 404);
    return new Response(asset.body as ReadableStream, { status: 200, headers: { 'Content-Type': asset.headers.get('Content-Type') ?? 'application/octet-stream' } });
  }
  if (isAdminShellRoute(pathname)) {
    const shell = await assets.fetch(new URL('/admin/', url.origin).toString());
    if (!shell.ok) return c.text('Admin Console build is missing.', 503);
    return new Response(shell.body as ReadableStream, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  return c.text('Not Found', 404);
}
app.get('/admin/*', serveAdminFile);
app.all('*', (c) => c.text('Not Found', 404));

const telemetryRouteTemplates = new Set(app.routes.map((route) => route.path));

export default { fetch: app.fetch };
