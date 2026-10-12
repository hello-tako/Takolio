#!/usr/bin/env node
// Isolated Admin Console preview: the real Worker (src/worker/index.ts) serves
// both /api/v1/admin/* and the built admin frontend through an ASSETS binding
// that emulates Workers static assets over dist/client. In-memory SQLite D1
// with all migrations + the synthetic fixture. No Cloudflare bindings,
// credentials, or external network.
import { createServer as createHttpServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { createPreviewCache } from './planner-preview-fixtures.mjs';
import { assertLocalProvisioningAllowed, buildAdminFixtureSql } from './admin-local-lib.mjs';

assertLocalProvisioningAllowed({ argv: ['--local'] });
const port = Number(process.env.PORT || 8790);
const root = path.resolve(import.meta.dirname, '..');
const client = path.join(root, 'dist', 'client');
if (!existsSync(path.join(client, 'admin', 'index.html'))) {
  console.error('dist/client/admin/index.html is missing; run `pnpm build:web` first.');
  process.exit(1);
}

const vite = await createViteServer({
  root,
  server: { middlewareMode: true, hmr: false },
  appType: 'custom',
  plugins: [{ name: 'isolated-email', enforce: 'pre',
    resolveId(id) { if (id === 'cloudflare:email') return '\0isolated-email'; },
    load(id) { if (id === '\0isolated-email') return 'export class EmailMessage {}'; } }],
});
const { SqliteD1 } = await vite.ssrLoadModule('/tests/helpers/sqlite-d1.ts');
const { default: worker } = await vite.ssrLoadModule('/src/worker/index.ts');

const CONTENT_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.json': 'application/json', '.map': 'application/json',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };

// Emulates wrangler assets: html_handling auto-trailing-slash, SPA not-found handling.
const assets = {
  async fetch(input) {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const pathname = decodeURIComponent(url.pathname);
    const candidates = pathname.endsWith('/') ? [`${pathname}index.html`] : [pathname, `${pathname}/index.html`, `${pathname}.html`];
    for (const candidate of candidates) {
      const file = path.join(client, candidate);
      if (!file.startsWith(client)) break;
      if (existsSync(file) && statSync(file).isFile()) {
        return new Response(readFileSync(file), { headers: { 'Content-Type': CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream' } });
      }
    }
    return new Response(readFileSync(path.join(client, 'index.html')), { headers: { 'Content-Type': CONTENT_TYPES['.html'] } });
  },
};

function freshDatabase() {
  const db = new SqliteD1();
  db.seed(buildAdminFixtureSql());
  return db;
}
let db = freshDatabase();
const env = { DB: db, CACHE: createPreviewCache(), ASSETS: assets, ENVIRONMENT: 'development', GIT_COMMIT: 'local-preview',
  JWT_SECRET: 'isolated-admin-preview-secret-no-production-use-0001', AI_ENABLED: 'false', AI_MOCK_MODE: 'true',
  SCAN_QUEUE_MODE: 'sync', WEEK_SCHEMA_MODE: 'dual', RECIPE_CATALOG_MODE: 'static', MEAL_PLANNER_ENABLED: 'true' };
globalThis.fetch = async () => { throw new Error('External network disabled in isolated admin preview'); };

let queue = Promise.resolve();
const server = createHttpServer((req, res) => {
  queue = queue.then(async () => {
    try {
      const body = [];
      for await (const chunk of req) body.push(chunk);
      // Accept the managed-preview HTTPS tunnel as the application origin.
      const forwardedProto = req.headers['x-forwarded-proto'];
      const origin = req.headers.origin && new URL(req.headers.origin).host === req.headers.host
        ? new URL(req.headers.origin).origin
        : `${forwardedProto === 'https' ? 'https' : 'http'}://${req.headers.host}`;
      if (req.url === '/__admin-preview/reset' && req.method === 'POST') {
        const previous = db;
        db = freshDatabase();
        env.DB = db;
        env.CACHE = createPreviewCache();
        previous.close();
        res.writeHead(204).end();
        return;
      }
      if (req.url === '/__admin-preview/health') { res.writeHead(200).end('ok'); return; }
      const request = new Request(`${origin}${req.url}`, { method: req.method, headers: req.headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(body) });
      const response = await worker.fetch(request, { ...env, APP_URL: origin }, { waitUntil(p) { p.catch(console.error); }, passThroughOnException() {} });
      const headers = new Headers(response.headers);
      // Node's http module needs multiple Set-Cookie headers as an array.
      const setCookies = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
      headers.delete('set-cookie');
      const out = Object.fromEntries(headers);
      if (setCookies.length) out['set-cookie'] = setCookies;
      res.writeHead(response.status, out);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      console.error(error);
      res.writeHead(500).end('Isolated admin preview error');
    }
  });
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '0.0.0.0', resolve); });
console.log(`Isolated Admin Console preview on http://127.0.0.1:${port}/admin/ (in-memory SQLite, synthetic fixture, external network disabled)`);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
  server.close();
  await vite.close();
  db.close();
  process.exit(0);
});
