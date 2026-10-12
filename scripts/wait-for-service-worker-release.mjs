import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { RELEASE_PROPAGATION_PENDING } from './release-check.mjs';
import { DEFAULT_DEADLINE_MS, DEFAULT_INTERVAL_MS, DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_REQUIRED_CONSECUTIVE, MAX_SERVICE_WORKER_BYTES, verifyServiceWorker } from './wait-for-deployed-release.mjs';

const exec = promisify(execFile);
const profiles = [
  { name: 'ordinary', headers: { Accept: '*/*' } },
  { name: 'revalidated', headers: { Accept: 'text/javascript, application/javascript', 'Cache-Control': 'no-cache' } },
];
const short = (sha) => sha.slice(0, 8);

// Use the smoke command's native transport, without curlrc, redirects, or credentials.
export async function fetchServiceWorkerWithCurl(url, { signal, timeoutMs, headers }, execute = exec) {
  const args = ['--disable', '--silent', '--show-error', '--suppress-connect-headers', '--proto', '=https',
    '--max-time', String(timeoutMs / 1000), '--request', 'GET', '--dump-header', '-'];
  for (const [name, value] of Object.entries(headers)) args.push('--header', `${name}: ${value}`);
  args.push(String(url));
  const { stdout } = await execute('curl', args, {
    signal, encoding: 'buffer', maxBuffer: MAX_SERVICE_WORKER_BYTES + 64 * 1024,
  });
  let bytes = Buffer.from(stdout);
  let status;
  let parsedHeaders;
  for (;;) {
    const end = bytes.indexOf('\r\n\r\n');
    if (end < 0 || end > 64 * 1024) throw new Error('Service worker transport headers are malformed');
    const lines = bytes.subarray(0, end).toString('latin1').split('\r\n');
    const match = /^HTTP\/(?:1\.[01]|2|3) ([0-9]{3})(?:\s|$)/.exec(lines.shift());
    if (!match) throw new Error('Service worker transport status is malformed');
    status = Number(match[1]);
    parsedHeaders = new Headers();
    for (const line of lines) {
      const colon = line.indexOf(':');
      if (colon <= 0) throw new Error('Service worker transport headers are malformed');
      parsedHeaders.append(line.slice(0, colon), line.slice(colon + 1).trim());
    }
    bytes = bytes.subarray(end + 4);
    if (status < 200 && /^HTTP\//.test(bytes.subarray(0, 8).toString('latin1'))) continue;
    break;
  }
  return new Response(status === 204 || status === 304 ? null : bytes, { status, headers: parsedHeaders });
}

export async function waitForServiceWorkerRelease(url, expectedSha, {
  fetch: fetchImpl = fetchServiceWorkerWithCurl, now = Date.now,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), log = console.log,
  deadlineMs = DEFAULT_DEADLINE_MS, intervalMs = DEFAULT_INTERVAL_MS,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, requiredConsecutive = DEFAULT_REQUIRED_CONSECUTIVE,
} = {}) {
  const origin = new URL(url);
  if (origin.protocol !== 'https:' || origin.origin !== url) throw new Error('Deployment URL must be an exact HTTPS origin');
  if (!/^[a-f0-9]{40}$/.test(expectedSha)) throw new Error('Service worker expected SHA is not canonical');
  if ([deadlineMs, intervalMs, requestTimeoutMs, requiredConsecutive].some((value) => !Number.isSafeInteger(value) || value <= 0)) {
    throw new Error('Service worker wait bounds must be positive safe integers');
  }
  const assetUrl = new URL('/sw.js', origin);
  const startedAt = now();
  const remaining = () => deadlineMs - (now() - startedAt);
  const deadlineError = () => new Error(`Service worker ordinary and revalidated profiles did not identify release ${short(expectedSha)} within ${deadlineMs} ms; the deployed assets must be inspected by an operator`);
  let attempt = 0;
  let consecutive = 0;
  for (;;) {
    attempt += 1;
    const observations = {};
    try {
      for (const profile of profiles) {
        const budget = remaining();
        if (budget <= 0) throw deadlineError();
        const timeoutMs = Math.min(requestTimeoutMs, budget);
        let response;
        try {
          response = await fetchImpl(assetUrl, { headers: profile.headers, timeoutMs, signal: AbortSignal.timeout(timeoutMs) });
        } catch { throw new Error(`Service worker ${profile.name} request failed`); }
        try { observations[profile.name] = await verifyServiceWorker(response, expectedSha); }
        catch (error) {
          if (error?.code === RELEASE_PROPAGATION_PENDING) error.observedProfile = profile.name;
          throw error;
        }
        if (remaining() < 0) throw deadlineError();
      }
      if (observations.ordinary.sha256 !== observations.revalidated.sha256) throw new Error('Service worker transport profiles serve different content');
      consecutive += 1;
      log(`attempt ${attempt}: ordinary and revalidated service worker profiles identify release ${short(expectedSha)} (${consecutive}/${requiredConsecutive})`);
      if (consecutive >= requiredConsecutive) {
        return { sha: expectedSha, attempts: attempt, waitedMs: now() - startedAt,
          consecutiveObservations: consecutive, profiles: observations };
      }
    } catch (error) {
      if (error?.code !== RELEASE_PROPAGATION_PENDING) throw error;
      consecutive = 0;
      log(`attempt ${attempt}: service worker ${error.observedProfile} observed_sha=${short(error.observedSha)}, expected_sha=${short(expectedSha)}; asset propagation pending, retrying`);
    }
    if (remaining() < intervalMs) throw deadlineError();
    await sleep(intervalMs);
  }
}

async function main() {
  const [url, sha] = process.argv.slice(2);
  const proof = await waitForServiceWorkerRelease(url, sha);
  console.log(`ok service worker release: ${proof.sha} (${proof.consecutiveObservations} consecutive ordinary and revalidated observations)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : 'Service worker release smoke failed'); process.exitCode = 1; });
}
