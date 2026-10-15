import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { stripVTControlCharacters } from 'node:util';
import { validateRecipeCatalogManifestPolicy } from './release-check.mjs';

export const MAX_ATTEMPTS = 3;
export const DEADLINE_MS = 600_000;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;
const API_ORIGIN = 'https://api.cloudflare.com';
const TRANSIENT_READ_STATUSES = new Set([429, 500, 502, 503, 504]);

// Wrangler 4.149.0 does not retry the two metadata reads in preUploadApiChecks.
// Its sanitized request trace lets us prove no mutation began before restarting the CLI.
export function classifyDeploymentFailure(output, { accountId, scriptName }) {
  const text = stripVTControlCharacters(output);
  const traces = [...text.matchAll(/-- START CF API REQUEST: ([A-Z]+) ([^\r\n]+)\r?$/gm)];
  const requests = traces.map((match) => ({ method: match[1], url: match[2].trim() }));
  const hasMutation = requests.some(({ method }) => method !== 'GET');
  const unparsedTrace = (text.match(/-- START CF API REQUEST:/g) ?? []).length !== requests.length;
  const officialReadsOnly = requests.length > 0 && requests.every(({ method, url }) => {
    try { const parsed = new URL(url); return method === 'GET' && parsed.origin === API_ORIGIN && parsed.pathname.startsWith('/client/v4/'); }
    catch { return false; }
  });
  const endpoints = [`/accounts/${accountId}/workers/services/${scriptName}`, `/accounts/${accountId}/workers/scripts/${scriptName}/secrets`];
  const failures = [...text.matchAll(/^\s*GET (\/accounts\/[^\s]+) -> (\d{3})(?: [^\r\n]*)?\r?$/gm)];
  const failure = failures.at(-1);
  const status = failure ? Number(failure[2]) : undefined;
  const last = requests.at(-1);
  const endpoint = failure?.[1];
  const rayId = /Cloudflare Ray ID: ([a-f0-9]{16}-[A-Z]{3})\b/.exec(text)?.[1];
  const retryable = officialReadsOnly && !hasMutation && !unparsedTrace
    && endpoints.includes(endpoint) && last?.url === `${API_ORIGIN}/client/v4${endpoint}`
    && TRANSIENT_READ_STATUSES.has(status) && !/\b(?:Uploading|Uploaded|Deployed)\b/i.test(text);
  return { retryable, requestCount: requests.length, hasMutation,
    ...(status !== undefined ? { httpStatus: status } : {}),
    ...(endpoints.includes(endpoint) ? { endpoint: endpoint.endsWith('/secrets') ? 'secrets' : 'service' } : {}),
    ...(rayId ? { rayId } : {}) };
}

export function deploymentArguments(manifest) {
  if (!/^[a-f0-9]{40}$/.test(manifest?.sha ?? '') || !['production', 'staging'].includes(manifest?.environment)
      || typeof manifest.mealCompositionV2Enabled !== 'boolean') throw new Error('Invalid deployment manifest');
  validateRecipeCatalogManifestPolicy(manifest);
  const args = ['exec', 'wrangler', 'deploy'];
  if (manifest.environment === 'staging') args.push('--config', 'wrangler.staging.jsonc');
  const variables = {
    GIT_COMMIT: manifest.sha,
    ...(manifest.environment === 'production' ? { STRICT_OTP_FAIL_CLOSED: false } : {}),
    RECIPE_CATALOG_MODE: manifest.recipeCatalogMode,
    RECIPE_CATALOG_D1_CANARY_PERCENT: manifest.recipeCatalogCanaryPercent,
    RECIPE_CATALOG_CUTOVER_ENABLED: manifest.recipeCatalogCutoverEnabled,
    ...(manifest.environment === 'production' ? { MEAL_PLANNER_ENABLED: manifest.mealCompositionV2Enabled } : {}),
    MEAL_COMPOSITION_V2_ENABLED: manifest.mealCompositionV2Enabled,
  };
  for (const [name, value] of Object.entries(variables)) args.push('--var', `${name}:${value}`);
  return args;
}

export async function deployWithSafeRetry({ manifest, accountId, run, recheck, now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), log = console.log,
  maxAttempts = MAX_ATTEMPTS, deadlineMs = DEADLINE_MS, retryDelayMs = 5_000 }) {
  if (!/^[a-f0-9]{32}$/.test(accountId ?? '')) throw new Error('Invalid Cloudflare account identity');
  if (![maxAttempts, deadlineMs, retryDelayMs].every((v) => Number.isSafeInteger(v) && v > 0) || maxAttempts > MAX_ATTEMPTS)
    throw new Error('Invalid deployment retry bounds');
  const args = deploymentArguments(manifest);
  const scriptName = manifest.environment === 'production' ? 'frigo' : 'frigo-staging';
  const attempts = [];
  manifest.cloudflareDeployAttempts = attempts;
  const started = now();
  const remaining = () => deadlineMs - (now() - started);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (remaining() <= 0) throw new Error('Cloudflare deployment deadline exceeded');
    // Each restart repeats live-main, exact-SHA CI, ancestry and migration guards.
    await recheck(remaining());
    manifest.cloudflareDeployAttempts = attempts;
    if (JSON.stringify(deploymentArguments(manifest)) !== JSON.stringify(args)) throw new Error('Approved deployment configuration changed during release recheck');
    if (remaining() <= 0) throw new Error('Cloudflare deployment deadline exceeded');
    const result = await run(args, remaining());
    const observation = classifyDeploymentFailure(result.output ?? '', { accountId, scriptName });
    attempts.push({ attempt, exitCode: result.exitCode, ...observation,
      ...(result.incomplete ? { incomplete: true } : {}),
      ...(typeof result.signal === 'string' && /^SIG[A-Z]+$/.test(result.signal) ? { terminationSignal: result.signal } : {}) });
    if (result.exitCode === 0 && !result.incomplete && !result.signal) {
      log(`Cloudflare ${manifest.environment} deploy command succeeded on attempt ${attempt}; exact runtime proof still required`);
      return attempts;
    }
    log(`Cloudflare deploy attempt ${attempt} failed; requests=${observation.requestCount}, mutation=${observation.hasMutation}, HTTP=${observation.httpStatus ?? 'unknown'}${observation.rayId ? `, ray=${observation.rayId}` : ''}`);
    if (result.incomplete || result.signal || !observation.retryable || attempt === maxAttempts) {
      throw new Error('Cloudflare deployment failed; retry is unsafe or exhausted; inspect deployment and verified rollback receipt');
    }
    const delay = retryDelayMs * 2 ** (attempt - 1);
    if (remaining() <= delay) throw new Error('Cloudflare deployment deadline exceeded');
    log(`Retrying only a proven pre-upload metadata read failure in ${delay} ms`);
    await sleep(delay);
  }
}

export function capturedCommand(command, args, { env, timeoutMs, maxOutputBytes = MAX_OUTPUT_BYTES, signal }) {
  if (process.platform === 'win32') throw new Error('Safe deployment process shutdown requires a POSIX process group');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647
      || !Number.isSafeInteger(maxOutputBytes) || maxOutputBytes <= 0 || maxOutputBytes > MAX_OUTPUT_BYTES)
    throw new Error('Invalid deployment process bounds');
  if (signal?.aborted) return Promise.resolve({ exitCode: 1, output: '', incomplete: true });
  return new Promise((resolve) => {
    const child = spawn(command, args, { env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let bytes = 0;
    let incomplete = false;
    let interruptedSignal;
    const killGroup = () => {
      if (!child.pid) return;
      try { process.kill(-child.pid, 'SIGKILL'); }
      catch (error) { if (error.code !== 'ESRCH') incomplete = true; }
    };
    // pnpm launches Wrangler as a child; killing only pnpm leaves uploads running.
    const stop = () => {
      incomplete = true;
      killGroup();
      child.stdout.destroy();
      child.stderr.destroy();
    };
    const onSigint = () => { interruptedSignal ??= 'SIGINT'; stop(); };
    const onSigterm = () => { interruptedSignal ??= 'SIGTERM'; stop(); };
    const capture = (stream, chunk) => {
      if (incomplete) return;
      bytes += chunk.length;
      if (bytes > maxOutputBytes) { stop(); return; }
      if (stream === 'stdout') stdout += chunk.toString('utf8');
      else stderr += chunk.toString('utf8');
    };
    child.stdout.on('data', (chunk) => capture('stdout', chunk));
    child.stderr.on('data', (chunk) => capture('stderr', chunk));
    const timer = setTimeout(stop, timeoutMs);
    process.once('SIGINT', onSigint);
    process.once('SIGTERM', onSigterm);
    signal?.addEventListener('abort', stop, { once: true });
    child.on('error', stop);
    child.on('exit', killGroup);
    child.on('close', (code, terminationSignal) => {
      clearTimeout(timer);
      process.removeListener('SIGINT', onSigint);
      process.removeListener('SIGTERM', onSigterm);
      signal?.removeEventListener('abort', stop);
      killGroup();
      resolve({ exitCode: code ?? 1, output: `${stdout}\n${stderr}`, incomplete,
        ...(terminationSignal ? { signal: terminationSignal } : {}) });
      // Let receipt/failure handlers finish, then preserve the caller's cancellation.
      if (interruptedSignal) setImmediate(() => process.kill(process.pid, interruptedSignal));
    });
  });
}

async function main() {
  const [file = 'release-manifest.json'] = process.argv.slice(2);
  const manifest = JSON.parse(readFileSync(file, 'utf8'));
  const env = { ...process.env, WRANGLER_LOG: 'debug', WRANGLER_LOG_SANITIZE: 'true', WRANGLER_SEND_METRICS: 'false' };
  if (JSON.parse(readFileSync('package.json', 'utf8')).devDependencies?.wrangler !== '4.149.0')
    throw new Error('Safe retry trace parser requires the reviewed Wrangler 4.149.0');
  try {
    await deployWithSafeRetry({ manifest, accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      run: (args, timeoutMs) => capturedCommand('pnpm', args, { env, timeoutMs }),
      recheck: async (timeoutMs) => {
        const result = await capturedCommand(process.execPath, ['scripts/release-check.mjs', 'recheck', file], { env, timeoutMs });
        if (result.exitCode !== 0 || result.incomplete) throw new Error('Exact-SHA release recheck failed; no deployment attempted');
        const refreshed = JSON.parse(readFileSync(file, 'utf8'));
        delete refreshed.cloudflareDeployAttempts;
        Object.assign(manifest, refreshed);
      },
    });
  } finally { writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : 'Cloudflare deployment failed'); process.exitCode = 1; });
}
