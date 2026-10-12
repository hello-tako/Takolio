#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
const args = process.argv.slice(2);
if (args.length > 1 || args.length === 1 && args[0] !== '--check') throw new Error('Usage: billing-contract.mjs [--check]');
const path = 'docs/backend-upgrade/nine-region-offline/billing.openapi.json';
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false },
  appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] } });
try {
  const { describeZodContract } = await vite.ssrLoadModule('/scripts/planner-openapi.ts');
  const shared = await vite.ssrLoadModule('/src/shared/billing.ts');
  const schemas = Object.fromEntries(['BillingPlanRequestSchema','CheckoutKeySchema','BillingPlansResponseSchema',
    'BillingCreatedResponseSchema','CheckoutUncertainSchema','OpenCheckoutsResponseSchema']
    .map((name) => [name, describeZodContract(shared[name])]));
  const response = (name, description) => ({ description, content: { 'application/json': { schema: { $ref: `#/components/schemas/${name}` } } } });
  const common = { security: [{ CookieSession: [] }], 'x-owner-scope': 'authenticated non-guest; expected owner headers and CSRF on POST' };
  const doc = { openapi: '3.1.0', info: { title: 'Takosan billing admission offline contract', version: '1-candidate' },
    servers: [{ url: '/api/v1' }], 'x-status': 'LOCAL_CANDIDATE_PENDING_EXTERNAL_EVIDENCE',
    paths: {
      '/billing/plans': { get: { ...common, responses: { 200: response('BillingPlansResponseSchema', 'Authoritative prices') } } },
      '/billing/checkouts': { get: { ...common, responses: { 200: response('OpenCheckoutsResponseSchema', 'Owner-only reload recovery handles') } } },
      '/billing/checkouts/{id}': { get: { ...common, parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', minLength: 1 } }], responses: { 200: response('BillingCreatedResponseSchema', 'Resume owned instructions without dispatch'), 202: response('CheckoutUncertainSchema', 'Reconciliation required'), 404: { description: 'Foreign or missing' }, 409: { description: 'Expired or active attempt' } } } },
      '/billing/payment-intents': { post: { ...common,
        parameters: [{ name: 'Idempotency-Key', in: 'header', required: false, schema: schemas.CheckoutKeySchema,
          description: 'Required for retry-safe protocol; absent retains legacy creation. Same-key changed plan conflicts. Keep key through transport failure.' }],
        requestBody: { required: true, content: { 'application/json': { schema: schemas.BillingPlanRequestSchema } } },
        responses: { 200: response('BillingCreatedResponseSchema', 'Original offer replay'),
          201: response('BillingCreatedResponseSchema', 'One newly admitted offer'),
          202: response('CheckoutUncertainSchema', 'Remote outcome unknown; no replacement dispatch'),
          409: { description: 'IDEMPOTENCY_CONFLICT, COMMAND_IN_PROGRESS or CHECKOUT_KEY_EXPIRED' },
          400: { description: 'INVALID_PLAN or INVALID_IDEMPOTENCY_KEY' }, 401: { description: 'UNAUTHORIZED' },
          429: { description: 'Creation rate limit (fail closed)' }, 503: { description: 'Provider, rate-limit or database unavailable' } } } },
    }, components: { schemas, securitySchemes: { CookieSession: { type: 'apiKey', in: 'cookie', name: '__Host-frigo_session' } } },
    'x-source-hashes': await Promise.all(['scripts/billing-contract.mjs','scripts/planner-openapi.ts','src/shared/billing.ts',
      'src/worker/routes/billing.ts','src/worker/payment/checkout.ts','migrations/0041_checkout_admission.sql']
      .map(async (path) => ({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') }))),
  };
  const bytes = `${JSON.stringify(doc, null, 2)}\n`;
  if (args[0] === '--check') { if (await readFile(path, 'utf8') !== bytes) throw new Error('BILLING_CONTRACT_DRIFT'); }
  else await writeFile(path, bytes);
  process.stdout.write('billing-contract=PASS; 4 route operations with executable Zod authority\n');
} finally { await vite.close(); }
