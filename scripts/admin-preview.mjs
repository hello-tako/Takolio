#!/usr/bin/env node
// Isolated Admin Console preview for E2E: the real admin Worker
// (src/worker/admin-worker.ts) serves documents, assets and API on one loopback
// origin. In-memory SQLite for both databases (customer migrations + admin
// migrations + synthetic fixture); ASSETS emulates Workers static assets over
// dist/admin. No Cloudflare bindings, credentials or external network.
import { createServer as createHttpServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { assertLocalProvisioningAllowed, buildAdminFixtureSql } from './admin-local-lib.mjs';

assertLocalProvisioningAllowed({ argv: ['--local'] });
const port = Number(process.env.PORT || 8790);
const host = '127.0.0.1';
const origin = `http://${host}:${port}`;
const root = path.resolve(import.meta.dirname, '..');
const client = path.join(root, 'dist', 'admin');
if (!existsSync(path.join(client, 'admin', 'index.html'))) {
  console.error('dist/admin/admin/index.html is missing; run `pnpm build:admin` first.');
  process.exit(1);
}

// Local tooling only: enables the development password login in this process.
globalThis.__ADMIN_LOCAL_AUTH__ = true;

const vite = await createViteServer({
  root, configFile: false, server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error',
  resolve: { alias: { '@frigo/db': path.join(root, 'packages/db/src/index.ts'), '@shared': path.join(root, 'src/shared') } },
});
const { SqliteD1, applyMigrations } = await vite.ssrLoadModule('/tests/helpers/sqlite-d1.ts');
const { default: worker } = await vite.ssrLoadModule('/src/worker/admin-worker.ts');

const CONTENT_TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

// html_handling: auto-trailing-slash, not_found_handling: none.
const assets = {
  async fetch(input) {
    const pathname = decodeURIComponent(new URL(typeof input === 'string' ? input : input.url).pathname);
    const file = path.join(client, pathname.endsWith('/') ? `${pathname}index.html` : pathname);
    if (!file.startsWith(client) || !existsSync(file) || !statSync(file).isFile()) return new Response('Not Found', { status: 404 });
    return new Response(readFileSync(file), { headers: { 'Content-Type': CONTENT_TYPES[path.extname(file)] ?? 'application/octet-stream' } });
  },
};

function freshDatabases() {
  const fixture = buildAdminFixtureSql();
  const main = new SqliteD1();
  main.seed(fixture.main);
  const admin = new SqliteD1({ migrate: false });
  applyMigrations(admin, path.join(root, 'migrations-admin'));
  admin.seed(fixture.admin);
  return { main, admin };
}
function memoryKv() {
  const entries = new Map();
  return {
    async get(key, type) { const value = entries.get(key); return value === undefined ? null : type === 'json' ? JSON.parse(value) : value; },
    async put(key, value) { entries.set(key, value); },
    async delete(key) { entries.delete(key); },
  };
}

let dbs = freshDatabases();
const env = { DB: dbs.main, ADMIN_DB: dbs.admin, CACHE: memoryKv(), ASSETS: assets, ENVIRONMENT: 'development', ADMIN_CONSOLE_ENABLED: 'true',
  ADMIN_AUTH_MODE: 'password', ADMIN_ORIGIN: origin, CUSTOMER_APP_URL: 'http://127.0.0.1:8787', GIT_COMMIT: 'local-preview' };
globalThis.fetch = async () => { throw new Error('External network disabled in isolated admin preview'); };

let queue = Promise.resolve();
const server = createHttpServer((req, res) => {
  queue = queue.then(async () => {
    try {
      if (req.url === '/__admin-preview/health') { res.writeHead(200).end('ok'); return; }
      if (req.url === '/__admin-preview/reset' && req.method === 'POST') {
        const previous = dbs;
        dbs = freshDatabases();
        Object.assign(env, { DB: dbs.main, ADMIN_DB: dbs.admin, CACHE: memoryKv() });
        previous.main.close();
        previous.admin.close();
        res.writeHead(204).end();
        return;
      }
      const body = [];
      for await (const chunk of req) body.push(chunk);
      const request = new Request(`${origin}${req.url}`, { method: req.method, headers: req.headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(body) });
      const response = await worker.fetch(request, env, { waitUntil(p) { p.catch(console.error); }, passThroughOnException() {} });
      const headers = new Headers(response.headers);
      const setCookies = headers.getSetCookie();
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
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); });
console.log(`Isolated Admin Console preview on ${origin}/admin/ (loopback only, in-memory SQLite, synthetic fixture, external network disabled)`);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
  server.close();
  await vite.close();
  dbs.main.close();
  dbs.admin.close();
  process.exit(0);
});
