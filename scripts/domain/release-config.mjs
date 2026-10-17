import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { ACCOUNT, ZONE, REPOSITORY, REPOSITORY_ID } from './audit-cloud.mjs';
import { prepareConfig } from './prepare.mjs';

export const AUDIT_MAX_AGE_MS = 15 * 60 * 1000;
const equal = (actual, expected, message) => {
  if (!isDeepStrictEqual(actual, expected)) throw new Error(message);
};
export const configHash = (bytes) => createHash('sha256').update(bytes).digest('hex');

// This prepares an upload only. Hostnames are attached separately after runtime proof.
export function prepareReleaseConfig({ manifest, receipt, baseline, now = Date.now() }) {
  const environment = manifest.environment;
  if (!['staging', 'production'].includes(environment) || !/^[a-f0-9]{40}$/.test(manifest.sha ?? '') ||
      manifest.repository !== REPOSITORY || receipt.repository !== REPOSITORY || receipt.repositoryId !== REPOSITORY_ID ||
      receipt.sha !== manifest.sha || receipt.environment !== environment || receipt.accountId !== ACCOUNT || receipt.zoneId !== ZONE ||
      receipt.readOnly !== true || receipt.deploymentAuthorized !== false || receipt.ci?.headSha !== manifest.sha) {
    throw new Error('Domain config requires canonical same-SHA/environment audit provenance');
  }
  const age = now - Date.parse(receipt.observedAt);
  if (!Number.isFinite(age) || age < 0 || age > AUDIT_MAX_AGE_MS) throw new Error('Domain audit is stale or from the future');
  const worker = receipt.worker;
  if (worker?.name !== (environment === 'production' ? 'frigo' : 'frigo-staging') ||
      worker.vars?.ENVIRONMENT !== environment || worker.runtime?.assets?.base_path !== '/') {
    throw new Error('Unsupported Worker runtime identity');
  }
  const snapshot = structuredClone(baseline);
  snapshot.workers[environment] = worker;
  const plan = prepareConfig(environment, snapshot, manifest.sha);
  const config = plan.config;
  const live = worker.vars;
  const flags = ['MEAL_PLANNER_ENABLED', 'MEAL_COMPOSITION_V2_ENABLED'];
  if (flags.some((key) => !['true', 'false'].includes(live[key])) ||
      live.MEAL_PLANNER_ENABLED !== live.MEAL_COMPOSITION_V2_ENABLED ||
      live.MEAL_COMPOSITION_V2_ENABLED !== String(manifest.mealCompositionV2Enabled)) {
    throw new Error('Domain release must preserve matching current planner and composition flags');
  }
  equal([live.RECIPE_CATALOG_MODE, live.RECIPE_CATALOG_D1_CANARY_PERCENT, live.RECIPE_CATALOG_CUTOVER_ENABLED],
    [manifest.recipeCatalogMode, String(manifest.recipeCatalogCanaryPercent), String(manifest.recipeCatalogCutoverEnabled)],
    'Domain release cannot change current recipe authority');
  const operational = receipt.operational;
  if (typeof operational?.workers_dev !== 'boolean' || typeof operational.preview_urls !== 'boolean' ||
      !Array.isArray(operational.crons) || operational.crons.some((cron) => typeof cron !== 'string') ||
      !operational.observability || typeof operational.observability !== 'object' ||
      !Array.isArray(operational.consumers)) throw new Error('Incomplete operational audit');
  if (environment === 'production' && (operational.workers_dev || operational.preview_urls)) {
    throw new Error('Production exposure requires a separate reviewed change');
  }
  const [consumer] = operational.consumers;
  if (operational.consumers.length !== 1 || consumer.type !== 'worker' ||
      (consumer.script ?? consumer.service) !== worker.name || consumer.environment !== 'production' ||
      typeof consumer.consumer_id !== 'string' || !consumer.consumer_id ||
      consumer.dead_letter_queue !== config.queues.consumers[0].dead_letter_queue) {
    throw new Error('Queue consumer identity or dead-letter queue requires review');
  }
  const settings = consumer.settings;
  const allowed = ['batch_size', 'max_wait_time_ms', 'max_retries', 'retry_delay', 'max_concurrency'];
  if (!settings || Object.keys(settings).some((key) => !allowed.includes(key)) ||
      !Number.isInteger(settings.batch_size) || settings.batch_size <= 0 ||
      !Number.isInteger(settings.max_wait_time_ms) || settings.max_wait_time_ms < 0 || settings.max_wait_time_ms % 1000 !== 0 ||
      !Number.isInteger(settings.max_retries) || settings.max_retries < 0 ||
      !Number.isInteger(settings.retry_delay) || settings.retry_delay < 0 ||
      !(settings.max_concurrency === null || (Number.isInteger(settings.max_concurrency) && settings.max_concurrency > 0))) {
    throw new Error('Unsupported queue consumer settings');
  }
  config.queues.consumers = [{ queue: worker.bindings.SCAN_QUEUE,
    dead_letter_queue: consumer.dead_letter_queue,
    max_batch_size: settings.batch_size, max_batch_timeout: settings.max_wait_time_ms / 1000,
    max_retries: settings.max_retries, retry_delay: settings.retry_delay,
    ...(settings.max_concurrency === null ? {} : { max_concurrency: settings.max_concurrency }) }];
  config.workers_dev = operational.workers_dev;
  config.preview_urls = operational.preview_urls;
  config.triggers = { crons: [...operational.crons] };
  config.observability = structuredClone(operational.observability);
  // Wrangler skips both route publishers for empty arrays; it must not reconcile custom domains.
  config.routes = [];
  const bytes = `${JSON.stringify(config, null, 2)}\n`;
  return { config, bytes, sha256: configHash(bytes), buildEnvironment: plan.buildEnvironment,
    previous: { deploymentId: worker.deploymentId, versionId: worker.versionId,
      vars: structuredClone(worker.vars), operational: structuredClone(operational) },
    deployAuthorized: false };
}
