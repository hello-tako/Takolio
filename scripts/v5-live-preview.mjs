import { createServer as createViteServer } from 'vite';
import {
  createPreviewCache,
  createPreviewControls,
  seedPlannerPreview,
  PREVIEW_USER_ID,
  PREVIEW_HOUSEHOLD_ID,
} from './planner-preview-fixtures.mjs';
import { seedT13ReconciliationEvidence } from './t13-reconciliation-fixtures.mjs';

/**
 * Takolio V5 — Single-Port In-Process Full-Stack Preview Server
 * Runs Vite SPA + Hono Worker + In-Memory SQLite D1 (all 48 migrations) inside
 * ONE process on `PORT` (default 4173) — zero secondary TCP proxy needed!
 */
const port = Number(process.env.PORT || 4173);

let handleApiRequest = null;

const inProcessApiPlugin = {
  name: 'takolio-in-process-worker-api',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = req.url || '/';
      if (!url.startsWith('/api/') && !url.startsWith('/__preview')) {
        return next();
      }
      if (!handleApiRequest) {
        res.statusCode = 503;
        res.end('Worker booting...');
        return;
      }
      try {
        await handleApiRequest(req, res);
      } catch (err) {
        console.error('[v5-live-preview api error]', err);
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Preview API Error' }));
      }
    });
  },
};

const vite = await createViteServer({
  cacheDir: `node_modules/.vite/v5-live-preview-${port}`,
  define: {
    'import.meta.env.VITE_MEAL_PLANNER_ENABLED': JSON.stringify('true'),
    'import.meta.env.VITE_MEAL_COMPOSITION_V2_ENABLED': JSON.stringify('true'),
  },
  plugins: [
    inProcessApiPlugin,
    {
      name: 'isolated-email',
      enforce: 'pre',
      resolveId(id) {
        if (id === 'cloudflare:email') return '\0isolated-email';
      },
      load(id) {
        if (id === '\0isolated-email') return 'export class EmailMessage {}';
      },
    },
  ],
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
  },
});

const { SqliteD1 } = await vite.ssrLoadModule('/tests/helpers/sqlite-d1.ts');
const { default: worker } = await vite.ssrLoadModule('/src/worker/index.ts');
const { recordInventoryObservation } = await vite.ssrLoadModule(
  '/packages/db/src/inventory-observations.ts',
);

let db = new SqliteD1();
seedPlannerPreview(db);

const appOrigin = `http://localhost:${port}`;
const env = {
  DB: db,
  CACHE: createPreviewCache(),
  ENVIRONMENT: 'development',
  APP_URL: appOrigin,
  JWT_SECRET: 'takolio-v5-local-preview-jwt-secret-key-min-32-chars-ok',
  OTP_HASH_SECRET: 'takolio-v5-local-preview-otp-secret-key-min-32-chars-ok',
  AI_MOCK_MODE: 'true',
  SCAN_QUEUE_MODE: 'sync',
  MEAL_PLANNER_ENABLED: 'true',
  MEAL_COMPOSITION_V2_ENABLED: 'true',
  RECIPE_CATALOG_V5_EXPANDED: 'true',
};

const operatorRequests = [];
const controls = createPreviewControls({
  getDatabase: () => db,
  getOperatorRequests: () => operatorRequests,
  seedReconciliation: () =>
    seedT13ReconciliationEvidence(
      db,
      PREVIEW_HOUSEHOLD_ID,
      PREVIEW_USER_ID,
      recordInventoryObservation,
    ),
  setInventoryReadFailure: () => {},
  resetDatabase: () => {
    const fresh = new SqliteD1();
    seedPlannerPreview(fresh);
    const previous = db;
    db = fresh;
    env.DB = fresh;
    env.CACHE = createPreviewCache();
    previous.close();
  },
});

let queueChain = Promise.resolve();
handleApiRequest = (req, res) => {
  queueChain = queueChain.then(async () => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const hostHeader = req.headers.host || `localhost:${port}`;
    const originHeader = req.headers.origin || `http://${hostHeader}`;
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) headers.set(k, v.join(', '));
      else if (typeof v === 'string') headers.set(k, v);
    }
    if (!headers.has('origin')) headers.set('origin', originHeader);

    const request = new Request(`${originHeader}${req.url}`, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method || 'GET') ? undefined : Buffer.concat(chunks),
    });

    const response =
      (await controls(request)) ||
      (await worker.fetch(
        request,
        { ...env, APP_URL: originHeader },
        {
          waitUntil(p) {
            p.catch((e) => console.error('[waitUntil]', e));
          },
          passThroughOnException() {},
        },
      ));

    res.statusCode = response.status;
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() === 'set-cookie') {
        const existing = res.getHeader('set-cookie');
        const list = existing ? (Array.isArray(existing) ? existing : [String(existing)]) : [];
        res.setHeader('set-cookie', [...list, value]);
      } else {
        res.setHeader(key, value);
      }
    });
    const arrayBuf = await response.arrayBuffer();
    res.end(Buffer.from(arrayBuf));
  });
  return queueChain;
};

await vite.listen();
console.log(`Takolio V5 Single-Port Full-Stack Preview ready at http://localhost:${port}`);

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.once(sig, async () => {
    await vite.close();
    db.close();
    process.exit(0);
  });
}
