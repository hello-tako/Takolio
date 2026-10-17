import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const profiles = JSON.parse(readFileSync('config/domain-profiles.json', 'utf8'));
const targets = [
  profiles.production.app, `${profiles.production.www}/recipes/fixture?domain_probe=1`,
  `${profiles.production.api}/api/v1/health`, profiles.staging.app,
  `${profiles.staging.api}/api/v1/health`, `${profiles.production.legacy}/api/v1/health/ready`,
  `${profiles.staging.legacy}/api/v1/health/ready`,
];
const results = await Promise.all(targets.map(async (url) => {
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'manual', credentials: 'omit', signal: AbortSignal.timeout(15000) });
    const body = await response.text();
    let health;
    if (response.headers.get('content-type')?.includes('application/json')) {
      const value = JSON.parse(body);
      health = { status: value.status, commit: value.commit, environment: value.environment, database: value.services?.database, emailDeliveryVerified: value.services?.email?.deliveryVerified };
    }
    return { url, status: response.status, httpsVerified: true,
      headers: Object.fromEntries(['location', 'content-type', 'strict-transport-security', 'x-robots-tag'].map((name) => [name, response.headers.get(name)])),
      bodySha256: createHash('sha256').update(body).digest('hex'), health };
  } catch {
    return { url, status: null, httpsVerified: false, error: 'DNS_TLS_OR_HTTP_UNREACHABLE' };
  }
}));
writeFileSync('docs/domain-integration/evidence/live-http.json', `${JSON.stringify({ observedAt: new Date().toISOString(), mutation: false, results }, null, 2)}\n`);
process.stdout.write(`${results.filter((entry) => entry.status !== null).length}/${targets.length} hosts reachable; see live-http.json. Unreachable custom domains are not verified.\n`);
