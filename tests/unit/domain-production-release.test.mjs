import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ACCEPTANCE_CHECKS, OBSERVATION_MS, verifyEvidenceRun, verifyStagingAcceptance,
  verifyProductionCertification, isProductionMutation, validateProductionRecovery, observeProduction } from '../../scripts/domain/production-release.mjs';
import { productionProvider, releaseProduction } from '../../scripts/domain/production-provider.mjs';

const sha = 'a'.repeat(40);
const account = 'ef250a88911fd24073cb73d1c07e0218';
const now = Date.parse('2026-10-18T01:00:00Z');
function evidenceRun() {
  return { id: 123, run_attempt: 2, repository: { id: 1422954151, full_name: 'hello-tako/Takolio' },
    head_repository: { id: 1422954151, full_name: 'hello-tako/Takolio' }, head_sha: sha, head_branch: 'main',
    path: '.github/workflows/domain-staging-release.yml', event: 'workflow_dispatch', status: 'completed', conclusion: 'success' };
}
function staging() {
  const receipt = { state: 'infrastructure-verified', manifest: { sha, repository: 'hello-tako/Takolio', environment: 'staging' },
    plan: { config: { name: 'frigo-staging' } }, uploadedVersionId: 'staging-version',
    hosts: { state: 'attached', environment: 'staging', sha },
    hostProof: { httpsVerified: true, apiStatus: 200, apiSpaStatus: 404, corsStatus: 204 },
    appProof: { deployed: { sha }, assets: { sha } } };
  const acceptance = { schema: 'takolio-staging-acceptance/v1', repository: 'hello-tako/Takolio', sha,
    releaseRunId: 123, versionId: 'staging-version', acceptedAt: new Date(now - 60000).toISOString(),
    checks: Object.fromEntries(ACCEPTANCE_CHECKS.map((name) => [name, { result: 'PASS',
      evidence: 'https://github.com/hello-tako/Takolio/pull/9#issuecomment-123' }])) };
  return { receipt, acceptance };
}
function certification() {
  return { repository: 'hello-tako/Takolio', sha, environment: 'production',
    certification: { checkedAt: new Date(now - 60000).toISOString(), result: 'PASS', readOnly: true, productionMutations: [] },
    productionBaseline: { worker: 'frigo', environment: 'production', versionId: 'previous-version', bindingVerified: true },
    catalog: { releaseComplete: true }, runtimeCatalog: { actualRecipes: 500 }, health: { foreignKeyCheck: '[]', quickCheck: 'ok' } };
}

describe('production release prerequisites', () => {
  it('requires successful canonical exact-main manual evidence including repository IDs and workflow path', () => {
    const options = { id: 123, sha, path: '.github/workflows/domain-staging-release.yml' };
    expect(verifyEvidenceRun(evidenceRun(), options)).toMatchObject({ id: 123, attempt: 2, sha });
    for (const alter of [
      (r) => { r.head_sha = 'b'.repeat(40); }, (r) => { r.head_branch = 'feature'; },
      (r) => { r.head_repository.id = 1; }, (r) => { r.repository.full_name = 'old/Takolio'; },
      (r) => { r.conclusion = 'failure'; }, (r) => { r.status = 'in_progress'; },
      (r) => { r.event = 'pull_request'; }, (r) => { r.path = '.github/workflows/deploy.yml'; },
      (r) => { r.run_attempt = 0; }, (r) => { r.id = 124; },
    ]) {
      const value = evidenceRun(); alter(value);
      expect(() => verifyEvidenceRun(value, options)).toThrow('canonical exact-main');
    }
  });

  it('requires every real staging acceptance item and same-release infrastructure proof', () => {
    const { receipt, acceptance } = staging();
    const options = { sha, runId: 123, now };
    expect(verifyStagingAcceptance(acceptance, receipt, options).evidenceKind).toContain('operator-attestation');
    for (const name of ACCEPTANCE_CHECKS) {
      const missing = structuredClone(acceptance); delete missing.checks[name];
      expect(() => verifyStagingAcceptance(missing, receipt, options)).toThrow();
      const skipped = structuredClone(acceptance); skipped.checks[name].result = 'NOT_RUN';
      expect(() => verifyStagingAcceptance(skipped, receipt, options)).toThrow(name);
    }
    for (const alter of [
      (r) => { r.state = 'hosts-attached'; }, (r) => { r.manifest.sha = 'b'.repeat(40); },
      (r) => { r.manifest.environment = 'production'; }, (r) => { r.plan.config.name = 'frigo'; },
      (r) => { r.hostProof.corsStatus = 403; }, (r) => { r.appProof.assets.sha = 'b'.repeat(40); },
      (r) => { r.hosts.state = 'detached'; }, (r) => { r.recoveryFailure = 'uncertain'; },
    ]) {
      const changed = structuredClone(receipt); alter(changed);
      expect(() => verifyStagingAcceptance(acceptance, changed, options)).toThrow('infrastructure');
    }
    for (const alter of [
      (a) => { a.releaseRunId = 124; }, (a) => { a.versionId = 'another-version'; },
      (a) => { a.acceptedAt = new Date(now + 1).toISOString(); },
      (a) => { a.acceptedAt = new Date(now - 86400001).toISOString(); },
      (a) => { a.checks.access.evidence = 'https://outside.example/proof'; },
      (a) => { a.checks.access.evidence += '?credential=private'; },
    ]) {
      const changed = structuredClone(acceptance); alter(changed);
      expect(() => verifyStagingAcceptance(changed, receipt, options)).toThrow();
    }
  });

  it('requires fresh production identity, full catalog and integrity certification', () => {
    expect(verifyProductionCertification(certification(), sha, now).versionId).toBe('previous-version');
    for (const alter of [
      (r) => { r.sha = 'b'.repeat(40); }, (r) => { r.environment = 'staging'; },
      (r) => { r.certification.result = 'PENDING'; }, (r) => { r.certification.readOnly = false; },
      (r) => { r.certification.productionMutations.push('upload'); },
      (r) => { r.certification.checkedAt = new Date(now - 2700001).toISOString(); },
      (r) => { r.certification.checkedAt = new Date(now + 1).toISOString(); },
      (r) => { r.catalog.releaseComplete = false; }, (r) => { r.productionBaseline.bindingVerified = false; },
      (r) => { r.productionBaseline.worker = 'frigo-staging'; }, (r) => { delete r.runtimeCatalog; },
    ]) {
      const changed = certification(); alter(changed);
      expect(() => verifyProductionCertification(changed, sha, now)).toThrow('certification');
    }
  });

  it('restricts the mutation surface to production deployment and individually owned host operations', () => {
    const base = `/accounts/${account}`;
    expect(isProductionMutation(`${base}/workers/scripts/frigo/deployments`, 'POST')).toBe(true);
    expect(isProductionMutation(`${base}/workers/domains`, 'PUT')).toBe(true);
    for (const size of [32, 40]) expect(isProductionMutation(`${base}/workers/domains/${'a'.repeat(size)}`, 'DELETE')).toBe(true);
    for (const [path, method] of [
      [`${base}/workers/scripts/frigo-staging/deployments`, 'POST'], [`${base}/workers/domains/replace_state`, 'PUT'],
      [`${base}/workers/domains/${'a'.repeat(40)}/other`, 'DELETE'], [`${base}/workers/domains`, 'DELETE'],
      [`${base}/workers/scripts/frigo/settings`, 'PUT'], [`/zones/${'a'.repeat(32)}/dns_records`, 'POST'],
    ]) expect(isProductionMutation(path, method)).toBe(false);
  });

  it('rejects local production execution before any provider read', async () => {
    await expect(productionProvider.prepare()).rejects.toThrow('Protected canonical production');
  });

  it('fences recovery to its exact recorded workflow, Worker and environment', () => {
    const context = { manifest: { repository: 'hello-tako/Takolio', environment: 'production', sha },
      audit: { worker: { name: 'frigo' } }, plan: { config: { name: 'frigo' } }, hosts: { environment: 'production' } };
    const env = { GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REPOSITORY: 'hello-tako/Takolio',
      GITHUB_REPOSITORY_ID: '1422954151', CLOUDFLARE_ACCOUNT_ID: account, GITHUB_SHA: sha, GITHUB_WORKFLOW_SHA: sha };
    expect(() => validateProductionRecovery(context, env)).not.toThrow();
    for (const alter of [
      (c) => { c.manifest.environment = 'staging'; }, (c) => { c.audit.worker.name = 'frigo-staging'; },
      (c) => { c.hosts.environment = 'staging'; }, (c) => { c.plan.config.name = 'frigo-staging'; },
    ]) {
      const changed = structuredClone(context); alter(changed);
      expect(() => validateProductionRecovery(changed, env)).toThrow('canonical production');
    }
    expect(() => validateProductionRecovery(context, { ...env, GITHUB_SHA: 'b'.repeat(40) })).toThrow();
  });
});

describe('production observation and recovery', () => {
  it('requires at least fifteen real minutes with repeated probes and persisted intermediate results', async () => {
    let time = now;
    const persist = vi.fn();
    const probe = vi.fn(async () => ({ sha }));
    const result = await observeProduction(probe, persist, { now: () => time, sleep: async (ms) => { time += ms; } });
    expect(result.elapsedMs).toBe(OBSERVATION_MS);
    expect(probe).toHaveBeenCalledTimes(31);
    expect(persist).toHaveBeenCalledTimes(31);
    expect(result.observations[30].proof.sha).toBe(sha);
  });

  it('stops observation immediately on failed probes', async () => {
    let time = now;
    const probe = vi.fn().mockResolvedValueOnce({ sha }).mockRejectedValueOnce(new Error('wrong source'));
    const persist = vi.fn();
    await expect(observeProduction(probe, persist, { now: () => time, sleep: async (ms) => { time += ms; } })).rejects.toThrow('wrong source');
    expect(persist).toHaveBeenCalledTimes(1);
  });

  it('recovers failed post-activation proofs and never reports completion', async () => {
    const context = {};
    const order = [];
    const fake = { prepare: async () => context, persist: vi.fn() };
    for (const step of ['build', 'upload', 'activate', 'proveLegacy', 'attach', 'finish', 'recover']) {
      fake[step] = vi.fn(async () => { order.push(step); });
    }
    fake.proveHosts = async () => { throw new Error('TLS failed'); };
    await expect(releaseProduction(fake)).rejects.toThrow('TLS failed');
    expect(order).toEqual(['build', 'upload', 'activate', 'proveLegacy', 'attach', 'recover']);
    expect(fake.finish).not.toHaveBeenCalled();
  });
});

it('uses protected production, immutable trusted main and a shared deployment lock', () => {
  const workflow = readFileSync('.github/workflows/domain-production-release.yml', 'utf8');
  expect(workflow).toContain('environment: production');
  expect(workflow).toContain('group: frigo-deploy-production');
  expect(workflow).toContain('default: false');
  expect(workflow.indexOf('test "$GITHUB_SHA" = "$RELEASE_SHA"')).toBeLessThan(workflow.indexOf('pnpm install --frozen-lockfile'));
  expect(workflow).not.toContain('ref: ${{ inputs.ref }}');
  expect(workflow).toContain('inputs.confirm_staging_acceptance == true');
  expect(workflow).toContain('inputs.confirm_production == true');
  expect(workflow).toContain('production-provider.mjs recover');
});

it('validates uploaded version identity before constructing any Cloudflare read path', async () => {
  const { productionUploadVersion } = await import('../../scripts/domain/production-release.mjs');
  const record = { type: 'version-upload', worker_name: 'frigo', version_id: '22222222-2222-4222-8222-222222222222' };
  expect(productionUploadVersion([record])).toBe(record.version_id);
  for (const value of [[], [record, record], [{ ...record, worker_name: 'frigo-staging' }],
    [{ ...record, version_id: '../../settings' }], [{ ...record, version_id: 'x'.repeat(36) }],
    [{ ...record, version_id: '22222222-2222-4222-8222-222222222222?secret=x' }]]) {
    expect(() => productionUploadVersion(value)).toThrow('reconciliation');
  }
});

it('retains only the reviewed public acceptance fields', () => {
  const { receipt, acceptance } = staging();
  acceptance.extra = 'private-value';
  acceptance.checks.access.extra = 'private-value';
  const result = verifyStagingAcceptance(acceptance, receipt, { sha, runId: 123, now });
  expect(JSON.stringify(result)).not.toContain('private-value');
  expect(result.checks.access).toEqual({ result: 'PASS', evidence: acceptance.checks.access.evidence });
});

it('joins certified production D1 and the exact prior deployment for continuity and recovery', async () => {
  const { createHash } = await import('node:crypto');
  const { productionRecoveryIdentity } = await import('../../scripts/domain/production-release.mjs');
  const certificate = certification();
  certificate.productionBaseline.accountIdentifierSha256 = createHash('sha256').update(account).digest('hex');
  certificate.cloudflare = { accountAuthenticated: true, databaseName: 'frigo-db', databaseId: 'f975ec39-b2c8-4a2a-80e1-0366054599d3' };
  const snapshot = { worker: { name: 'frigo', deploymentId: 'prior-deployment', versionId: 'previous-version',
    bindings: { DB: certificate.cloudflare.databaseId } } };
  const joined = productionRecoveryIdentity(certificate, snapshot);
  expect(joined.previousDeployment).toEqual({ deploymentId: 'prior-deployment', versionId: 'previous-version' });
  expect(joined.cloudflare.databaseId).toBe(certificate.cloudflare.databaseId);
  for (const change of [
    (c) => { c.cloudflare.databaseId = 'staging-db'; },
    (c) => { c.productionBaseline.accountIdentifierSha256 = '0'.repeat(64); },
    (c) => { c.productionBaseline.versionId = 'different-version'; },
  ]) {
    const changed = structuredClone(certificate); change(changed);
    expect(() => productionRecoveryIdentity(changed, snapshot)).toThrow('identity');
  }
});
