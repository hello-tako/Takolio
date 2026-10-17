import { describe, expect, it } from 'vitest';
import { attachHosts, detachCreatedHosts, planHosts } from '../../scripts/domain/hosts.mjs';
import { ZONE } from '../../scripts/domain/audit-cloud.mjs';

const legacy = { id: '1'.repeat(32), zone_id: '2'.repeat(32), hostname: 'frigo.tungjpstore.net',
  service: 'frigo', environment: 'production', enabled: true, previews_enabled: false };
const identity = { environment: 'production', sha: 'a'.repeat(40), versionId: '00000000-0000-0000-0000-000000000001' };
function fixture(before = [legacy]) {
  let domains = structuredClone(before);
  const mutations = [];
  const persisted = [];
  let gates = 0;
  const receipt = planHosts({ ...identity, domains, dns: [], routes: [] });
  const io = {
    list: async () => structuredClone(domains),
    inventory: async () => ({ dns: [], routes: [] }),
    put: async (body) => {
      mutations.push({ method: 'PUT', body });
      const domain = { ...body, id: String(domains.length + 3).repeat(32), environment: 'production' };
      domains.push(domain);
      return domain;
    },
    remove: async (id) => { mutations.push({ method: 'DELETE', id }); domains = domains.filter((domain) => domain.id !== id); },
    gate: async () => { gates++; },
    persist: async (value) => { persisted.push(structuredClone(value)); },
  };
  return { receipt, io, mutations, persisted, gates: () => gates,
    current: () => domains, drift: (callback) => { domains = callback(domains); } };
}

describe('individual hostname attachment and ownership rollback', () => {
  it('adds exactly the three approved production hosts and preserves legacy; repeated attach does not mutate', async () => {
    const source = fixture();
    await attachHosts(source.receipt, source.io);
    expect(source.mutations.map((entry) => entry.body?.hostname)).toEqual(['takolio.app', 'api.takolio.app', 'www.takolio.app']);
    expect(source.current()[0]).toEqual(legacy);
    expect(source.gates()).toBe(3);
    expect(source.persisted[0]).toMatchObject({ state: 'attaching', events: [{ operation: 'attach-intent', hostname: 'takolio.app' }] });
    await attachHosts(source.receipt, source.io);
    expect(source.mutations).toHaveLength(3);
    await detachCreatedHosts(source.receipt, source.io);
    expect(source.current()).toEqual([legacy]);
    expect(source.receipt.state).toBe('detached');
    expect(source.mutations.slice(3).map((entry) => entry.id)).toEqual(['6'.repeat(32), '5'.repeat(32), '4'.repeat(32)]);
  });

  it('never claims or deletes an already correct custom domain', async () => {
    const existing = { ...legacy, id: '3'.repeat(32), zone_id: ZONE, hostname: 'takolio.app' };
    const source = fixture([legacy, existing]);
    await attachHosts(source.receipt, source.io);
    expect(source.receipt.created).toHaveLength(2);
    await detachCreatedHosts(source.receipt, source.io);
    expect(source.current()).toEqual([legacy, existing]);
  });

  it('rejects wrong service, preview exposure, DNS conflict, route shadowing and malformed inventory before mutation', () => {
    const args = { ...identity, domains: [legacy], dns: [], routes: [] };
    for (const change of [
      { domains: [{ ...legacy, zone_id: ZONE, hostname: 'takolio.app', service: 'other' }] },
      { domains: [{ ...legacy, zone_id: ZONE, hostname: 'takolio.app', previews_enabled: true }] },
      { dns: [{ name: 'takolio.app', type: 'A' }] },
      { dns: [{ name: '*.takolio.app', type: 'CNAME' }] },
      { routes: [{ pattern: '*takolio.app/*', script: 'other' }] },
      { domains: [legacy, legacy] },
      { domains: [{ ...legacy, enabled: undefined }] },
    ]) expect(() => planHosts({ ...args, ...change })).toThrow();
  });

  it('halts on external drift or a rejected live release gate before any PUT', async () => {
    const source = fixture();
    source.drift((domains) => domains.map((domain) => ({ ...domain, previews_enabled: true })));
    await expect(attachHosts(source.receipt, source.io)).rejects.toThrow('domain drift');
    expect(source.mutations).toEqual([]);
    const denied = fixture();
    denied.io.gate = async () => { throw new Error('main moved'); };
    await expect(attachHosts(denied.receipt, denied.io)).rejects.toThrow('main moved');
    expect(denied.mutations).toEqual([]);
  });

  it('persists ambiguous intent, never retries a timed-out mutation and blocks automatic rollback', async () => {
    const source = fixture();
    let writes = 0;
    source.io.put = async () => { writes++; throw new Error('transport timeout'); };
    await expect(attachHosts(source.receipt, source.io)).rejects.toThrow('transport timeout');
    expect(source.persisted.at(-1).state).toBe('attaching');
    await expect(attachHosts(source.receipt, source.io)).rejects.toThrow('reconciliation');
    await expect(detachCreatedHosts(source.receipt, source.io)).rejects.toThrow('reconciliation');
    expect(writes).toBe(1);
  });

  it('does not delete a hostname whose ID or owner changed after attachment', async () => {
    const source = fixture();
    await attachHosts(source.receipt, source.io);
    source.drift((domains) => domains.map((domain) => domain.hostname === 'www.takolio.app'
      ? { ...domain, id: '9'.repeat(32), service: 'other' } : domain));
    await expect(detachCreatedHosts(source.receipt, source.io)).rejects.toThrow('ownership');
    expect(source.mutations.filter((entry) => entry.method === 'DELETE')).toEqual([]);
  });

  it('rejects receipt tampering that claims unrelated or pre-existing domains', async () => {
    const source = fixture();
    source.receipt.created = [legacy];
    await expect(detachCreatedHosts(source.receipt, source.io)).rejects.toThrow('pre-existing or unrelated');
    expect(source.mutations).toEqual([]);
  });

  it('staging target cannot include production or Admin hostnames', () => {
    const receipt = planHosts({ ...identity, environment: 'staging', domains: [], dns: [], routes: [] });
    expect(receipt.service).toBe('frigo-staging');
    expect(receipt.hosts).toEqual(['staging.takolio.app', 'api-staging.takolio.app']);
  });
});
