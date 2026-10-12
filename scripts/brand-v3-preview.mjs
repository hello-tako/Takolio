import { createServer } from 'node:http';
import { readFile, realpath } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createServer as createViteServer } from 'vite';
import { seedT20Preview, t20RestrictionFixture } from './t20-preview-fixtures.mjs';
import { seedT13ReconciliationEvidence } from './t13-reconciliation-fixtures.mjs';
import { isolatedPreviewHtml } from './isolated-preview-html.mjs';
import {
  createPreviewCache,
  createPreviewControls,
  seedPlannerPreview, PREVIEW_USER_ID, PREVIEW_HOUSEHOLD_ID,
} from './planner-preview-fixtures.mjs';

const repo = fileURLToPath(new URL('../', import.meta.url));
const root = await realpath(resolve(repo, process.env.BRAND_BUILD_ROOT ?? 'dist/client'));
const port = Number(process.env.BRAND_PORT ?? 5230);
const origin = `http://127.0.0.1:${port}`;
const vite = await createViteServer({
  root: repo,
  appType: 'custom',
  logLevel: 'error',
  optimizeDeps: { noDiscovery: true, include: [] },
  plugins: [
    {
      name: 'ui14-isolated-email',
      enforce: 'pre',
      resolveId(id) {
        if (id === 'cloudflare:email') return '\0ui14-isolated-email';
      },
      load(id) {
        if (id === '\0ui14-isolated-email') return 'export class EmailMessage {}';
      },
    },
  ],
  server: { middlewareMode: true, hmr: false },
});
const { SqliteD1 } = await vite.ssrLoadModule('/tests/helpers/sqlite-d1.ts');
const { default: worker } = await vite.ssrLoadModule('/src/worker/index.ts');
const { recordInventoryObservation } = await vite.ssrLoadModule('/packages/db/src/inventory-observations.ts');
let db = new SqliteD1();
const operatorRequests = [];
let failInventoryReads = false;
seedPlannerPreview(db);
const planner = process.env.BRAND_PLANNER !== 'false';
const composition = process.env.BRAND_COMPOSITION !== 'false';
if (composition) seedT20Preview(db);
const env = {
  DB: db,
  CACHE: createPreviewCache(),
  ENVIRONMENT: 'development',
  APP_URL: origin,
  JWT_SECRET: 'isolated-local-preview-jwt-secret-no-production-use',
  OTP_HASH_SECRET: 'isolated-local-preview-otp-secret-no-production-use',
  AI_MOCK_MODE: 'true',
  SCAN_QUEUE_MODE: 'sync',
  MEAL_PLANNER_ENABLED: String(planner),
  MEAL_COMPOSITION_V2_ENABLED: String(composition),
  ...(process.env.BRAND_CATALOG_D1 === 'true' ? { RECIPE_CATALOG_MODE: 'd1', RECIPE_CATALOG_CUTOVER_ENABLED: 'true' } : {}),
};
const controls = createPreviewControls({
  getDatabase: () => db,
  getOperatorRequests: () => operatorRequests,
  seedReconciliation: () => seedT13ReconciliationEvidence(db, PREVIEW_HOUSEHOLD_ID, PREVIEW_USER_ID, recordInventoryObservation),
  setInventoryReadFailure: (failing) => { failInventoryReads = failing; },
  resetDatabase: () => {
    operatorRequests.length = 0;
    failInventoryReads = false;
    const fresh = new SqliteD1();
    seedPlannerPreview(fresh);
    if (composition) seedT20Preview(fresh);
    const previous = db;
    db = fresh;
    env.DB = fresh;
    env.CACHE = createPreviewCache();
    previous.close();
  },
});
globalThis.fetch = async () => {
  throw new Error('External network disabled in V3 isolated Worker');
};
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};
const cache = new Map();
let queue = Promise.resolve();
const server = createServer((request, response) => {
  queue = queue.then(async () => {
    try {
      const url = new URL(request.url, origin);
      if (url.pathname === '/__preview/measure' && request.method === 'GET') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end('<!doctype html><html lang=vi><title>Local measurement bootstrap</title><p>Local measurement bootstrap</p></html>');
        return;
      }
      if (url.pathname === '/__preview/ready' && request.method === 'GET') {
        response.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
        });
        response.end(
          '<!doctype html><html lang=vi><title>Local fixture ready</title><p role=status>Đang xác minh phiên thử nghiệm…</p><script src="/__preview/brand-session.js"></script></html>',
        );
        return;
      }
      if (url.pathname === '/__preview/brand-session.js' && request.method === 'GET') {
        response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
        response.end(`(async () => {
          const me = await fetch('/api/v1/me', { credentials: 'include' });
          if (!me.ok) throw new Error('Synthetic session verification failed');
          const { user } = await me.json();
          localStorage.clear(); sessionStorage.clear();
          const values = { frigo_user_id: user.id, frigo_household_id: user.household.id,
            frigo_email: user.email, frigo_display_name: user.displayName, frigo_is_guest: 'false' };
          for (const [key, value] of Object.entries(values)) localStorage.setItem(key, value);
          location.replace('/planner');
        })();`);
        return;
      }
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/__preview')) {
        const parts = [];
        for await (const chunk of request) parts.push(chunk);
        const req = new Request(url, {
          method: request.method,
          headers: request.headers,
          body: ['GET', 'HEAD'].includes(request.method) ? undefined : Buffer.concat(parts),
        });
        const armedReadFailure = failInventoryReads && req.method === 'GET'
          && /^\/api\/v1\/inventory(\/lots\/[^/]+)?$/.test(url.pathname);
        const result =
          (armedReadFailure ? Response.json({ error: 'Synthetic read failure', code: 'PREVIEW_READ_FAILURE' }, { status: 500 }) : null) ||
          (composition ? t20RestrictionFixture(db, req) : null) ||
          (await controls(req)) ||
          (await worker.fetch(req, env, {
            waitUntil(p) {
              p.catch(console.error);
            },
            passThroughOnException() {},
          }));
        if (['/api/v1/me', '/api/v1/inventory/adopt'].includes(url.pathname)) {
          operatorRequests.push({ method: req.method, path: url.pathname, status: result.status,
            expectedUser: req.headers.get('X-Frigo-Expected-User-Id') === PREVIEW_USER_ID,
            expectedHousehold: req.headers.get('X-Frigo-Expected-Household-Id') === PREVIEW_HOUSEHOLD_ID });
          if (operatorRequests.length > 100) operatorRequests.shift();
        }
        response.writeHead(result.status, Object.fromEntries(result.headers));
        response.end(Buffer.from(await result.arrayBuffer()));
        return;
      }
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405);
        response.end();
        return;
      }
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.includes('\0') || pathname.includes('\\')) {
        response.writeHead(400);
        response.end();
        return;
      }
      if (!extname(pathname)) pathname = '/index.html';
      if (!cache.has(pathname)) {
        const path = await realpath(resolve(root, '.' + pathname));
        if (!path.startsWith(root + '/')) {
          response.writeHead(404);
          response.end();
          return;
        }
        const original = await readFile(path);
        const bytes =
          pathname === '/index.html'
            ? Buffer.from(isolatedPreviewHtml(original.toString()))
            : original;
        const type = types[extname(pathname)] ?? 'application/octet-stream';
        cache.set(pathname, { bytes, gzip: gzipSync(bytes), type });
      }
      const item = cache.get(pathname);
      const compressed =
        /\bgzip\b/.test(request.headers['accept-encoding'] ?? '') &&
        /javascript|css|html|json|svg/.test(item.type);
      const bytes = compressed ? item.gzip : item.bytes;
      response.writeHead(200, {
        'Content-Type': item.type,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': pathname.startsWith('/assets/')
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
        'Content-Length': bytes.length,
        Vary: 'Accept-Encoding',
        ...(compressed ? { 'Content-Encoding': 'gzip' } : {}),
      });
      response.end(request.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      if (error.code === 'ENOENT') {
        response.writeHead(404);
        response.end('Not found');
      } else {
        console.error(error);
        response.writeHead(500);
        response.end('Isolated preview error');
      }
    }
  });
});
await new Promise((ok, fail) => {
  server.once('error', fail);
  server.listen(port, '127.0.0.1', ok);
});
console.log(
  `V3 production-build preview ${origin}; gzip/cache local policy, synthetic SQLite, external Worker fetch blocked; ${root}`,
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, async () => {
    await new Promise((ok) => server.close(ok));
    await vite.close();
    db.close();
  });
