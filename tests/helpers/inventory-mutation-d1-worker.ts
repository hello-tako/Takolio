import { Hono } from 'hono';
import type { D1DatabaseBinding } from '../../packages/db/src';
import { inventoryRoutes } from '../../src/worker/routes/inventory';
import type { AuthContext, Env } from '../../src/worker/types';
import databaseWorker from './inventory-lot-d1-worker';

export default {
  async fetch(request: Request, env: { DB: D1DatabaseBinding; TEST_TOKEN: string }): Promise<Response> {
    if (request.headers.get('x-test-token') !== env.TEST_TOKEN) return new Response('Forbidden', { status: 403 });
    if (new URL(request.url).pathname !== '/inventory-route') return databaseWorker.fetch(request, env);
    const body = await request.json() as {
      userId: string; householdId: string; path: string; method: string;
      payload?: unknown; headers?: Record<string, string>;
    };
    const app = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
    app.use('*', async (c, next) => {
      c.set('auth', { userId: body.userId, householdId: body.householdId, role: 'owner', isGuest: true });
      await next();
    });
    app.route('/', inventoryRoutes);
    const response = await app.fetch(new Request('https://inventory.test' + body.path, {
      method: body.method, headers: { 'Content-Type': 'application/json', ...body.headers },
      ...(body.payload === undefined ? {} : { body: JSON.stringify(body.payload) }),
    }), { DB: env.DB, ENVIRONMENT: 'test' } as Env);
    return Response.json({ status: response.status, body: await response.json() });
  },
};
