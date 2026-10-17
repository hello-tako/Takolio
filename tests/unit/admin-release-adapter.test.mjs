import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { canonical } from '../../scripts/admin-recovery.mjs';
import {
  OPERATIONS,
  executeRelease,
  validateGitHub,
  validateStagingCertificate,
  validateStagingReport,
  normalizeArtifactDigest,
  digest,
  renderConfigs,
  validateAuthorization,
  validateTarget,
} from '../../scripts/admin-release-adapter.mjs';

const key = () => generateKeyPairSync('ed25519');
const target = (environment, suffix, custodians) => ({
  enabled: true,
  accountId: `${suffix}`.repeat(32).slice(0, 32),
  adminWorker: `takosan-admin-${environment}`,
  facadeWorker: `takosan-admin-read-facade-${environment}`,
  adminDatabaseId: `${suffix.repeat(8).slice(0, 8)}-1111-4111-8111-111111111111`,
  adminDatabaseName: `takosan-admin-${environment}-db`,
  customerDatabaseId: `${String(Number(suffix) + 1).repeat(8).slice(0, 8)}-2222-4222-8222-222222222222`,
  customerDatabaseName: `takosan-customer-${environment}-db`,
  kvId: `${String(Number(suffix) + 2)}`.repeat(32).slice(0, 32),
  zoneId: `${String(Number(suffix) + 3)}`.repeat(32).slice(0, 32),
  hostname: `admin-${environment}.takosan.com`,
  accessApplicationId: `${String(Number(suffix) + 4).repeat(8).slice(0, 8)}-3333-4333-8333-333333333333`,
  issuer: 'https://team.cloudflareaccess.com',
  audience: 'a'.repeat(64),
  custodians,
});

function policyFixture() {
  const keys = [key(), key()];
  const custodians = keys.map(({publicKey}, i) => ({
    operatorId: `operator-${i + 1}`,
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    approvalRef: `approval-${i + 1}`,
  }));
  return {
    policy: {
      version: 1,
      repositoryId: 1422954151,
      repository: 'hello-tako/Takolio',
      branch: 'main',
      environments: {
        staging: target('staging', '1', custodians),
        production: target('production', '5', custodians),
      },
    },
    keys,
  };
}

function authorizationFixture() {
  const fixture = policyFixture();
  const sourceSha = 'a'.repeat(40);
  const context = {
    sourceSha,
    environment: 'staging',
    operation: 'deploy-disabled',
    runId: '42',
    runAttempt: '1',
    migrationDigest: 'b'.repeat(64),
    auditArtifactDigest: 'sha256:' + 'f'.repeat(64),
  };
  const manifest = {
    version: 1,
    id: 'release-42',
    sourceSha,
    environment: 'staging',
    operation: 'deploy-disabled',
    runId: '42',
    policyDigest: digest(fixture.policy),
    migrationDigest: context.migrationDigest,
    issuedAt: '2026-10-17T00:00:00.000Z',
    expiresAt: '2026-10-17T00:30:00.000Z',
    payload: {},
  };
  const approvals = fixture.keys.map(({privateKey}, i) => ({
    operatorId: `operator-${i + 1}`,
    signature: sign(null, Buffer.from(canonical(manifest)), privateKey).toString('base64url'),
  }));
  return { fixture, context, bundle: { manifest, approvals } };
}

describe('Admin offline release adapter', () => {
  it('keeps the release operation set finite and explicit', () => {
    expect(OPERATIONS).toEqual(['deploy-disabled', 'migrate', 'bootstrap', 'recover', 'disable', 'rollback-disabled']);
  });

  it('fails closed when target identities are still placeholders', () => {
    const policy = JSON.parse(readFileSync('admin/release-policy.json', 'utf8'));
    expect(() => validateTarget(policy, 'staging')).toThrow(/disabled|unsafe target identity/i);
  });

  it('rejects the former repository and approvals signed for its policy', () => {
    const { fixture, context, bundle } = authorizationFixture();
    fixture.policy.repositoryId = 1385308553;
    fixture.policy.repository = 'lol-vn/Tako-san';
    bundle.manifest.policyDigest = digest(fixture.policy);
    bundle.approvals = fixture.keys.map(({ privateKey }, i) => ({
      operatorId: `operator-${i + 1}`,
      signature: sign(null, Buffer.from(canonical(bundle.manifest)), privateKey).toString('base64url'),
    }));
    expect(() => validateTarget(fixture.policy, 'staging')).toThrow('Untrusted release policy');
    fixture.policy.repositoryId = 1422954151;
    fixture.policy.repository = 'hello-tako/Takolio';
    expect(() => validateAuthorization(bundle, fixture.policy, context, Date.parse('2026-10-17T00:10:00.000Z'))).toThrow(/mismatch/);
  });

  it('accepts only a distinct, fully identified staging target', () => {
    const fixture = policyFixture();
    expect(validateTarget(fixture.policy, 'staging').adminWorker).toBe('takosan-admin-staging');
    fixture.policy.environments.production.adminDatabaseId = fixture.policy.environments.staging.adminDatabaseId;
    expect(() => validateTarget(fixture.policy, 'staging')).toThrow(/distinct/);
  });

  it('binds two signatures to the exact source, policy, run and operation', () => {
    const { fixture, context, bundle } = authorizationFixture();
    const authorized = validateAuthorization(bundle, fixture.policy, context, Date.parse('2026-10-17T00:10:00.000Z'));
    expect(authorized.manifest.sourceSha).toBe(context.sourceSha);
    bundle.manifest.operation = 'migrate';
    expect(() => validateAuthorization(bundle, fixture.policy, context, Date.parse('2026-10-17T00:10:00.000Z'))).toThrow(/signature|operation|mismatch/i);
  });

  it('rejects replay, single approval and arbitrary operation payloads', () => {
    const { fixture, context, bundle } = authorizationFixture();
    bundle.manifest.expiresAt = '2026-10-17T00:09:00.000Z';
    expect(() => validateAuthorization(bundle, fixture.policy, context, Date.parse('2026-10-17T00:10:00.000Z'))).toThrow(/expired/);
    const next = authorizationFixture();
    next.bundle.approvals.pop();
    expect(() => validateAuthorization(next.bundle, next.fixture.policy, next.context, Date.parse('2026-10-17T00:10:00.000Z'))).toThrow(/authorization/);
    const payload = authorizationFixture();
    payload.bundle.manifest.payload = { sql: 'DELETE FROM admin_role_assignments' };
    expect(() => validateAuthorization(payload.bundle, payload.fixture.policy, payload.context, Date.parse('2026-10-17T00:10:00.000Z'))).toThrow(/payload|signature/);
  });

  it('renders isolated environment configs with Admin disabled', () => {
    const fixture = policyFixture();
    const configs = renderConfigs(fixture.policy.environments.staging, 'staging', 'a'.repeat(40), {
      admin: { name: 'template', vars: {}, d1_databases: [], kv_namespaces: [], services: [] },
      facade: { name: 'template', vars: {}, d1_databases: [] },
    });
    expect(configs.admin.name).toBe('takosan-admin-staging');
    expect(configs.admin.vars.ADMIN_CONSOLE_ENABLED).toBe('false');
    expect(configs.admin.d1_databases[0].database_id).toBe(fixture.policy.environments.staging.adminDatabaseId);
    expect(configs.facade.d1_databases[0].database_id).toBe(fixture.policy.environments.staging.customerDatabaseId);
    expect(configs.admin.d1_databases).not.toEqual(configs.facade.d1_databases);
  });
});

function githubFixture(context) {
  return {
    repository: { id: 1422954151, full_name: 'hello-tako/Takolio', default_branch: 'main' },
    branch: { protected: true, commit: { sha: context.sourceSha } },
    protection: { enforce_admins: { enabled: true }, required_pull_request_reviews: { required_approving_review_count: 1, dismiss_stale_reviews: true },
      required_status_checks: { strict: true, contexts: ['validate-admin'] } },
    environment: { id: 123, can_admins_bypass: false, protection_rules: [{ type: 'required_reviewers', prevent_self_review: true, reviewers: [{ type: 'User' }] }],
      deployment_branch_policy: { protected_branches: true, custom_branch_policies: false } },
    run: { id: 42, run_attempt: 1, event: 'workflow_dispatch', head_sha: context.sourceSha, head_branch: 'main', path: '.github/workflows/admin-staging-deploy.yml',
      actor: { id: 1, type: 'User' }, triggering_actor: { id: 1 }, repository: { id: 1422954151 } },
    ci: [{ head_sha: context.sourceSha, path: '.github/workflows/admin-ci.yml', status: 'completed', conclusion: 'success', event: 'push', repository: { id: 1422954151 } }],
    approvals: [{ state: 'approved', user: { id: 2, type: 'User' }, environments: [{ id: 123 }] }],
    artifact: { name: 'admin-pre-action-42', expired: false, digest: 'sha256:' + 'f'.repeat(64), workflow_run: { id: 42, head_sha: context.sourceSha } },
  };
}

describe('Admin release policy failure boundaries', () => {
  it.each([
    ['source mismatch', c => { c.sourceSha = 'c'.repeat(40); }],
    ['environment mismatch', c => { c.environment = 'production'; }],
    ['operation mismatch', c => { c.operation = 'migrate'; }],
    ['run mismatch', c => { c.runId = '43'; }],
    ['rerun', c => { c.runAttempt = '2'; }],
    ['migration mismatch', c => { c.migrationDigest = 'd'.repeat(64); }],
  ])('rejects signed authorization with %s', (_name, mutate) => {
    const { fixture, context, bundle } = authorizationFixture();
    mutate(context);
    expect(() => validateAuthorization(bundle, fixture.policy, context, Date.parse('2026-10-17T00:10:00.000Z'))).toThrow();
  });

  it.each([
    ['same signer', f => { f.bundle.approvals[1] = f.bundle.approvals[0]; }],
    ['invalid signature', f => { f.bundle.approvals[0].signature = 'a'.repeat(86); }],
    ['changed policy', f => { f.fixture.policy.environments.staging.hostname = 'changed.takosan.com'; }],
    ['injected SQL payload', f => { f.bundle.manifest.payload = { sql: 'DELETE FROM operator_identity_bindings' }; }],
    ['unbounded expiry', f => { f.bundle.manifest.expiresAt = '2026-10-17T02:00:00.000Z'; }],
  ])('rejects %s', (_name, mutate) => {
    const f = authorizationFixture();
    mutate(f);
    expect(() => validateAuthorization(f.bundle, f.fixture.policy, f.context, Date.parse('2026-10-17T00:10:00.000Z'))).toThrow();
  });

  it.each([
    ['self review', f => { f.environment.protection_rules[0].prevent_self_review = false; }],
    ['bypass enabled', f => { f.environment.can_admins_bypass = true; }],
    ['unprotected branch', f => { f.branch.protected = false; }],
    ['missing approval count', f => { delete f.protection.required_pull_request_reviews.required_approving_review_count; }],
    ['stale review reuse', f => { f.protection.required_pull_request_reviews.dismiss_stale_reviews = false; }],
    ['wrong exact main', f => { f.branch.commit.sha = 'c'.repeat(40); }],
    ['wrong repository id', f => { f.repository.id = 1; }],
    ['former repository id', f => { f.repository.id = 1385308553; }],
    ['former repository name', f => { f.repository.full_name = 'lol-vn/Tako-san'; }],
    ['former dispatch repository', f => { f.run.repository.id = 1385308553; }],
    ['former CI repository', f => { f.ci[0].repository.id = 1385308553; }],
    ['missing CI', f => { f.ci = []; }],
    ['CI from another SHA', f => { f.ci[0].head_sha = 'c'.repeat(40); }],
    ['CI from PR context', f => { f.ci[0].event = 'pull_request'; }],
    ['run from another workflow', f => { f.run.path = '.github/workflows/deploy.yml'; }],
    ['run from another actor', f => { f.run.triggering_actor.id = 10; }],
    ['self approval', f => { f.approvals[0].user.id = 1; }],
    ['approval for another environment', f => { f.approvals[0].environments[0].id = 456; }],
    ['missing pre-action audit', f => { delete f.artifact; }],
    ['wrong audit run', f => { f.artifact.workflow_run.id = 99; }],
    ['wrong audit digest', f => { f.artifact.digest = 'sha256:' + '0'.repeat(64); }],
    ['expired pre-action audit', f => { f.artifact.expired = true; }],
  ])('blocks %s before credentials can mutate Cloudflare', (_name, mutate) => {
    const { context } = authorizationFixture();
    const facts = githubFixture(context);
    expect(() => validateGitHub(facts, { ...context, requireAudit: true })).not.toThrow();
    mutate(facts);
    expect(() => validateGitHub(facts, { ...context, requireAudit: true })).toThrow();
  });

  const fakeProvider = () => Object.fromEntries(['verifyTargets', 'verifyConsoleDisabled', 'verifyLedger', 'verifyExistingDatabaseIdentity', 'applyMigrations', 'bindDatabaseIdentity',
    'verifyDatabaseIdentity', 'verifySecrets', 'deploy', 'verifyDisabled', 'verifyRollback', 'rollback', 'verifyBootstrapRoster', 'bootstrap',
    'recoveryRoster', 'recover', 'deploymentVersions', 'captureRollback', 'restoreRollback', 'verifyShutdownTarget', 'shutdown'].map(name => [name, vi.fn(async () => ({}))]));
  const operationFixture = operation => {
    const { fixture, context, bundle } = authorizationFixture();
    context.operation = operation;
    bundle.manifest.operation = operation;
    bundle.manifest.expiresAt = new Date(Date.now() + 60000).toISOString();
    return { authorized: { manifest: bundle.manifest, target: fixture.policy.environments.staging }, context, provider: fakeProvider() };
  };

  it('has no side effects when target checks fail', async () => {
    const { authorized, context, provider } = operationFixture('deploy-disabled');
    provider.verifyTargets.mockRejectedValue(new Error('mismatch'));
    await expect(executeRelease(authorized, context, provider)).rejects.toThrow('mismatch');
    expect(provider.deploy).not.toHaveBeenCalled();
    expect(provider.applyMigrations).not.toHaveBeenCalled();
  });

  it('deploys only the internal facade and disabled Admin after identity/schema checks', async () => {
    const { authorized, context, provider } = operationFixture('deploy-disabled');
    await expect(executeRelease(authorized, context, provider)).resolves.toMatchObject({ result: 'PASS', consoleEnabled: false });
    expect(provider.deploy.mock.calls).toEqual([['facade'], ['admin']]);
    expect(provider.verifyTargets.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(provider.verifySecrets.mock.invocationCallOrder[0]).toBeLessThan(provider.deploy.mock.invocationCallOrder[0]);
    expect(provider.verifyDisabled).toHaveBeenCalledWith(authorized.target, context.sourceSha);
  });

  it('contains Admin even when D1, facade, secrets, and rollback checks are unavailable', async () => {
    const { authorized, context, provider } = operationFixture('disable');
    for (const name of ['verifyTargets', 'verifyLedger', 'verifyDatabaseIdentity', 'verifyConsoleDisabled', 'verifySecrets', 'captureRollback']) {
      provider[name].mockRejectedValue(new Error('Dependency unavailable'));
    }
    await expect(executeRelease(authorized, context, provider)).resolves.toMatchObject({ result: 'PASS', consoleEnabled: false });
    expect(provider.shutdown).toHaveBeenCalledOnce();
    expect(provider.verifyShutdownTarget).toHaveBeenCalledTimes(2);
    expect(provider.verifyDisabled).toHaveBeenCalledWith(authorized.target, context.sourceSha, true);
    expect(provider.deploymentVersions).toHaveBeenCalledWith([authorized.target.adminWorker]);
    expect(provider.deploy).not.toHaveBeenCalled();
    expect(provider.verifyLedger).not.toHaveBeenCalled();
  });

  it('does not perform containment when the narrow target identity mismatches', async () => {
    const { authorized, context, provider } = operationFixture('disable');
    provider.verifyShutdownTarget.mockRejectedValue(new Error('wrong Worker'));
    await expect(executeRelease(authorized, context, provider)).rejects.toThrow('wrong Worker');
    expect(provider.shutdown).not.toHaveBeenCalled();
  });

  it('restores only approved disabled versions after containment and compensates to containment on failure', async () => {
    const { authorized, context, provider } = operationFixture('rollback-disabled');
    authorized.manifest.payload = { adminVersion: 'safe-admin', facadeVersion: 'safe-facade', previousSha: 'f'.repeat(40) };
    provider.captureRollback.mockResolvedValue({ shutdown: true });
    provider.rollback.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('switch failed'));
    await expect(executeRelease(authorized, context, provider)).rejects.toThrow('switch failed');
    expect(provider.verifyTargets).toHaveBeenCalledWith(authorized.target, context.environment, true);
    expect(provider.restoreRollback).toHaveBeenCalledWith({ shutdown: true });
  });

  it('does not migrate a database with an unexpected existing identity', async () => {
    const { authorized, context, provider } = operationFixture('migrate');
    provider.verifyExistingDatabaseIdentity.mockRejectedValue(new Error('wrong database'));
    await expect(executeRelease(authorized, context, provider)).rejects.toThrow('wrong database');
    expect(provider.applyMigrations).not.toHaveBeenCalled();
  });

  it('rechecks the migration ledger after apply and stops before identity binding on failure', async () => {
    const { authorized, context, provider } = operationFixture('migrate');
    provider.verifyLedger.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('partial ledger'));
    await expect(executeRelease(authorized, context, provider)).rejects.toThrow('partial ledger');
    expect(provider.bindDatabaseIdentity).not.toHaveBeenCalled();
  });

  it('verifies both rollback targets before switching either Worker', async () => {
    const { authorized, context, provider } = operationFixture('rollback-disabled');
    authorized.manifest.payload = { adminVersion: 'admin-version', facadeVersion: 'facade-version', previousSha: 'e'.repeat(40) };
    provider.verifyRollback.mockRejectedValue(new Error('enabled version'));
    await expect(executeRelease(authorized, context, provider)).rejects.toThrow('enabled version');
    expect(provider.rollback).not.toHaveBeenCalled();
  });

  it('attempts compensating rollback when the second Worker fails, and never reports PASS', async () => {
    const { authorized, context, provider } = operationFixture('deploy-disabled');
    provider.captureRollback.mockResolvedValue({ adminVersion: 'safe-admin', facadeVersion: 'safe-facade' });
    provider.deploy.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error('admin deploy failed'));
    await expect(executeRelease(authorized, context, provider)).rejects.toThrow('admin deploy failed');
    expect(provider.restoreRollback).toHaveBeenCalledWith({ adminVersion: 'safe-admin', facadeVersion: 'safe-facade' });
  });

  it('requires a complete eligible roster before one atomic bootstrap statement', async () => {
    const { authorized, context, provider } = operationFixture('bootstrap');
    authorized.manifest.payload = { userIds: ['operator-1', 'operator-2', 'operator-3'], approvalRef: 'human-approval' };
    provider.verifyBootstrapRoster.mockRejectedValue(new Error('revoked operator'));
    await expect(executeRelease(authorized, context, provider)).rejects.toThrow('revoked operator');
    expect(provider.bootstrap).not.toHaveBeenCalled();
  });

  it('rejects recovery without signatures valid against the current live roster', async () => {
    const { authorized, context, provider } = operationFixture('recover');
    authorized.manifest.payload = { manifest: {}, approvals: [] };
    provider.recoveryRoster.mockResolvedValue([]);
    await expect(executeRelease(authorized, context, provider)).rejects.toThrow();
    expect(provider.recover).not.toHaveBeenCalled();
  });
});

it('rejects customer database reuse when validating production as well as staging', () => {
  const { policy } = policyFixture();
  policy.environments.production.customerDatabaseId = policy.environments.staging.customerDatabaseId;
  expect(() => validateTarget(policy, 'production')).toThrow(/production customer D1/);
  expect(() => validateTarget(policy, 'staging')).toThrow(/production customer D1/);
});

function certificateFixture() {
  const { policy, keys } = policyFixture();
  const context = { sourceSha: 'a'.repeat(40) };
  const manifest = { version: 1, sourceSha: context.sourceSha, policyDigest: digest(policy), stagingDatabaseId: policy.environments.staging.adminDatabaseId,
    completedAt: '2026-10-17T00:00:00.000Z', expiresAt: '2026-10-18T00:00:00.000Z', independentReviewDigest: 'b'.repeat(64),
    artifactId: '1234', artifactDigest: 'c'.repeat(64), checks: Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`ST${String(i + 1).padStart(2, '0')}`, 'PASS'])) };
  const approvals = keys.map(({ privateKey }, i) => ({ operatorId: `operator-${i + 1}`, signature: sign(null, Buffer.from(canonical(manifest)), privateKey).toString('base64url') }));
  return { policy, context, certificate: { manifest, approvals } };
}

describe('Production staging certification gate', () => {
  it('requires both signatures over all twenty exact-source staging checks and artifact identity', () => {
    const { policy, context, certificate } = certificateFixture();
    expect(validateStagingCertificate(certificate, policy, context, Date.parse('2026-10-17T00:10:00.000Z'))).toBe(certificate.manifest);
  });

  it.each([
    ['missing check', c => { delete c.manifest.checks.ST20; }],
    ['failed check', c => { c.manifest.checks.ST01 = 'FAIL'; }],
    ['unrun check', c => { c.manifest.checks.ST14 = 'NOT_RUN'; }],
    ['changed source', c => { c.manifest.sourceSha = 'd'.repeat(40); }],
    ['missing review', c => { c.manifest.independentReviewDigest = ''; }],
    ['changed artifact', c => { c.manifest.artifactDigest = 'd'.repeat(64); }],
    ['single signer', c => { c.approvals.pop(); }],
    ['duplicated signer', c => { c.approvals[1] = c.approvals[0]; }],
    ['expired', c => { c.manifest.expiresAt = '2026-10-17T00:05:00.000Z'; }],
  ])('rejects production certification with %s', (_name, mutate) => {
    const { policy, context, certificate } = certificateFixture();
    mutate(certificate);
    expect(() => validateStagingCertificate(certificate, policy, context, Date.parse('2026-10-17T00:10:00.000Z'))).toThrow();
  });
});


it('validates a separately signed completed report before its artifact ID exists', () => {
  const { policy, keys } = policyFixture();
  const { certificate, context } = certificateFixture();
  const manifest = { ...certificate.manifest, policyDigest: digest(policy) };
  delete manifest.artifactId;
  delete manifest.artifactDigest;
  const approvals = keys.map(({ privateKey }, i) => ({ operatorId: `operator-${i + 1}`,
    signature: sign(null, Buffer.from(canonical(manifest)), privateKey).toString('base64url') }));
  const report = { manifest, approvals };
  expect(validateStagingReport(report, policy, context, Date.parse('2026-10-17T00:10:00.000Z'))).toBe(manifest);
  expect(() => validateStagingCertificate(report, policy, context, Date.parse('2026-10-17T00:10:00.000Z'))).toThrow();
  report.manifest.checks.ST20 = 'NOT_RUN';
  expect(() => validateStagingReport(report, policy, context, Date.parse('2026-10-17T00:10:00.000Z'))).toThrow();
});

it('normalizes the pinned upload action bare digest at the real context boundary', () => {
  expect(normalizeArtifactDigest('f'.repeat(64))).toBe('sha256:' + 'f'.repeat(64));
  expect(normalizeArtifactDigest('sha256:' + 'f'.repeat(64))).toBeUndefined();
  expect(normalizeArtifactDigest('invalid')).toBeUndefined();
});
