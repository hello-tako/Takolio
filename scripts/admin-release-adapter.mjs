#!/usr/bin/env node
import { createHash, createPublicKey, verify } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createProvider } from './admin-release-provider.mjs';
import { canonical, verifyRecovery } from './admin-recovery.mjs';
import { buildBootstrapAdminSql } from './admin-local-lib.mjs';
import { STAGING_TEST_OPERATIONS, validateStagingTestPayload } from './admin-staging-test-identities.mjs';

export const OPERATIONS = ['initialize-disabled', 'restore-initial-disabled', 'deploy-disabled', 'enable', 'migrate', 'provision-hmac', 'enroll-owner', 'bootstrap', 'recover', ...STAGING_TEST_OPERATIONS, 'disable', 'rollback-disabled'];
export const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : canonical(value)).digest('hex');
const exact = (value, keys) => value && canonical(Object.keys(value).sort()) === canonical([...keys].sort());
const sha = /^[a-f0-9]{40}$/;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const hex32 = /^[a-f0-9]{32}$/;
const name = /^[a-z][a-z0-9-]{2,62}$/;
const keyFingerprint = pem => {
  const key = createPublicKey(pem);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Ed25519 custodian key required');
  return digest(key.export({ format: 'der', type: 'spki' }));
};

export function validateTarget(policy, environment) {
  if (!exact(policy, ['version', 'repositoryId', 'repository', 'branch', 'environments']) || policy.version !== 1 ||
      policy.repositoryId !== 1422954151 || policy.repository !== 'hello-tako/Takolio' || policy.branch !== 'main' ||
      !exact(policy.environments, ['staging', 'production']) || !['staging', 'production'].includes(environment)) throw new Error('Untrusted release policy');
  const target = policy.environments[environment];
  if (!exact(target, ['enabled', 'accountId', 'adminWorker', 'facadeWorker', 'adminDatabaseId', 'adminDatabaseName',
    'customerDatabaseId', 'customerDatabaseName', 'kvId', 'zoneId', 'hostname', 'accessApplicationId', 'issuer', 'audience', 'custodians']) ||
      target.enabled !== true) throw new Error('Release execution is disabled');
  if (![target.accountId, target.kvId, target.zoneId].every(v => hex32.test(v) && !/^0+$/.test(v)) ||
      ![target.adminDatabaseId, target.customerDatabaseId, target.accessApplicationId].every(v => uuid.test(v) && !/^00000000-/.test(v)) ||
      target.adminDatabaseId === target.customerDatabaseId ||
      ![target.adminWorker, target.facadeWorker, target.adminDatabaseName, target.customerDatabaseName].every(v => name.test(v)) ||
      !/^(?:takosan|takolio)-admin(?:-[a-z0-9-]+)?$/.test(target.adminWorker) ||
      !/^(?:takosan|takolio)-admin-read-facade(?:-[a-z0-9-]+)?$/.test(target.facadeWorker) ||
      target.adminWorker === target.facadeWorker || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(target.hostname) ||
      /\.(?:test|invalid|example|localhost)$/.test(target.hostname) ||
      !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(target.issuer) || !/^[a-f0-9]{64}$/.test(target.audience)) throw new Error('Missing or unsafe target identity');
  const other = policy.environments[environment === 'staging' ? 'production' : 'staging'];
  for (const field of ['adminWorker', 'facadeWorker', 'adminDatabaseId', 'kvId', 'hostname', 'accessApplicationId']) {
    if (other[field] && target[field] === other[field]) throw new Error('Staging/production resources must be distinct');
  }
  if (other.customerDatabaseId && target.customerDatabaseId === other.customerDatabaseId) throw new Error('Staging cannot read production customer D1');
  if (!Array.isArray(target.custodians) || target.custodians.length < 1 || target.custodians.length > 10 ||
      target.custodians.some(c => !exact(c, ['operatorId', 'publicKey', 'approvalRef']) || !/^[A-Za-z0-9_-]{8,64}$/.test(c.operatorId) ||
        typeof c.approvalRef !== 'string' || c.approvalRef.length < 8 || c.approvalRef.length > 200) ||
      new Set(target.custodians.map(c => c.operatorId)).size !== target.custodians.length ||
      new Set(target.custodians.map(c => keyFingerprint(c.publicKey))).size !== target.custodians.length) throw new Error('Owner signing key required');
  return target;
}

export function validateAuthorization(bundle, policy, context, now = Date.now()) {
  const target = validateTarget(policy, context.environment);
  if (!exact(bundle, ['manifest', 'approvals']) || !exact(bundle.manifest, ['version', 'id', 'sourceSha', 'environment', 'operation', 'runId',
    'policyDigest', 'migrationDigest', 'issuedAt', 'expiresAt', 'payload']) || !Array.isArray(bundle.approvals) || bundle.approvals.length !== 1) throw new Error('Invalid owner release authorization');
  const m = bundle.manifest;
  if (m.version !== 1 || !/^[A-Za-z0-9_-]{8,48}$/.test(m.id) || !sha.test(m.sourceSha) ||
      m.sourceSha !== context.sourceSha || m.environment !== context.environment || m.operation !== context.operation || !OPERATIONS.includes(m.operation) ||
      !/^[1-9][0-9]{0,19}$/.test(m.runId) || m.runId !== context.runId || m.policyDigest !== digest(policy) || m.migrationDigest !== context.migrationDigest ||
      context.runAttempt !== '1') throw new Error('Release source, target, operation or run mismatch');
  const issued = Date.parse(m.issuedAt), expires = Date.parse(m.expiresAt);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || issued > now || expires <= now || expires - issued > 3600000) throw new Error('Release authorization expired');
  if (new Set(bundle.approvals.map(a => a.operatorId)).size !== 1) throw new Error('One owner signature required');
  for (const approval of bundle.approvals) {
    const custodian = target.custodians.find(c => c.operatorId === approval.operatorId);
    if (!exact(approval, ['operatorId', 'signature']) || !custodian || !/^[A-Za-z0-9_-]{86}$/.test(approval.signature) ||
        !verify(null, Buffer.from(canonical(m)), createPublicKey(custodian.publicKey), Buffer.from(approval.signature, 'base64url'))) throw new Error('Invalid release signature');
  }
  if (['initialize-disabled', 'restore-initial-disabled', 'deploy-disabled', 'enable', 'migrate', 'provision-hmac', 'disable'].includes(m.operation) && !exact(m.payload, [])) throw new Error('Unexpected operation payload');
  if (m.operation === 'enroll-owner' && (!exact(m.payload, ['userId', 'subject', 'email', 'displayName', 'approvalRef']) ||
      !/^[A-Za-z0-9_.:-]{1,128}$/.test(m.payload.userId) || !/^[A-Za-z0-9_.:@-]{1,128}$/.test(m.payload.subject) ||
      typeof m.payload.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.payload.email) || m.payload.email.length > 254 ||
      typeof m.payload.displayName !== 'string' || !m.payload.displayName.trim() || m.payload.displayName.length > 200 ||
      typeof m.payload.approvalRef !== 'string' || m.payload.approvalRef.length < 8 || m.payload.approvalRef.length > 200)) throw new Error('Invalid owner enrollment payload');
  if (STAGING_TEST_OPERATIONS.includes(m.operation)) validateStagingTestPayload(m.operation, m.environment, m.payload);
  if (m.operation === 'bootstrap' && (!exact(m.payload, ['userIds', 'approvalRef']) || !Array.isArray(m.payload.userIds) || m.payload.userIds.length !== 1 ||
      new Set(m.payload.userIds).size !== 1 || !m.payload.userIds.every(v => /^[A-Za-z0-9_.:-]{1,128}$/.test(v)) ||
      typeof m.payload.approvalRef !== 'string' || m.payload.approvalRef.length < 8 || m.payload.approvalRef.length > 200)) throw new Error('Invalid bootstrap payload');
  if (m.operation === 'recover' && !exact(m.payload, ['manifest', 'approvals'])) throw new Error('Invalid recovery payload');
  if (m.operation === 'rollback-disabled' && (!exact(m.payload, ['adminVersion', 'facadeVersion', 'previousSha']) ||
      !uuid.test(m.payload.adminVersion) || !uuid.test(m.payload.facadeVersion) || !sha.test(m.payload.previousSha))) throw new Error('Invalid rollback payload');
  return { target, signer: target.custodians.find(c => c.operatorId === bundle.approvals[0].operatorId), manifest: m, authorizationDigest: digest(bundle), policyDigest: digest(policy) };
}

function validateStagingAttestation(certificate, policy, context, now, artifactRequired) {
  const target = validateTarget(policy, 'production');
  validateTarget(policy, 'staging');
  const fields = ['version', 'sourceSha', 'policyDigest', 'stagingDatabaseId', 'completedAt', 'expiresAt',
    'independentReviewDigest', 'checks', ...(artifactRequired ? ['artifactId', 'artifactDigest'] : [])];
  if (!exact(certificate, ['manifest', 'approvals']) || !exact(certificate.manifest, fields)) throw new Error('Signed staging certification required');
  const m = certificate.manifest;
  if (m.version !== 1 || m.sourceSha !== context.sourceSha || m.policyDigest !== digest(policy) ||
      m.stagingDatabaseId !== policy.environments.staging.adminDatabaseId || !/^[a-f0-9]{64}$/.test(m.independentReviewDigest) ||
      (artifactRequired && (!/^[a-f0-9]{64}$/.test(m.artifactDigest) || !/^[1-9][0-9]{0,19}$/.test(m.artifactId))) ||
      !exact(m.checks, Array.from({ length: 20 }, (_, i) => `ST${String(i + 1).padStart(2, '0')}`)) ||
      Object.values(m.checks).some(v => v !== 'PASS')) throw new Error('Incomplete exact-source staging certification');
  const completed = Date.parse(m.completedAt), expires = Date.parse(m.expiresAt);
  if (!Number.isFinite(completed) || !Number.isFinite(expires) || completed > now || expires <= now || expires - completed > 7 * 86400000) throw new Error('Staging certification expired');
  if (!Array.isArray(certificate.approvals) || certificate.approvals.length !== 1 || new Set(certificate.approvals.map(a => a.operatorId)).size !== 1) throw new Error('Owner staging attestation required');
  for (const a of certificate.approvals) {
    const custodian = target.custodians.find(c => c.operatorId === a.operatorId);
    if (!exact(a, ['operatorId', 'signature']) || !custodian || !/^[A-Za-z0-9_-]{86}$/.test(a.signature) ||
        !verify(null, Buffer.from(canonical(m)), createPublicKey(custodian.publicKey), Buffer.from(a.signature, 'base64url'))) throw new Error('Invalid staging attestation');
  }
  return m;
}

export function validateStagingCertificate(certificate, policy, context, now = Date.now()) {
  return validateStagingAttestation(certificate, policy, context, now, true);
}

export function validateStagingReport(report, policy, context, now = Date.now()) {
  return validateStagingAttestation(report, policy, context, now, false);
}

export function validateGitHub(facts, context) {
  const { repository, branch, protection, environment, run, ci, approvals, artifact } = facts;
  if (repository.id !== 1422954151 || repository.full_name !== 'hello-tako/Takolio' || repository.default_branch !== 'main' ||
      branch.commit?.sha !== context.sourceSha || !branch.protected || !protection.enforce_admins?.enabled ||
      !(protection.required_pull_request_reviews?.required_approving_review_count >= 1) || !protection.required_pull_request_reviews?.dismiss_stale_reviews ||
      !protection.required_status_checks?.strict || !(protection.required_status_checks.contexts ?? []).includes('validate-admin')) throw new Error('Protected exact-main source required');
  const required = environment.protection_rules?.find(r => r.type === 'required_reviewers');
  if (!required?.prevent_self_review || !required.reviewers?.length || environment.can_admins_bypass !== false ||
      environment.deployment_branch_policy?.protected_branches !== true || environment.deployment_branch_policy?.custom_branch_policies !== false) throw new Error('Protected environment policy required');
  const expectedWorkflow = { staging: '.github/workflows/admin-staging-deploy.yml', production: '.github/workflows/admin-production-deploy.yml',
    migrate: '.github/workflows/admin-d1-migrate.yml', recover: '.github/workflows/admin-breakglass.yml' };
  const expectedPath = context.operation === 'disable' ? '.github/workflows/admin-emergency-disable.yml' : context.operation === 'migrate' ? expectedWorkflow.migrate : ['provision-hmac', 'enroll-owner', 'bootstrap', 'recover', ...STAGING_TEST_OPERATIONS].includes(context.operation) ? expectedWorkflow.recover : expectedWorkflow[context.environment];
  if (String(run.id) !== context.runId || run.run_attempt !== 1 || run.event !== 'workflow_dispatch' || run.head_sha !== context.sourceSha ||
      run.head_branch !== 'main' || run.path !== expectedPath || run.actor?.type !== 'User' || run.triggering_actor?.id !== run.actor.id ||
      run.repository?.id !== 1422954151 || !ci.some(c => c.head_sha === context.sourceSha && c.path === '.github/workflows/admin-ci.yml' &&
        c.status === 'completed' && c.conclusion === 'success' && c.event === 'push' && c.repository?.id === 1422954151)) throw new Error('Exact-source dispatch and CI required');
  if (!approvals.some(a => a.state === 'approved' && a.user?.type === 'User' && a.user.id !== run.actor.id &&
      a.environments?.some(e => e.id === environment.id))) throw new Error('Independent environment approval required');
  if (context.requireAudit && (!artifact || artifact.expired || artifact.name !== `admin-pre-action-${context.runId}` ||
      artifact.workflow_run?.head_sha !== context.sourceSha || String(artifact.workflow_run?.id) !== context.runId ||
      !/^sha256:[a-f0-9]{64}$/.test(context.auditArtifactDigest ?? '') || artifact.digest !== context.auditArtifactDigest)) throw new Error('Immutable pre-action audit artifact required');
}

export function renderConfigs(target, environment, sourceSha, templates) {
  const admin = structuredClone(templates.admin), facade = structuredClone(templates.facade);
  admin.name = target.adminWorker;
  admin.account_id = facade.account_id = target.accountId;
  admin.preview_urls = false;
  admin.routes = [{ pattern: target.hostname, custom_domain: true }];
  admin.d1_databases = [{ binding: 'ADMIN_DB', database_name: target.adminDatabaseName, database_id: target.adminDatabaseId, migrations_dir: 'migrations-admin' }];
  admin.kv_namespaces = [{ binding: 'CACHE', id: target.kvId }];
  admin.services = [{ binding: 'CUSTOMER_READ', service: target.facadeWorker, entrypoint: 'AdminCustomerReadFacade' }];
  admin.vars = { ...admin.vars, ENVIRONMENT: environment, ADMIN_CONSOLE_ENABLED: 'false', ADMIN_AUTH_MODE: 'cloudflare_access',
    ADMIN_ORIGIN: `https://${target.hostname}`, ADMIN_ACCESS_TEAM_DOMAIN: new URL(target.issuer).hostname, ADMIN_ACCESS_AUD: target.audience,
    GIT_COMMIT: sourceSha, ADMIN_SCHEMA_VERSION: '4', CUSTOMER_APP_URL: environment === 'production' ? 'https://takolio.app' : 'https://staging.takolio.app' };
  facade.name = target.facadeWorker;
  facade.routes = [];
  facade.vars = { ...facade.vars, ENVIRONMENT: environment, GIT_COMMIT: sourceSha, ADMIN_SCHEMA_VERSION: '4' };
  facade.d1_databases = [{ binding: 'DB', database_name: target.customerDatabaseName, database_id: target.customerDatabaseId }];
  return { admin, facade };
}

export async function executeRelease(authorized, context, provider) {
  const { manifest: m, target } = authorized;
  // Identity checks and a pre-action durable artifact precede every mutation.
  if (Date.parse(m.expiresAt) <= Date.now()) throw new Error('Release authorization expired');
  if (m.operation === 'disable') {
    await provider.verifyShutdownTarget(target);
    await provider.shutdown();
    await provider.verifyShutdownTarget(target);
    await provider.verifyDisabled(target, m.sourceSha, true);
    return { version: 1, sourceSha: m.sourceSha, environment: context.environment, operation: m.operation, runId: m.runId,
      authorizationDigest: authorized.authorizationDigest, policyDigest: authorized.policyDigest, completedAt: new Date().toISOString(),
      deploymentVersions: await provider.deploymentVersions([target.adminWorker]), result: 'PASS', consoleEnabled: false,
      remoteExecuted: true, productionDeployed: context.environment === 'production' };
  }
  if (['initialize-disabled', 'restore-initial-disabled'].includes(m.operation)) {
    if (m.operation === 'initialize-disabled') await provider.verifyInitialTargets(target);
    else await provider.verifyInitialRecoveryTargets(target);
    try {
      await provider.deploy('facade');
      await provider.deploy('admin');
      await provider.verifyTargets(target, context.environment);
      await provider.verifyDisabled(target, m.sourceSha);
    } catch (error) {
      // A first install has no previous version. Contain only an exact mapped target.
      try {
        await provider.verifyShutdownTarget(target);
        await provider.shutdown();
        await provider.verifyDisabled(target, m.sourceSha, true);
      } catch { /* Preserve uncertainty in the failure receipt. */ }
      throw error;
    }
    return { version: 1, sourceSha: m.sourceSha, environment: context.environment, operation: m.operation, runId: m.runId,
      authorizationDigest: authorized.authorizationDigest, policyDigest: authorized.policyDigest, completedAt: new Date().toISOString(),
      deploymentVersions: await provider.deploymentVersions(), result: 'PASS', consoleEnabled: false,
      remoteExecuted: true, productionDeployed: context.environment === 'production' };
  }
  await provider.verifyTargets(target, context.environment, m.operation === 'rollback-disabled');
  await provider.verifyConsoleDisabled(target);
  if (m.operation === 'migrate') {
    await provider.verifyLedger(target, context.migrations, false);
    await provider.verifyExistingDatabaseIdentity(target, context.environment);
    await provider.applyMigrations(target);
    await provider.verifyLedger(target, context.migrations, true);
    await provider.bindDatabaseIdentity(target, context.environment);
  } else {
    await provider.verifyLedger(target, context.migrations, true);
    await provider.verifyDatabaseIdentity(target, context.environment);
    if (m.operation === 'provision-hmac') {
      await provider.provisionHmac();
      await provider.verifySecrets(target);
    } else if (m.operation === 'enable') {
      await provider.verifySecrets(target);
      await provider.verifyOwnerReady(target);
      const baseline = await provider.captureRollback();
      try {
        await provider.enable();
        await provider.verifyTargets(target, context.environment);
        await provider.verifyEnabled(target, m.sourceSha);
        await provider.verifyTargets(target, context.environment);
      } catch (error) {
        try { await provider.restoreRollback(baseline); } catch { /* Failure receipt requires inspection. */ }
        throw error;
      }
    } else if (m.operation === 'deploy-disabled') {
      await provider.verifySecrets(target);
      const baseline = await provider.captureRollback();
      try {
        await provider.deploy('facade');
        await provider.deploy('admin');
        await provider.verifyTargets(target, context.environment);
        await provider.verifyDisabled(target, m.sourceSha);
      } catch (error) {
        try { if (baseline) await provider.restoreRollback(baseline); } catch { /* Receipt remains UNKNOWN; do not hide the original failure. */ }
        throw error;
      }
    } else if (m.operation === 'rollback-disabled') {
      await provider.verifyRollback(target, m.payload);
      const baseline = await provider.captureRollback();
      try {
        await provider.rollback('facade', m.payload.facadeVersion);
        await provider.rollback('admin', m.payload.adminVersion);
        await provider.verifyTargets(target, context.environment);
        await provider.verifyDisabled(target, m.payload.previousSha);
      } catch (error) {
        try { if (baseline) await provider.restoreRollback(baseline); } catch { /* Explicit failure receipt requires operator inspection. */ }
        throw error;
      }
    } else if (m.operation === 'enroll-owner') {
      await provider.enrollOwner(m, authorized.signer);
    } else if (STAGING_TEST_OPERATIONS.includes(m.operation)) {
      await provider.stagingTestIdentity(m, authorized.signer);
    } else if (m.operation === 'bootstrap') {
      await provider.verifyBootstrapRoster(target, m.payload.userIds, target.issuer);
      await provider.bootstrap(buildBootstrapAdminSql({ userIds: m.payload.userIds, ceremonyId: m.id,
        independentApprovalRef: m.payload.approvalRef, createdAt: new Date().toISOString() }));
    } else if (m.operation === 'recover') {
      const roster = await provider.recoveryRoster();
      const recovery = verifyRecovery(m.payload.manifest, m.payload.approvals, roster, {
        sourceSha: m.sourceSha, databaseIdentity: target.adminDatabaseId,
      });
      await provider.recover(recovery.sql);
    }
  }
  if (m.operation !== 'enable') {
    await provider.verifyTargets(target, context.environment);
    await provider.verifyConsoleDisabled(target);
  }
  return { version: 1, sourceSha: m.sourceSha, environment: context.environment, operation: m.operation, runId: m.runId,
    authorizationDigest: authorized.authorizationDigest, policyDigest: authorized.policyDigest, completedAt: new Date().toISOString(),
    deploymentVersions: await provider.deploymentVersions(),
    result: 'PASS', consoleEnabled: m.operation === 'enable', remoteExecuted: true, productionDeployed: context.environment === 'production' && ['deploy-disabled', 'enable', 'disable', 'rollback-disabled'].includes(m.operation) };
}

export const normalizeArtifactDigest = value => /^[a-f0-9]{64}$/.test(value ?? '') ? `sha256:${value}` : undefined;

export function loadContext(environment, operation, env = process.env) {
  if (!['staging', 'production'].includes(environment) || !OPERATIONS.includes(operation)) throw new Error('Enumerated environment and operation required');
  if (STAGING_TEST_OPERATIONS.includes(operation) && environment !== 'staging') throw new Error('QA identity operations are staging-only');
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const sourceSha = git('rev-parse', 'HEAD');
  if (!sha.test(sourceSha) || git('status', '--porcelain', '--untracked-files=normal')) throw new Error('Clean exact-SHA checkout required');
  const migrations = operation === 'disable' ? [] : readdirSync('migrations-admin').filter(p => /^\d{4}_[a-z0-9_]+\.sql$/.test(p)).sort()
    .map(p => ({ name: p, sha256: digest(readFileSync(`migrations-admin/${p}`)) }));
  return { environment, operation, sourceSha, migrations, migrationDigest: digest(migrations), runId: env.GITHUB_RUN_ID, runAttempt: env.GITHUB_RUN_ATTEMPT, auditArtifactDigest: normalizeArtifactDigest(env.ADMIN_PRE_ACTION_ARTIFACT_DIGEST) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [phase, environment, operation] = process.argv.slice(2);
  try {
    if (!['plan', 'authorize', 'execute'].includes(phase) || process.argv.length !== 5) throw new Error('Usage: admin-release-adapter.mjs plan|authorize|execute staging|production OPERATION');
    const context = loadContext(environment, operation);
    const policy = JSON.parse(readFileSync('admin/release-policy.json', 'utf8'));
    const output = '.artifacts/admin-release';
    mkdirSync(output, { recursive: true });
    if (phase === 'plan') {
      let targetValid = true, blocker;
      try { validateTarget(policy, environment); } catch (error) { targetValid = false; blocker = error.message; }
      const plan = { ...context, policyDigest: digest(policy), targetValid, blocker, remoteExecuted: false, readyForDeployment: false };
      writeFileSync(`${output}/plan.json`, JSON.stringify(plan, null, 2) + '\n');
      console.log(JSON.stringify(plan));
    } else {
      if (process.env.GITHUB_ACTIONS !== 'true' || process.env.ADMIN_RELEASE_EXECUTION_ENABLED !== 'true' ||
          process.env.GITHUB_REF !== 'refs/heads/main' || process.env.GITHUB_SHA !== context.sourceSha ||
          process.env.GITHUB_WORKFLOW_SHA !== context.sourceSha) throw new Error('Authorized protected exact-main Actions execution required');
      const bundle = JSON.parse(process.env.ADMIN_RELEASE_AUTHORIZATION ?? 'null');
      const authorized = validateAuthorization(bundle, policy, context);
      const provider = createProvider(authorized, context);
      if (environment === 'production' && operation !== 'disable') {
        const certificate = validateStagingCertificate(JSON.parse(process.env.ADMIN_STAGING_CERTIFICATION ?? 'null'), policy, context);
        await provider.verifyStagingArtifact(certificate);
      }
      validateGitHub(await provider.githubFacts(), { ...context, requireAudit: phase === 'execute' });
      const audit = { sourceSha: context.sourceSha, runId: context.runId, operation, environment,
        authorizationDigest: authorized.authorizationDigest, policyDigest: authorized.policyDigest, migrationDigest: context.migrationDigest };
      if (phase === 'authorize') writeFileSync(`${output}/pre-action.json`, JSON.stringify(audit, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
      else {
        if (canonical(JSON.parse(readFileSync(`${output}/pre-action.json`, 'utf8'))) !== canonical(audit)) throw new Error('Pre-action audit mismatch');
        writeFileSync(`${output}/execution.lock`, context.runId, { flag: 'wx', mode: 0o600 });
        let receipt;
        try { receipt = await executeRelease(authorized, context, provider); }
        catch (error) {
          writeFileSync(`${output}/receipt.json`, JSON.stringify({ ...audit, result: 'FAIL', state: 'UNKNOWN_REQUIRES_OPERATOR_INSPECTION', consoleEnabled: 'UNVERIFIED', remoteExecuted: 'POSSIBLE' }, null, 2) + '\n');
          throw error;
        }
        writeFileSync(`${output}/receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
      }
      console.log(JSON.stringify({ phase, ...audit }));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
