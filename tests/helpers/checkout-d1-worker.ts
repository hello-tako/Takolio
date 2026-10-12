import { Hono } from 'hono';
import type { D1DatabaseBinding } from '../../packages/db/src';
import { createCheckout } from '../../src/worker/payment/checkout';
import { BillingPlanRequestSchema, CheckoutKeySchema } from '../../src/shared/billing';
let dispatchCount = 0;
const app = new Hono<{ Bindings: { DB: D1DatabaseBinding; TEST_TOKEN: string } }>();
app.use('*', async (c, next) => {
  if (c.req.header('x-test-token') !== c.env.TEST_TOKEN) return c.json({ error: 'Denied' }, 403);
  return next();
});
app.post('/', async (c) => {
  const input = await c.req.json() as { statements: Array<{ sql: string; values?: unknown[] }> };
  return c.json({ results: await c.env.DB.batch(input.statements.map((s) => c.env.DB.prepare(s.sql).bind(...(s.values ?? [])))) });
});
app.post('/checkout', async (c) => {
  const body = await c.req.json() as { plan: unknown; key: unknown; fail?: boolean };
  const { plan } = BillingPlanRequestSchema.parse(body);
  const key = CheckoutKeySchema.parse(body.key);
  const result = await createCheckout(c.env.DB, 'offline-checkout-owner', key, plan, async () => {
    dispatchCount++;
    if (body.fail) throw new Error('TEST_ONLY lost response');
    return { bankBin: '970422', accountNumber: '123456789', accountName: 'TEST ONLY',
      transferContent: 'TEST ONLY', qrImageUrl: 'https://example.test/mock-qr.png' };
  });
  return c.json({ result, dispatchCount });
});
export default app;
