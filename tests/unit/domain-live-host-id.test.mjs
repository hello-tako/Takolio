import { describe, expect, it } from 'vitest';
import { attachHosts, detachCreatedHosts, planHosts, validateDomains } from '../../scripts/domain/hosts.mjs';
import { ZONE } from '../../scripts/domain/audit-cloud.mjs';

const legacy = { id: '52a7058be9242b54ec399c6582f5bc925c4ef612',
  hostname: 'frigo.tungjpstore.net', service: 'frigo', environment: 'production',
  zone_id: '493cce5038aaaa97653fe1b1cc20ebbc', enabled: true, previews_enabled: false };
const identity = { environment: 'staging', sha: 'a'.repeat(40), versionId: '00000000-0000-4000-8000-000000000001' };

describe('live Workers custom-domain identifiers', () => {
  it('accepts real 40-character domain IDs while keeping zone IDs at 32 characters', () => {
    expect(validateDomains([legacy])).toEqual([legacy]);
    expect(validateDomains([{ ...legacy, id: '1'.repeat(32) }])).toHaveLength(1);
    for (const id of ['1'.repeat(31), '1'.repeat(33), '1'.repeat(39), '1'.repeat(41),
      '../deployments', 'a'.repeat(40) + '/other', 'A'.repeat(40)]) {
      expect(() => validateDomains([{ ...legacy, id }])).toThrow('Ambiguous');
    }
    expect(() => validateDomains([{ ...legacy, zone_id: '2'.repeat(40) }])).toThrow('Ambiguous');
  });

  it('records returned 40-character IDs and rolls back only newly attached staging hosts', async () => {
    let domains = [structuredClone(legacy)];
    const removed = [];
    const receipt = planHosts({ ...identity, domains, dns: [], routes: [] });
    const io = {
      list: async () => structuredClone(domains),
      inventory: async () => ({ dns: [], routes: [] }),
      gate: async () => {}, persist: async () => {},
      put: async (body) => {
        const value = { ...body, id: String(domains.length + 1).repeat(40), environment: 'production' };
        domains.push(value);
        return value;
      },
      remove: async (id) => { removed.push(id); domains = domains.filter((entry) => entry.id !== id); },
    };
    await attachHosts(receipt, io);
    expect(receipt.created.map((entry) => entry.id)).toEqual(['2'.repeat(40), '3'.repeat(40)]);
    expect(receipt.created.every((entry) => entry.zone_id === ZONE && entry.service === 'frigo-staging')).toBe(true);
    await detachCreatedHosts(receipt, io);
    expect(removed).toEqual(['3'.repeat(40), '2'.repeat(40)]);
    expect(domains).toEqual([legacy]);
  });

  it('keeps ownership and duplicate protection for 40-character IDs', async () => {
    expect(() => validateDomains([legacy, { ...legacy, hostname: 'other.example' }])).toThrow('Ambiguous');
    const receipt = planHosts({ ...identity, domains: [legacy], dns: [], routes: [] });
    receipt.created = [{ ...legacy, zone_id: ZONE, hostname: 'staging.takolio.app', service: 'frigo-staging' }];
    let deleted = false;
    await expect(detachCreatedHosts(receipt, {
      list: async () => [legacy], remove: async () => { deleted = true; }, gate: async () => {}, persist: async () => {},
    })).rejects.toThrow('pre-existing or unrelated');
    expect(deleted).toBe(false);
  });
});

it('allows rollback DELETE for both domain ID forms without allowing other resources or path injection', async () => {
  const { isStagingMutation } = await import('../../scripts/domain/staging-provider.mjs');
  const base = '/accounts/ef250a88911fd24073cb73d1c07e0218/workers';
  for (const length of [32, 40]) {
    expect(isStagingMutation(`${base}/domains/${'a'.repeat(length)}`, 'DELETE')).toBe(true);
  }
  for (const [path, method] of [
    [`${base}/domains/${'a'.repeat(39)}`, 'DELETE'],
    [`${base}/domains/${'a'.repeat(40)}/extra`, 'DELETE'],
    [`${base}/domains/${'a'.repeat(40)}?other=1`, 'DELETE'],
    [`${base}/domains/${'a'.repeat(40)}`, 'PUT'],
    [`${base}/scripts/frigo/deployments`, 'POST'],
    [`${base}/scripts/frigo-staging/deployments`, 'DELETE'],
    ['/accounts/other/workers/domains/' + 'a'.repeat(40), 'DELETE'],
  ]) expect(isStagingMutation(path, method)).toBe(false);
  expect(isStagingMutation(`${base}/scripts/frigo-staging/deployments`, 'POST')).toBe(true);
  expect(isStagingMutation(`${base}/domains`, 'PUT')).toBe(true);
});
