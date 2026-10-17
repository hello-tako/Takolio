import { createHash } from 'node:crypto';
import { targetHosts, validateDomains } from './hosts.mjs';

const marker = '__TAKOLIO_UNRELATED_DOMAIN_SHA256__';
const digest = (domain) => createHash('sha256').update(JSON.stringify(validateDomains([domain])[0])).digest('hex');

export function privateDomainReceipt(context) {
  const result = structuredClone(context);
  if (!result.hosts) return result;
  const allowed = new Set(targetHosts(result.hosts.environment));
  result.hosts.before = result.hosts.before.map((domain) => {
    if (Object.hasOwn(domain, marker)) return domain;
    return allowed.has(domain.hostname) ? domain : { [marker]: digest(domain) };
  });
  return result;
}

// Match full metadata commitments against private live inventory before recovery.
export function restorePrivateDomains(context, domains) {
  if (!context.hosts) return context;
  const inventory = validateDomains(domains);
  const allowed = new Set(targetHosts(context.hosts.environment));
  const restored = context.hosts.before.map((entry) => {
    if (!Object.hasOwn(entry, marker)) {
      if (!allowed.has(entry.hostname)) throw new Error('Unredacted unrelated domain in recovery receipt');
      return entry;
    }
    if (Object.keys(entry).length !== 1 || !/^[a-f0-9]{64}$/.test(entry[marker])) throw new Error('Invalid private domain commitment');
    const matches = inventory.filter((domain) => digest(domain) === entry[marker]);
    if (matches.length !== 1) throw new Error('Private domain inventory changed; recovery requires reconciliation');
    return matches[0];
  });
  validateDomains(restored);
  context.hosts.before = restored;
  return context;
}

export function hasPrivateDomains(context) {
  return context.hosts?.before?.some((entry) => Object.hasOwn(entry, marker)) ?? false;
}
