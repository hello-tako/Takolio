import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { prepareConfig } from '../../scripts/domain/prepare.mjs';

const snapshot = JSON.parse(readFileSync('docs/domain-integration/evidence/live-runtime.json', 'utf8'));
const sha = '1'.repeat(40);

it('prepares domain configs while preserving observed flags, storage, queues and old route', () => {
  for (const environment of ['production', 'staging']) {
    const plan = prepareConfig(environment, snapshot, sha);
    const config = plan.config;
    const live = snapshot.workers[environment];
    expect(plan.deployAuthorized).toBe(false);
    expect(config.name).toBe(live.name);
    expect(config.workers_dev).toBe(environment === 'staging');
    expect(config.preview_urls).toBe(environment === 'staging');
    expect(config.assets.run_worker_first).toBe(true);
    expect(config.vars).toEqual({ ...live.vars, APP_URL: environment === 'production' ? 'https://takolio.app' : 'https://staging.takolio.app', PUBLIC_DOMAIN_ROUTING: 'true', GIT_COMMIT: sha });
    expect(config.d1_databases[0].database_id).toBe(live.bindings.DB);
    expect(config.kv_namespaces[0].id).toBe(live.bindings.CACHE);
    expect(config.r2_buckets[0].bucket_name).toBe(live.bindings.IMAGES);
    expect(config.queues.producers[0].queue).toBe(live.bindings.SCAN_QUEUE);
    expect(plan.buildEnvironment.VITE_MEAL_COMPOSITION_V2_ENABLED).toBe(live.vars.MEAL_COMPOSITION_V2_ENABLED);
    expect(config.routes.every((route) => !route.pattern.includes('admin.'))).toBe(true);
  }
  expect(prepareConfig('production', snapshot, sha).config.routes).toContainEqual({ pattern: 'frigo.tungjpstore.net', custom_domain: true });
});

it('refuses account, zone, worker and resource drift', () => {
  for (const alter of [
    (data) => { data.accountId = 'wrong'; },
    (data) => { data.zoneId = 'wrong'; },
    (data) => { data.workers.production.name = 'unexpected'; },
    (data) => { data.workers.production.bindings.DB = 'unexpected'; },
  ]) {
    const data = structuredClone(snapshot);
    alter(data);
    expect(() => prepareConfig('production', data, sha)).toThrow();
  }
  expect(() => prepareConfig('production', snapshot, 'main')).toThrow();
  expect(() => prepareConfig('unknown', snapshot, sha)).toThrow();
});

it('refuses staging configured with any production data binding', () => {
  for (const key of ['DB', 'CACHE', 'IMAGES', 'SCAN_QUEUE']) {
    const data = structuredClone(snapshot);
    data.workers.staging.bindings[key] = data.workers.production.bindings[key];
    expect(() => prepareConfig('staging', data, sha)).toThrow();
  }
});

it('rejects every added, removed, changed or unsupported live binding', () => {
  for (const alter of [
    (data) => { data.workers.production.bindings.EXTRA_BUCKET = 'live-extra-bucket'; },
    (data) => { data.workers.production.typedBindings.push({ name: 'EXTRA_BUCKET', type: 'r2_bucket', bucket_name: 'live-extra-bucket' }); },
    (data) => { data.workers.production.typedBindings = data.workers.production.typedBindings.filter((b) => b.type !== 'send_email'); },
    (data) => { data.workers.production.typedBindings.find((b) => b.type === 'send_email').destination_address = 'changed@example.invalid'; },
    (data) => { data.workers.production.typedBindings.push({ name: 'SERVICE', type: 'service', service: 'unreviewed' }); },
    (data) => { data.workers.production.runtime.compatibility_date = '2026-01-01'; },
  ]) {
    const data = structuredClone(snapshot);
    alter(data);
    expect(() => prepareConfig('production', data, sha)).toThrow();
  }
});

it('captures AI, assets and email while refusing unknown shapes and secret values', async () => {
  const { captureBindings } = await import('../../scripts/domain/bindings.mjs');
  expect(captureBindings([{ name: 'AI', type: 'ai', project: '<catalog>' }, { name: 'ASSETS', type: 'assets' }, { name: 'SEND_EMAIL', type: 'send_email' }]).typedBindings).toHaveLength(3);
  expect(() => captureBindings([{ name: 'SECRET', type: 'secret_text', text: 'never-save-this' }])).toThrow();
  expect(() => captureBindings([{ name: 'SERVICE', type: 'service', service: 'unknown' }])).toThrow();
  expect(() => captureBindings([{ name: 'AI', type: 'ai', project: '<catalog>', unexpected: true }])).toThrow();
});

it('requires clean committed source, including untracked files, for SHA identity', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFileSync } = await import('node:child_process');
  const { sourceIdentity } = await import('../../scripts/domain/prepare.mjs');
  const dir = mkdtempSync(join(tmpdir(), 'takolio-source-identity-'));
  const git = (...args) => execFileSync('git', args, { cwd: dir, encoding: 'utf8', stdio: 'pipe' }).trim();
  try {
    git('init', '-q');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--allow-empty', '-qm', 'fixture');
    expect(sourceIdentity(dir)).toBe(git('rev-parse', 'HEAD'));
    writeFileSync(join(dir, 'source.txt'), 'untracked');
    expect(() => sourceIdentity(dir)).toThrow('Commit all source changes');
    git('add', 'source.txt');
    expect(() => sourceIdentity(dir)).toThrow('Commit all source changes');
    git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'source');
    writeFileSync(join(dir, 'source.txt'), 'changed');
    expect(() => sourceIdentity(dir)).toThrow('Commit all source changes');
  } finally { rmSync(dir, { recursive: true }); }
});
