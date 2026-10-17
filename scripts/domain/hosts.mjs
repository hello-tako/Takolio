import { isDeepStrictEqual } from 'node:util';
import profiles from '../../config/domain-profiles.json' with { type: 'json' };
import { ACCOUNT, ZONE } from './audit-cloud.mjs';

const ID = /^[a-f0-9]{32}$/;
const SHA = /^[a-f0-9]{40}$/;
const VERSION = /^[a-f0-9-]{36}$/;
const fields = ['id', 'hostname', 'service', 'environment', 'zone_id', 'enabled', 'previews_enabled'];
const project = (domain) => Object.fromEntries(fields.map((key) => [key, domain[key]]));
const sort = (domains) => domains.map(project).sort((a, b) => a.id.localeCompare(b.id));

export function targetHosts(environment) {
  if (!Object.hasOwn(profiles, environment)) throw new Error('Invalid domain environment');
  return [profiles[environment].app, profiles[environment].api, profiles[environment].www]
    .filter(Boolean).map((origin) => new URL(origin).hostname);
}

export function validateDomains(domains) {
  if (!Array.isArray(domains)) throw new Error('Complete account domain inventory is required');
  const ids = new Set();
  const hosts = new Set();
  for (const domain of domains) {
    if (!ID.test(domain?.id ?? '') || !ID.test(domain.zone_id ?? '') ||
        typeof domain.hostname !== 'string' || domain.hostname !== domain.hostname.toLowerCase() ||
        typeof domain.service !== 'string' || typeof domain.environment !== 'string' ||
        typeof domain.enabled !== 'boolean' || typeof domain.previews_enabled !== 'boolean' ||
        ids.has(domain.id) || hosts.has(domain.hostname)) throw new Error('Ambiguous account domain inventory');
    ids.add(domain.id);
    hosts.add(domain.hostname);
  }
  return sort(domains);
}

export function planHosts({ environment, sha, versionId, domains, dns, routes }) {
  const hosts = targetHosts(environment);
  if (!SHA.test(sha ?? '') || !VERSION.test(versionId ?? '')) throw new Error('Exact fenced release identity is required');
  const before = validateDomains(domains);
  if (!Array.isArray(dns) || !Array.isArray(routes)) throw new Error('Complete zone DNS and route inventory is required');
  // A pre-existing route can shadow a custom domain; require an explicit new review.
  if (routes.length) throw new Error('Existing zone Worker routes require review');
  const service = environment === 'production' ? 'frigo' : 'frigo-staging';
  for (const hostname of hosts) {
    const domain = before.find((entry) => entry.hostname === hostname);
    if (domain && (domain.zone_id !== ZONE || domain.service !== service || domain.environment !== 'production' ||
        !domain.enabled || domain.previews_enabled)) throw new Error(`Hostname ownership conflict: ${hostname}`);
    if (!domain && dns.some((record) => record.name === hostname ||
        record.name === '*.takolio.app' || record.name === `*.${hostname}`)) throw new Error(`Existing DNS requires review: ${hostname}`);
  }
  return { accountId: ACCOUNT, zoneId: ZONE, environment, sha, versionId, service, hosts,
    before, created: [], events: [], state: 'prepared' };
}

function validateReceipt(receipt) {
  const expected = targetHosts(receipt.environment);
  if (receipt.accountId !== ACCOUNT || receipt.zoneId !== ZONE || !SHA.test(receipt.sha ?? '') ||
      !VERSION.test(receipt.versionId ?? '') || receipt.service !== (receipt.environment === 'production' ? 'frigo' : 'frigo-staging') ||
      !isDeepStrictEqual(receipt.hosts, expected) || !Array.isArray(receipt.created) || !Array.isArray(receipt.events)) throw new Error('Invalid hostname receipt');
  validateDomains(receipt.before);
  validateDomains(receipt.created);
  for (const created of receipt.created) {
    if (!expected.includes(created.hostname) || created.zone_id !== ZONE || created.service !== receipt.service ||
        created.environment !== 'production' || !created.enabled || created.previews_enabled ||
        receipt.before.some((domain) => domain.id === created.id || domain.hostname === created.hostname)) throw new Error('Receipt claims a pre-existing or unrelated hostname');
  }
}

function expectedInventory(receipt) {
  return sort([...receipt.before, ...receipt.created]);
}

async function unchanged(receipt, list) {
  const current = validateDomains(await list());
  if (!isDeepStrictEqual(current, expectedInventory(receipt))) throw new Error('Account domain drift; stop without replacing any hostname');
  return current;
}

// The caller supplies the reviewed workflow gate and persists every intent/result.
// An ambiguous response is never retried or claimed as ownership for deletion.
export async function attachHosts(receipt, { list, put, gate, persist, inventory }) {
  validateReceipt(receipt);
  if (!['prepared', 'attached'].includes(receipt.state)) throw new Error('Hostname operation requires operator reconciliation');
  await unchanged(receipt, list);
  for (const hostname of receipt.hosts) {
    if (expectedInventory(receipt).some((domain) => domain.hostname === hostname)) continue;
    await gate(receipt);
    const fresh = await inventory();
    planHosts({ ...receipt, domains: await list(), dns: fresh.dns, routes: fresh.routes });
    await unchanged(receipt, list);
    receipt.state = 'attaching';
    receipt.events.push({ operation: 'attach-intent', hostname });
    await persist(receipt);
    const response = await put({ hostname, service: receipt.service, zone_id: ZONE,
      enabled: true, previews_enabled: false });
    const [created] = validateDomains([response]);
    if (created.hostname !== hostname || created.service !== receipt.service || created.zone_id !== ZONE ||
        created.environment !== 'production' || !created.enabled || created.previews_enabled ||
        receipt.before.some((domain) => domain.id === created.id)) throw new Error('Ambiguous attachment response; manual reconciliation required');
    receipt.created.push(created);
    receipt.events.push({ operation: 'attached', hostname, id: created.id });
    await persist(receipt);
    await unchanged(receipt, list);
    receipt.state = 'prepared';
    await persist(receipt);
  }
  receipt.state = 'attached';
  await persist(receipt);
  return receipt;
}

export async function detachCreatedHosts(receipt, { list, remove, gate, persist }) {
  validateReceipt(receipt);
  if (!['prepared', 'attached', 'detaching', 'detached'].includes(receipt.state)) throw new Error('Ambiguous attachment requires operator reconciliation before rollback');
  for (const created of [...receipt.created].reverse()) {
    const current = validateDomains(await list());
    const domain = current.find((entry) => entry.id === created.id || entry.hostname === created.hostname);
    if (!domain || !isDeepStrictEqual(domain, created) || !isDeepStrictEqual(current, expectedInventory(receipt))) {
      throw new Error('Rollback ownership or inventory drift; no deletion attempted');
    }
    await gate(receipt);
    receipt.state = 'detaching';
    receipt.events.push({ operation: 'detach-intent', hostname: created.hostname, id: created.id });
    await persist(receipt);
    await remove(created.id);
    const after = validateDomains(await list());
    const expected = sort(expectedInventory(receipt).filter((entry) => entry.id !== created.id));
    if (!isDeepStrictEqual(after, expected)) throw new Error('Ambiguous detach result; stop before code rollback');
    receipt.created = receipt.created.filter((entry) => entry.id !== created.id);
    receipt.events.push({ operation: 'detached', hostname: created.hostname, id: created.id });
    await persist(receipt);
  }
  receipt.state = 'detached';
  await persist(receipt);
  return receipt;
}
