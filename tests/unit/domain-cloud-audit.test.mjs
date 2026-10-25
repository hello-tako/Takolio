import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { ACCOUNT, ZONE, audit, cloudflareRead, sanitizeRuntime } from '../../scripts/domain/audit-cloud.mjs';

const baseline = JSON.parse(readFileSync('docs/domain-integration/evidence/live-runtime.json', 'utf8'));
const schema = { version: '0001_fixture.sql', migrations: [{ name: '0001_fixture.sql' }] };
function fixture(environment) {
  const live = structuredClone(baseline.workers[environment]);
  const script = `/accounts/${ACCOUNT}/workers/scripts/${live.name}`;
  const deployment = { id: live.deploymentId, created_on: '2026-10-17T00:00:00Z', versions: [{ version_id: live.versionId, percentage: 100 }] };
  const version = { id: live.versionId, resources: {
    bindings: [...live.typedBindings, ...Object.entries(live.vars).map(([name, text]) => ({ name, text, type: 'plain_text' })),
      ...live.secretNames.map((name) => ({ name, type: 'secret_text' }))],
    script_runtime: { ...live.runtime, assets: { ...live.runtime.assets, raw_run_worker_first: false } },
  } };
  const responses = {
    [`${script}/deployments?per_page=100`]: { deployments: [deployment] },
    [`${script}/versions/${live.versionId}`]: version,
    [`${script}/subdomain`]: { enabled: environment === 'staging', previews_enabled: environment === 'staging' },
    [`${script}/schedules`]: { schedules: [{ cron: '0 3 * * *' }] },
    [`${script}/settings`]: { observability: { enabled: true, head_sampling_rate: environment === 'staging' ? 0.1 : 1 } },
    [`/zones/${ZONE}`]: { id: ZONE, name: 'takolio.app', status: 'active', account: { id: ACCOUNT } },
    [`/accounts/${ACCOUNT}/workers/domains?zone_id=${ZONE}&per_page=100`]: [],
    [`/zones/${ZONE}/dns_records?per_page=100`]: [],
    [`/zones/${ZONE}/workers/routes`]: [],
    [`/accounts/${ACCOUNT}/queues?per_page=100`]: [{ queue_name: live.bindings.SCAN_QUEUE, queue_id: 'fixture-queue' }],
    [`/accounts/${ACCOUNT}/queues/fixture-queue/consumers`]: [{ consumer_id: 'fixture-consumer', type: 'worker', script: live.name, environment: 'production', settings: { batch_size: 5 } }],
    [`/accounts/${ACCOUNT}/d1/database/${live.bindings.DB}/query`]: [{ success: true, results: [{ name: schema.version }] }],
  };
  const calls = [];
  return { version, deployment, responses, calls, read: async (path, sql) => {
    calls.push({ path, sql });
    if (!Object.hasOwn(responses, path)) throw new Error(`Unexpected fixture read ${path}`);
    return structuredClone(responses[path]);
  } };
}

describe('read-only domain infrastructure audit', () => {
  it.each(['staging', 'production'])('captures %s runtime, exposure, queues and exact ledger without deployment', async (environment) => {
    const source = fixture(environment);
    const receipt = await audit(environment, { ...source, schema, baseline });
    expect(receipt.deploymentAuthorized).toBe(false);
    expect(receipt.readOnly).toBe(true);
    expect(receipt.worker.versionId).toBe(baseline.workers[environment].versionId);
    expect(receipt.operational.workers_dev).toBe(environment === 'staging');
    expect(receipt.operational.preview_urls).toBe(environment === 'staging');
    expect(receipt.operational.crons).toEqual(['0 3 * * *']);
    expect(receipt.operational.consumers[0]).toMatchObject({ consumer_id: 'fixture-consumer', script: baseline.workers[environment].name, environment: 'production' });
    expect(receipt.worker.secretNames).toContain('RELEASE_VERIFY_TOKEN');
    expect(source.calls.filter((entry) => entry.sql)).toEqual([{
      path: `/accounts/${ACCOUNT}/d1/database/${baseline.workers[environment].bindings.DB}/query`,
      sql: { databaseId: baseline.workers[environment].bindings.DB, sql: 'SELECT name FROM d1_migrations ORDER BY name' },
    }]);
  });

  it('inventories unfiltered queues and selects one exact target without accepting ambiguous names', async () => {
    const source = fixture('staging');
    const queuePath = `/accounts/${ACCOUNT}/queues?per_page=100`;
    source.responses[queuePath].push({ queue_name: 'frigo-scan-queue', queue_id: 'unrelated-production-queue' });
    const receipt = await audit('staging', { ...source, schema, baseline });
    expect(receipt.operational.consumers[0].consumer_id).toBe('fixture-consumer');
    expect(source.calls.filter(({ path }) => path.includes('/queues?')).map(({ path }) => path)).toEqual([queuePath]);
    source.responses[queuePath].push({ queue_name: baseline.workers.staging.bindings.SCAN_QUEUE, queue_id: 'duplicate' });
    await expect(audit('staging', { ...source, schema, baseline })).rejects.toThrow('ambiguous');
    source.responses[queuePath] = [];
    await expect(audit('staging', { ...source, schema, baseline })).rejects.toThrow('Exact queue identity');
  });

  it('keeps queue inventory completeness checks when search totals describe the unfiltered account', async () => {
    const entries = [{ queue_name: 'fixture-staging', queue_id: 'one' }, { queue_name: 'fixture-production', queue_id: 'two' }];
    const response = (result) => ({ ok: true, status: 200, json: async () => ({ success: true, result,
      result_info: { page: 1, per_page: 100, count: result.length, total_count: 2, total_pages: 1 } }) });
    const path = `/accounts/${ACCOUNT}/queues?per_page=100`;
    expect(await cloudflareRead(path, 'fixture', { fetchImpl: async () => response(entries) })).toEqual(entries);
    await expect(cloudflareRead(path, 'fixture', { fetchImpl: async () => response(entries.slice(0, 1)) }))
      .rejects.toThrow('Paginated inventory');
    await expect(cloudflareRead(`${path}&name=fixture-staging`, 'fixture', { fetchImpl: async () => response(entries.slice(0, 1)) }))
      .rejects.toThrow('Paginated inventory');
  });

  it('retains legacy service/environment queue consumer identity', async () => {
    const source = fixture('staging');
    source.responses[`/accounts/${ACCOUNT}/queues/fixture-queue/consumers`] = [{
      consumer_id: 'legacy-consumer', type: 'worker', service: 'frigo-staging', environment: 'production',
      settings: { batch_size: 5, max_retries: 3 },
    }];
    const receipt = await audit('staging', { ...source, schema, baseline });
    expect(receipt.operational.consumers[0]).toMatchObject({ consumer_id: 'legacy-consumer',
      service: 'frigo-staging', environment: 'production', settings: { batch_size: 5, max_retries: 3 } });
  });

  it('rejects zone ownership, D1 and migration drift', async () => {
    for (const alter of [
      (source) => { source.responses[`/zones/${ZONE}`].account.id = 'other'; },
      (source) => { source.version.resources.bindings.find((binding) => binding.type === 'd1').database_id = 'other'; },
      (source) => { source.responses[`/accounts/${ACCOUNT}/d1/database/${baseline.workers.staging.bindings.DB}/query`][0].results.push({ name: '0002_unknown.sql' }); },
    ]) {
      const source = fixture('staging');
      alter(source);
      await expect(audit('staging', { ...source, schema, baseline })).rejects.toThrow();
    }
  });

  it('refuses traffic splits and any secret values in metadata', () => {
    const source = fixture('staging');
    expect(() => sanitizeRuntime(source.version, { ...source.deployment, versions: [{ version_id: source.version.id, percentage: 50 }] })).toThrow('stable version');
    source.version.resources.bindings.push({ name: 'PRIVATE', type: 'secret_text', text: 'never-retain' });
    expect(() => sanitizeRuntime(source.version, source.deployment)).toThrow('Secret values must never be captured');
  });

  it('does not disclose provider error messages or use non-Cloudflare targets', async () => {
    let requested = false;
    await expect(cloudflareRead('/accounts/other/workers/scripts/frigo', 'fixture', { fetchImpl: async () => { requested = true; } })).rejects.toThrow('Unapproved');
    expect(requested).toBe(false);
    await expect(cloudflareRead(`/zones/${ZONE}`, 'fixture', { fetchImpl: async () => ({ ok: false, status: 403,
      json: async () => ({ success: false, errors: [{ code: 10000, message: 'sensitive-response' }] }) }) }))
      .rejects.toThrow(`Cloudflare read failed: HTTP 403 /zones/${ZONE}; codes=10000`);
  });

  it('refuses mutations and partial inventories before producing a receipt', async () => {
    await expect(cloudflareRead(`/accounts/${ACCOUNT}/d1/database/fixture/query`, 'fixture', { sql: { databaseId: 'fixture', sql: 'DELETE FROM users' } })).rejects.toThrow('fixed migration-ledger');
    await expect(cloudflareRead(`/zones/${ZONE}/dns_records`, 'fixture', { fetchImpl: async () => ({ ok: true, status: 200,
      json: async () => ({ success: true, result: [], result_info: { total_pages: 2 } }) }) })).rejects.toThrow('Paginated inventory');
  });


  it('reads every deployment page and rejects inconsistent or partial history', async () => {
    const path = `/accounts/${ACCOUNT}/workers/scripts/frigo-staging/deployments?per_page=100`;
    const calls = [];
    const response = (page, count = 101) => ({ ok: true, status: 200, json: async () => ({ success: true,
      result: { deployments: Array.from({ length: page === 1 ? 100 : 1 }, (_, index) => ({ id: String((page - 1) * 100 + index) })) },
      result_info: { page, per_page: 100, total_pages: 2, total_count: count },
    }) });
    const history = await cloudflareRead(path, 'fixture', { fetchImpl: async (url) => {
      calls.push(url);
      return response(calls.length);
    } });
    expect(history.deployments).toHaveLength(101);
    expect(calls[1]).toBe(`https://api.cloudflare.com/client/v4${path}&page=2`);
    let page = 0;
    await expect(cloudflareRead(path, 'fixture', { fetchImpl: async () => response(++page, page === 1 ? 101 : 102) }))
      .rejects.toThrow('pagination changed');
    await expect(cloudflareRead(path, 'fixture', { fetchImpl: async () => ({ ok: true, status: 200,
      json: async () => ({ success: true, result: { deployments: [] }, result_info: { total_count: 2 } }) }) }))
      .rejects.toThrow('Incomplete');
  });

  it('uses environment-scoped credentials, canonical main and read-only GitHub permissions', () => {
    const { load } = createRequire(createRequire(import.meta.url).resolve('eslint/package.json'))('js-yaml');
    const workflow = load(readFileSync('.github/workflows/domain-infrastructure-audit.yml', 'utf8'));
    expect(workflow.permissions).toEqual({ contents: 'read', actions: 'read' });
    expect(workflow.jobs.audit.environment).toBe('${{ inputs.environment }}');
    expect(workflow.jobs.audit.if).toContain("github.repository_id == '1422954151'");
    expect(workflow.jobs.audit.if).toContain("github.ref == 'refs/heads/main'");
    expect(workflow.jobs.audit.steps.some((step) => /wrangler deploy|secret put|migrations apply/.test(step.run || ''))).toBe(false);
  });
});

it('audits only the exact private restricted staging email addition and redacts its receipt', async () => {
  const { serializeStagingReceipt } = await import('../../scripts/domain/staging-email-policy.mjs');
  const source = fixture('staging');
  const recipient = 'approved-inbox@example.test';
  const native = { name: 'SEND_EMAIL', type: 'send_email', destination_address: recipient };
  source.version.resources.bindings.push(native);
  const receipt = await audit('staging', { ...source, schema, baseline, stagingEmailRecipient: recipient });
  expect(receipt.worker.typedBindings.find((entry) => entry.type === 'send_email')).toEqual(native);
  expect(serializeStagingReceipt(receipt, recipient)).not.toContain(recipient);
  await expect(audit('staging', { ...source, schema, baseline })).rejects.toThrow('private canonical');
  native.destination_address = 'other@example.test';
  await expect(audit('staging', { ...source, schema, baseline, stagingEmailRecipient: recipient })).rejects.toThrow('restricted');
  native.destination_address = recipient;
  source.version.resources.bindings.find((entry) => entry.type === 'd1').database_id = 'production-database';
  await expect(audit('staging', { ...source, schema, baseline, stagingEmailRecipient: recipient })).rejects.toThrow('binding drift');
});

it('rejects an alternate staging email provider while leaving production baseline rules strict', async () => {
  const recipient = 'approved-inbox@example.test';
  const staging = fixture('staging');
  staging.version.resources.bindings.push({ name: 'RESEND_API_KEY', type: 'secret_text' });
  await expect(audit('staging', { ...staging, schema, baseline, stagingEmailRecipient: recipient })).rejects.toThrow('alternate provider');
  const production = fixture('production');
  const receipt = await audit('production', { ...production, schema, baseline, stagingEmailRecipient: recipient });
  expect(receipt.worker.typedBindings).toEqual(baseline.workers.production.typedBindings);
  production.version.resources.bindings.find((entry) => entry.name === 'SEND_EMAIL').destination_address = recipient;
  await expect(audit('production', { ...production, schema, baseline, stagingEmailRecipient: recipient })).rejects.toThrow('binding drift');
});

it.each(['staging', 'production'])('keeps %s audits identical across receipt serialization when consumer fields are absent', async (environment) => {
  const source = fixture(environment);
  const consumerPath = `/accounts/${ACCOUNT}/queues/fixture-queue/consumers`;
  const consumer = source.responses[consumerPath][0];
  delete consumer.environment;
  const before = await audit(environment, { ...source, schema, baseline });
  const saved = JSON.parse(JSON.stringify(before));
  expect(before).toStrictEqual(saved);
  const { unchangedAudit } = await import('../../scripts/domain/staging-release.mjs');
  const after = await audit(environment, { ...source, schema, baseline });
  expect(() => unchangedAudit(saved, after)).not.toThrow();
  consumer.environment = 'production';
  const changed = await audit(environment, { ...source, schema, baseline });
  expect(() => unchangedAudit(saved, changed)).toThrow('operational');
  delete consumer.environment;
  consumer.settings.max_retries = 4;
  const settingsChanged = await audit(environment, { ...source, schema, baseline });
  expect(() => unchangedAudit(saved, settingsChanged)).toThrow('operational');
});

it('retries only a transient failed deployment page, retaining complete pagination', async () => {
  const path = `/accounts/${ACCOUNT}/workers/scripts/frigo/deployments?per_page=100`;
  const calls = [];
  const waits = [];
  const history = await cloudflareRead(path, 'private-fixture-token', {
    sleepImpl: async (ms) => waits.push(ms),
    fetchImpl: async (url) => {
      calls.push(url);
      if (calls.length === 2) return new Response('transient private response', { status: 500 });
      const page = calls.length === 1 ? 1 : 2;
      return Response.json({ success: true,
        result: { deployments: Array.from({ length: page === 1 ? 100 : 1 }, (_, i) => ({ id: String((page - 1) * 100 + i) })) },
        result_info: { page, per_page: 100, total_pages: 2, total_count: 101 } });
    },
  });
  expect(history.deployments).toHaveLength(101);
  expect(calls).toEqual([`https://api.cloudflare.com/client/v4${path}`,
    `https://api.cloudflare.com/client/v4${path}&page=2`, `https://api.cloudflare.com/client/v4${path}&page=2`]);
  expect(waits).toEqual([1000]);
});

it.each([429, 500, 502, 503, 504])('bounds transient HTTP%s retries and sanitizes exhausted failures', async (status) => {
  let calls = 0;
  const waits = [];
  await expect(cloudflareRead(`/zones/${ZONE}`, 'private-fixture-token', {
    sleepImpl: async (ms) => waits.push(ms),
    fetchImpl: async () => {
      calls += 1;
      return Response.json({ success: false, errors: [{ code: 10500, message: 'private provider response' }] }, { status });
    },
  })).rejects.toThrow(`Cloudflare read failed: HTTP ${status} /zones/${ZONE}; codes=10500`);
  expect(calls).toBe(3);
  expect(waits).toEqual([1000, 2000]);
});

it.each([401, 403, 404])('never retries permanent HTTP%s read failures', async (status) => {
  let calls = 0;
  await expect(cloudflareRead(`/zones/${ZONE}`, 'fixture', {
    sleepImpl: async () => { throw new Error('unexpected retry'); },
    fetchImpl: async () => {
      calls += 1;
      return Response.json({ success: false, errors: [{ code: 10000 }] }, { status });
    },
  })).rejects.toThrow(`HTTP ${status}`);
  expect(calls).toBe(1);
});
