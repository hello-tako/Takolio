import { isDeepStrictEqual } from 'node:util';
import { configHash } from './release-config.mjs';
import { verifyUploadedVersion } from './staging-release.mjs';
import { verifyAssetRecord } from '../family-meal-release.mjs';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export function compatibleRecoveryPlan(context) {
  const { manifest, plan } = context;
  const environment = manifest?.environment;
  if (!['staging', 'production'].includes(environment) || !/^[a-f0-9]{40}$/.test(manifest.sha ?? '') ||
      plan?.config?.name !== (environment === 'production' ? 'frigo' : 'frigo-staging') ||
      context.audit?.worker?.name !== plan.config.name || plan.config.vars?.ENVIRONMENT !== environment ||
      plan.config.vars.GIT_COMMIT !== manifest.sha || plan.buildEnvironment?.GIT_COMMIT !== manifest.sha ||
      typeof plan.bytes !== 'string' || configHash(plan.bytes) !== plan.sha256 ||
      !isDeepStrictEqual(JSON.parse(plan.bytes), plan.config)) {
    throw new Error('Compatible recovery requires the committed exact-source environment plan');
  }
  const recovery = structuredClone(plan);
  recovery.config.vars.MEAL_PLANNER_ENABLED = 'false';
  recovery.config.vars.MEAL_COMPOSITION_V2_ENABLED = 'false';
  recovery.buildEnvironment.VITE_MEAL_PLANNER_ENABLED = 'false';
  recovery.buildEnvironment.VITE_MEAL_COMPOSITION_V2_ENABLED = 'false';
  recovery.bytes = `${JSON.stringify(recovery.config, null, 2)}\n`;
  recovery.sha256 = configHash(recovery.bytes);
  return recovery;
}

export function compatibleRecoveryVersionId(context) {
  const recovery = context.compatibleRecovery;
  const plan = compatibleRecoveryPlan(context);
  if (recovery?.sha !== context.manifest.sha || !UUID.test(recovery.versionId ?? '') ||
      recovery.versionId === context.audit.worker.versionId || recovery.versionId === context.uploadedVersionId ||
      !isDeepStrictEqual(recovery.plan, plan) || !recovery.build?.assets ||
      configHash(JSON.stringify(recovery.build)) !== recovery.buildSha256) {
    throw new Error('Verified compatible recovery is missing or changed');
  }
  verifyAssetRecord(recovery.build);
  return recovery.versionId;
}

export function verifyCompatibleRecoveryVersion(context, version) {
  if (version?.id !== compatibleRecoveryVersionId(context)) throw new Error('Compatible recovery version identity changed');
  return verifyUploadedVersion(version, context.compatibleRecovery.plan, context.audit.worker);
}

export function compatibleRecoveryAction(context, active) {
  const recoveryId = compatibleRecoveryVersionId(context);
  if (active.versionId === recoveryId) {
    if (!['rollback-intent', 'rolled-back', 'reactivation-intent'].includes(context.state) || !UUID.test(active.deploymentId ?? '') ||
        context.rollbackDeploymentId && active.deploymentId !== context.rollbackDeploymentId ||
        context.hosts && (context.hosts.state !== 'detached' || context.hosts.created.length !== 0)) {
      throw new Error('Compatible recovery deployment ownership or hostname outcome changed');
    }
    return 'verify-recovery';
  }
  if (!UUID.test(context.uploadedVersionId ?? '') || active.versionId !== context.uploadedVersionId ||
      !UUID.test(active.deploymentId ?? '') || context.activeDeploymentId && active.deploymentId !== context.activeDeploymentId) {
    throw new Error('Rollback traffic ownership changed; never restore the old binary');
  }
  if (context.state === 'rollback-intent') throw new Error('Rollback outcome is uncertain; reconcile before retrying');
  return 'restore';
}
