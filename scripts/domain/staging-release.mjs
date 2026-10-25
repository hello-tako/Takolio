import { isDeepStrictEqual } from 'node:util';
import { captureBindings } from './bindings.mjs';
import { uploadTypedBindings } from './staging-email-policy.mjs';

export const STAGING_GOOGLE_CLIENT_ID = '509963441971-c8ij1hv901p0fsljhd2ur1qc4t63432g.apps.googleusercontent.com';

export function verifyUploadedVersion(version, plan, previous) {
  const captured = captureBindings(version.resources?.bindings ?? []);
  const runtime = version.resources?.script_runtime;
  if (!/^[a-f0-9-]{36}$/.test(version.id ?? '') || version.id === previous.versionId ||
      !isDeepStrictEqual(captured.bindings, previous.bindings) ||
      !isDeepStrictEqual(captured.typedBindings, uploadTypedBindings(plan, previous)) ||
      !isDeepStrictEqual(captured.secretNames, previous.secretNames) ||
      !isDeepStrictEqual(captured.vars, plan.config.vars) ||
      runtime?.compatibility_date !== plan.config.compatibility_date ||
      !isDeepStrictEqual(runtime?.compatibility_flags, plan.config.compatibility_flags) ||
      runtime?.usage_model !== previous.runtime.usage_model ||
      runtime?.assets?.base_path !== '/' || runtime.assets.raw_run_worker_first !== true ||
      runtime.assets.html_handling !== plan.config.assets.html_handling ||
      runtime.assets.not_found_handling !== plan.config.assets.not_found_handling) {
    throw new Error('Uploaded staging version does not match the audited candidate');
  }
  return version.id;
}

export function unchangedAudit(before, after) {
  for (const key of ['worker', 'operational', 'customDomains', 'dns', 'routes']) {
    if (!isDeepStrictEqual(before[key], after[key])) throw new Error(`Staging infrastructure drift: ${key}`);
  }
  if (!isDeepStrictEqual(before.ledger.names, after.ledger.names) || before.ledger.version !== after.ledger.version) {
    throw new Error('Staging migration ledger drift');
  }
}

// A failed upload has no traffic effect. Recovery reconciles only the recorded version/host IDs.
export async function releaseStaging(provider) {
  const context = await provider.prepare();
  try {
    await provider.prepareRecovery(context);
    await provider.build(context);
    await provider.upload(context);
    await provider.activate(context);
    await provider.proveLegacy(context);
    await provider.attach(context);
    await provider.proveHosts(context);
    await provider.rehearseRecovery(context);
    await provider.finish(context);
    return context;
  } catch (error) {
    context.failure = error instanceof Error ? error.message : 'Staging release failed';
    try { await provider.recover(context); }
    catch (recoveryError) {
      context.recoveryFailure = recoveryError instanceof Error ? recoveryError.message : 'Recovery failed';
      await provider.persist?.(context);
      throw new Error('Staging release and recovery failed; reconcile the retained receipt');
    }
    throw error;
  }
}

export function validateRecoveryContext(context, env) {
  if (env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_REPOSITORY !== 'hello-tako/Takolio' ||
      env.GITHUB_REPOSITORY_ID !== '1422954151' || env.CLOUDFLARE_ACCOUNT_ID !== 'ef250a88911fd24073cb73d1c07e0218' ||
      env.GITHUB_SHA !== context.manifest?.sha || env.GITHUB_WORKFLOW_SHA !== context.manifest?.sha ||
      context.manifest?.environment !== 'staging' || context.manifest.repository !== 'hello-tako/Takolio' ||
      context.audit?.worker?.name !== 'frigo-staging' || context.plan?.config?.name !== 'frigo-staging' ||
      context.hosts && context.hosts.environment !== 'staging') {
    throw new Error('Recovery requires the recorded canonical staging workflow and target');
  }
}
