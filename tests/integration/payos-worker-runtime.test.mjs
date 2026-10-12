import { createHmac } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

const runtimeRequire = createRequire(realpathSync(resolve('node_modules/wrangler/package.json')));
const { Miniflare, convertV4MiniflareOptions } = runtimeRequire('miniflare');
const buildRequire = createRequire(realpathSync(resolve('node_modules/vite/package.json')));
const { build } = buildRequire('esbuild');
const credentials = { PAYOS_CLIENT_ID: 'fixture-client', PAYOS_API_KEY: 'fixture-api', PAYOS_CHECKSUM_KEY: 'fixture-checksum' };
const expiry = Math.floor(Date.now() / 1000) + 1800;
const intent = { id: 'fixture-intent', user_id: 'fixture-user', plan: 'monthly', amount_vnd: 49000,
  currency: 'VND', order_code: '170712966684685', description: 'TP6684685', status: 'pending',
  expires_at: new Date(expiry * 1000).toISOString(), provider_reference: null };
const providerData = { bin: '970422', accountNumber: 'VQRTEST123', accountName: 'FIXTURE ACCOUNT',
  amount: 49000, currency: 'VND', orderCode: Number(intent.order_code), description: intent.description,
  status: 'PENDING', expiredAt: expiry };
const sign = (data) => createHmac('sha256', credentials.PAYOS_CHECKSUM_KEY)
  .update(Object.keys(data).sort().map((key) => `${key}=${data[key]}`).join('&')).digest('hex');
let script;
let runtime;

beforeAll(async () => {
  const result = await build({ stdin: { contents: `
    import { createPayosInstructions } from './src/worker/payment/payos.ts';
    export default { async fetch(request, env) {
      try { return Response.json({ instructions: await createPayosInstructions(env, await request.json()) }); }
      catch (error) { return Response.json({ message: error.message }, { status: 502 }); }
    } };`, resolveDir: process.cwd(), loader: 'js' },
    bundle: true, format: 'esm', platform: 'browser', write: false, logLevel: 'silent' });
  script = result.outputFiles[0].text;
});
afterEach(async () => { await runtime?.dispose(); runtime = undefined; });

async function invoke(provider) {
  runtime = new Miniflare(convertV4MiniflareOptions({ modules: true, script,
    compatibilityDate: '2024-11-01',
    bindings: { ...credentials, PAYOS_CHECKOUT_ENABLED: 'true', ENVIRONMENT: 'production', APP_URL: 'https://frigo.tungjpstore.net' },
    outboundService: provider }));
  return runtime.dispatchFetch('http://localhost/test', { method: 'POST', body: JSON.stringify(intent) });
}

describe('payOS in the actual Worker runtime', () => {
  it('issues signed payment instructions with the deployed compatibility date and virtual account', async () => {
    const calls = [];
    const response = await invoke(async (request) => {
      const body = await request.json(); calls.push({ url: request.url, body });
      expect(request.headers.get('x-client-id')).toBe(credentials.PAYOS_CLIENT_ID);
      expect(request.headers.get('x-api-key')).toBe(credentials.PAYOS_API_KEY);
      const { amount, cancelUrl, description, orderCode, returnUrl } = body;
      expect(body.signature).toBe(sign({ amount, cancelUrl, description, orderCode, returnUrl }));
      return Response.json({ code: '00', data: providerData, signature: sign(providerData) });
    });
    expect(response.status).toBe(200);
    const value = await response.json();
    expect(value.instructions).toMatchObject({ accountNumber: 'VQRTEST123', transferContent: intent.description });
    expect(new URL(value.instructions.qrImageUrl).searchParams.get('amount')).toBe('49000');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api-merchant.payos.vn/v2/payment-requests');
    expect(calls[0].body.expiredAt).toBe(expiry);
  });

  it.each([301, 302, 303, 307, 308])('rejects HTTP %s without following or forwarding credentials', async (status) => {
    const calls = [];
    const response = await invoke(async (request) => {
      calls.push(request.url);
      return new Response('must not parse', { status, headers: { Location: 'https://credential-sink.invalid/' } });
    });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: 'Payment provider unavailable' });
    expect(calls).toEqual(['https://api-merchant.payos.vn/v2/payment-requests']);
  });

  it('rejects a response with a forged signature in workerd', async () => {
    const response = await invoke(async () => Response.json({ code: '00', data: providerData, signature: '00'.repeat(32) }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ message: 'Invalid provider signature' });
  });
});
