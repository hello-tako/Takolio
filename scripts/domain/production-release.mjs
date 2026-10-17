import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { ACCOUNT, REPOSITORY, REPOSITORY_ID } from './audit-cloud.mjs';
import { isDomainId } from './hosts.mjs';

export const ACCEPTANCE_CHECKS = Object.freeze([
  'dns-tls', 'access', 'google-login', 'otp-delivery', 'session-lifecycle',
  'payos-sandbox', 'user-journeys', 'mobile-pwa', 'rollback-rehearsal',
]);
export const OBSERVATION_MS = 15 * 60 * 1000;

export function verifyEvidenceRun(run, { id, sha, path }) {
  if (!Number.isSafeInteger(id) || id < 1 || run?.id !== id ||
      run.repository?.id !== Number(REPOSITORY_ID) || run.repository.full_name !== REPOSITORY ||
      run.head_repository?.id !== Number(REPOSITORY_ID) || run.head_repository.full_name !== REPOSITORY ||
      run.head_sha !== sha || run.head_branch !== 'main' || run.path !== path ||
      run.event !== 'workflow_dispatch' || run.status !== 'completed' || run.conclusion !== 'success' ||
      !Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1) {
    throw new Error('Successful canonical exact-main evidence run required');
  }
  return { id, attempt: run.run_attempt, sha, path, url: run.html_url };
}

export function verifyStagingAcceptance(acceptance, receipt, { sha, runId, now = Date.now() }) {
  if (receipt?.state !== 'infrastructure-verified' || receipt.manifest?.sha !== sha ||
      receipt.manifest.repository !== REPOSITORY || receipt.manifest.environment !== 'staging' ||
      receipt.plan?.config?.name !== 'frigo-staging' || !receipt.uploadedVersionId ||
      receipt.hosts?.state !== 'attached' || receipt.hosts.environment !== 'staging' ||
      receipt.hosts.sha !== sha || receipt.hostProof?.httpsVerified !== true ||
      receipt.hostProof.apiStatus !== 200 || receipt.hostProof.apiSpaStatus !== 404 || receipt.hostProof.corsStatus !== 204 ||
      receipt.appProof?.deployed?.sha !== sha || receipt.appProof?.assets?.sha !== sha ||
      receipt.recoveryFailure || receipt.failure) throw new Error('Exact-SHA staging infrastructure proof required');
  const age = now - Date.parse(acceptance?.acceptedAt);
  if (acceptance?.schema !== 'takolio-staging-acceptance/v1' || acceptance.repository !== REPOSITORY ||
      acceptance.sha !== sha || acceptance.releaseRunId !== runId || acceptance.versionId !== receipt.uploadedVersionId ||
      !Number.isFinite(age) || age < 0 || age > 24 * 60 * 60 * 1000 ||
      !isDeepStrictEqual(Object.keys(acceptance.checks ?? {}).sort(), [...ACCEPTANCE_CHECKS].sort())) {
    throw new Error('Fresh same-release staging acceptance attestation required');
  }
  const checks = {};
  for (const check of ACCEPTANCE_CHECKS) {
    const proof = acceptance.checks[check];
    if (proof?.result !== 'PASS' || typeof proof.evidence !== 'string' ||
        !/^https:\/\/github\.com\/hello-tako\/Takolio\/(?:actions\/runs\/[1-9][0-9]*(?:\/artifacts\/[1-9][0-9]*)?|pull\/[1-9][0-9]*#issuecomment-[1-9][0-9]*)$/.test(proof.evidence)) {
      throw new Error(`Staging acceptance evidence missing: ${check}`);
    }
    checks[check] = { result: 'PASS', evidence: proof.evidence };
  }
  // Retain only reviewed public fields, never arbitrary operator input.
  return { schema: acceptance.schema, repository: REPOSITORY, sha, releaseRunId: runId,
    versionId: receipt.uploadedVersionId, acceptedAt: new Date(now - age).toISOString(), checks,
    evidenceKind: 'operator-attestation-requiring-independent-production-review' };
}

export function verifyProductionCertification(receipt, sha, now = Date.now()) {
  const age = now - Date.parse(receipt?.certification?.checkedAt);
  if (receipt?.repository !== REPOSITORY || receipt.sha !== sha || receipt.environment !== 'production' ||
      receipt.certification?.result !== 'PASS' || receipt.certification.readOnly !== true ||
      !isDeepStrictEqual(receipt.certification.productionMutations, []) ||
      receipt.productionBaseline?.worker !== 'frigo' || receipt.productionBaseline.environment !== 'production' ||
      receipt.productionBaseline.bindingVerified !== true || !receipt.productionBaseline.versionId ||
      receipt.catalog?.releaseComplete !== true || !receipt.runtimeCatalog ||
      receipt.health?.foreignKeyCheck !== '[]' || receipt.health.quickCheck !== 'ok' ||
      !Number.isFinite(age) || age < 0 || age > 45 * 60 * 1000) {
    throw new Error('Fresh exact-SHA production read-only certification required');
  }
  return receipt.productionBaseline;
}

export function isProductionMutation(path, method) {
  const base = `/accounts/${ACCOUNT}`;
  const prefix = `${base}/workers/domains/`;
  return path === `${base}/workers/scripts/frigo/deployments` && method === 'POST' ||
    path === `${base}/workers/domains` && method === 'PUT' ||
    typeof path === 'string' && path.startsWith(prefix) && isDomainId(path.slice(prefix.length)) && method === 'DELETE';
}

export function validateProductionRecovery(context, env) {
  if (env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
      env.GITHUB_REPOSITORY !== REPOSITORY || env.GITHUB_REPOSITORY_ID !== REPOSITORY_ID ||
      env.CLOUDFLARE_ACCOUNT_ID !== ACCOUNT || env.GITHUB_SHA !== context.manifest?.sha ||
      env.GITHUB_WORKFLOW_SHA !== context.manifest?.sha || context.manifest?.environment !== 'production' ||
      context.manifest.repository !== REPOSITORY || context.audit?.worker?.name !== 'frigo' ||
      context.plan?.config?.name !== 'frigo' || context.hosts && context.hosts.environment !== 'production') {
    throw new Error('Recovery requires the recorded canonical production workflow and target');
  }
}

export async function observeProduction(probe, persist, { now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)) } = {}) {
  const startedAt = now();
  const observations = [];
  do {
    observations.push({ observedAt: new Date(now()).toISOString(), proof: await probe() });
    await persist({ startedAt: new Date(startedAt).toISOString(), elapsedMs: now() - startedAt, observations });
    if (now() - startedAt >= OBSERVATION_MS) break;
    await sleep(Math.min(30000, OBSERVATION_MS - (now() - startedAt)));
  } while (true);
  if (observations.length < 2) throw new Error('Production observation requires repeated probes');
  return { startedAt: new Date(startedAt).toISOString(), elapsedMs: now() - startedAt, observations };
}

export function productionUploadVersion(records) {
  const record = Array.isArray(records) && records.length === 1 ? records[0] : undefined;
  if (record?.type !== 'version-upload' || record.worker_name !== 'frigo' ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(record.version_id ?? '')) {
    throw new Error('Production upload outcome requires reconciliation');
  }
  return record.version_id;
}

export function productionRecoveryIdentity(certification, snapshot) {
  const identity = certification?.cloudflare;
  const certified = certification?.productionBaseline;
  const worker = snapshot?.worker;
  if (identity?.accountAuthenticated !== true || identity.databaseName !== 'frigo-db' ||
      identity.databaseId !== 'f975ec39-b2c8-4a2a-80e1-0366054599d3' ||
      worker?.name !== 'frigo' || worker.bindings?.DB !== identity.databaseId || !worker.deploymentId ||
      worker.versionId !== certified?.versionId ||
      certified.accountIdentifierSha256 !== createHash('sha256').update(ACCOUNT).digest('hex')) {
    throw new Error('Certified production account/D1/recovery identity mismatch');
  }
  return { cloudflare: { accountAuthenticated: true, databaseName: identity.databaseName, databaseId: identity.databaseId },
    previousDeployment: { deploymentId: worker.deploymentId, versionId: worker.versionId } };
}
