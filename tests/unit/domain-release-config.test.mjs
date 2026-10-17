import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { prepareReleaseConfig, configHash, AUDIT_MAX_AGE_MS } from '../../scripts/domain/release-config.mjs';
import { REPOSITORY, REPOSITORY_ID } from '../../scripts/domain/audit-cloud.mjs';

const baseline = JSON.parse(readFileSync('docs/domain-integration/evidence/live-runtime.json', 'utf8'));
const now = Date.parse('2026-10-17T12:00:00Z');
function fixture(environment = 'staging') {
  const manifest = { repository: REPOSITORY, sha: 'a'.repeat(40), environment,
    mealCompositionV2Enabled: true, recipeCatalogMode: 'd1', recipeCatalogCanaryPercent: 0, recipeCatalogCutoverEnabled: true };
  const worker = structuredClone(baseline.workers[environment]);
  const receipt = { repository: REPOSITORY, repositoryId: REPOSITORY_ID,
    sha: manifest.sha, ci: { headSha: manifest.sha }, environment,
    accountId: baseline.accountId, zoneId: baseline.zoneId, readOnly: true, deploymentAuthorized: false,
    observedAt: new Date(now - 1000).toISOString(), worker,
    operational: { workers_dev: environment === 'staging', preview_urls: environment === 'staging',
      crons: ['0 3 * * *'], observability: { logs: { enabled: true, head_sampling_rate: 0.1, persist: true } },
      consumers: [{ consumer_id: 'consumer', type: 'worker', service: worker.name, environment: 'production',
        dead_letter_queue: environment === 'staging' ? 'frigo-scan-dlq-staging' : 'frigo-scan-dlq',
        settings: { batch_size: 5, max_wait_time_ms: 10000, max_retries: 3, retry_delay: 0, max_concurrency: null } }] } };
  return { manifest, receipt, baseline, now };
}

describe('audit-bound runtime upload config', () => {
  it.each(['staging', 'production'])('preserves %s runtime flags and operational settings while suppressing route reconciliation', (environment) => {
    const args = fixture(environment);
    const plan = prepareReleaseConfig(args);
    expect(plan.deployAuthorized).toBe(false);
    expect(plan.sha256).toBe(configHash(plan.bytes));
    expect(JSON.parse(plan.bytes)).toEqual(plan.config);
    expect(plan.config.routes).toEqual([]);
    expect(plan.config.vars).toMatchObject({ GIT_COMMIT: args.manifest.sha, MEAL_COMPOSITION_V2_ENABLED: 'true',
      MEAL_PLANNER_ENABLED: 'true', RECIPE_CATALOG_MODE: 'd1', PUBLIC_DOMAIN_ROUTING: 'true' });
    expect(plan.config.triggers.crons).toEqual(args.receipt.operational.crons);
    expect(plan.config.observability).toEqual(args.receipt.operational.observability);
    expect(plan.config.queues.consumers).toEqual([{ queue: args.receipt.worker.bindings.SCAN_QUEUE,
      dead_letter_queue: args.receipt.operational.consumers[0].dead_letter_queue,
      max_batch_size: 5, max_batch_timeout: 10, max_retries: 3, retry_delay: 0 }]);
    expect(plan.config.workers_dev).toBe(environment === 'staging');
    expect(plan.config.preview_urls).toBe(environment === 'staging');
    expect(plan.previous.versionId).toBe(args.receipt.worker.versionId);
    expect(plan.config.assets.run_worker_first).toBe(true);
    expect(plan.buildEnvironment.VITE_MEAL_COMPOSITION_V2_ENABLED).toBe('true');
  });

  it('accepts the live script identity and omitted automatic concurrency fields', () => {
    const args = fixture();
    args.receipt.operational.consumers = [{ consumer_id: 'a315a36230104821bec7fce83b1ea87d',
      type: 'worker', script: 'frigo-staging', dead_letter_queue: 'frigo-scan-dlq-staging',
      settings: { batch_size: 5, max_retries: 3, max_wait_time_ms: 10000, retry_delay: 0 } }];
    const plan = prepareReleaseConfig(args);
    expect(plan.config.queues.consumers).toEqual([{ queue: 'frigo-scan-queue-staging',
      dead_letter_queue: 'frigo-scan-dlq-staging', max_batch_size: 5, max_batch_timeout: 10,
      max_retries: 3, retry_delay: 0 }]);
  });

  it('preserves omitted automatic concurrency for a fully identified legacy consumer', () => {
    const args = fixture();
    delete args.receipt.operational.consumers[0].settings.max_concurrency;
    expect(prepareReleaseConfig(args).config.queues.consumers[0]).not.toHaveProperty('max_concurrency');
    args.receipt.operational.consumers[0].settings.max_concurrency = 2;
    expect(prepareReleaseConfig(args).config.queues.consumers[0].max_concurrency).toBe(2);
  });

  it.each([
    { script: 'frigo-staging', environment: 'other' },
    { script: 'frigo-staging', service: 'frigo' },
    { script: 'frigo', service: 'frigo-staging', environment: 'production' },
    { service: 'frigo-staging' },
    { service: 'frigo-staging', environment: 'other' },
    {},
  ])('rejects ambiguous or wrong queue ownership %j', (identity) => {
    const args = fixture();
    const consumer = args.receipt.operational.consumers[0];
    delete consumer.service;
    delete consumer.environment;
    Object.assign(consumer, identity);
    expect(() => prepareReleaseConfig(args)).toThrow('Queue consumer identity');
  });

  it.each([0, -1, 1.5, '2', false])('rejects invalid explicit concurrency %j', (value) => {
    const args = fixture();
    args.receipt.operational.consumers[0].settings.max_concurrency = value;
    expect(() => prepareReleaseConfig(args)).toThrow('Unsupported queue consumer settings');
  });

  it('rejects stale, future, wrong-SHA and cross-environment evidence', () => {
    for (const alter of [
      (a) => { a.receipt.observedAt = new Date(now - AUDIT_MAX_AGE_MS - 1).toISOString(); },
      (a) => { a.receipt.observedAt = new Date(now + 1).toISOString(); },
      (a) => { a.receipt.sha = 'b'.repeat(40); },
      (a) => { a.receipt.ci.headSha = 'b'.repeat(40); },
      (a) => { a.receipt.environment = 'production'; },
      (a) => { a.receipt.repositoryId = 'old-repository'; },
      (a) => { a.receipt.accountId = 'other'; },
      (a) => { a.receipt.readOnly = false; },
    ]) {
      const args = fixture(); alter(args);
      expect(() => prepareReleaseConfig(args)).toThrow();
    }
  });

  it('refuses unintended authority, feature, queue, runtime and exposure changes', () => {
    for (const alter of [
      (a) => { a.manifest.recipeCatalogMode = 'static'; },
      (a) => { a.manifest.mealCompositionV2Enabled = false; },
      (a) => { a.receipt.worker.vars.MEAL_PLANNER_ENABLED = 'false'; },
      (a) => { a.receipt.worker.runtime.assets.base_path = '/other'; },
      (a) => { a.receipt.operational.consumers[0].service = 'frigo'; },
      (a) => { a.receipt.operational.consumers[0].dead_letter_queue = 'frigo-scan-dlq'; },
      (a) => { a.receipt.operational.consumers[0].settings.unknown = true; },
      (a) => { a.receipt.operational.consumers[0].settings.max_retries = undefined; },
      (a) => { a.receipt.operational.consumers[0].settings.max_wait_time_ms = 1500; },
      (a) => { a.receipt.operational.consumers.push(structuredClone(a.receipt.operational.consumers[0])); },
    ]) {
      const args = fixture(); alter(args);
      expect(() => prepareReleaseConfig(args)).toThrow();
    }
    const prod = fixture('production');
    prod.receipt.operational.workers_dev = true;
    expect(() => prepareReleaseConfig(prod)).toThrow('Production exposure');
  });
});
