import { describe, expect, it } from 'vitest';
import { attachHosts, detachCreatedHosts, planHosts } from '../../scripts/domain/hosts.mjs';
import { ZONE } from '../../scripts/domain/audit-cloud.mjs';

const app = { id: 'a'.repeat(40), zone_id: ZONE, hostname: 'staging.takolio.app',
  service: 'frigo-staging', environment: 'production', enabled: true, previews_enabled: false };
const identity = { environment: 'staging', sha: 'b'.repeat(40), versionId: '00000000-0000-4000-8000-000000000001' };
async function fixture() {
  let domains = [structuredClone(app)];
  const writes = [];
  const snapshots = [];
  const receipt = planHosts({ ...identity, domains, dns: [], routes: [] });
  const io = {
    list: async () => structuredClone(domains),
    inventory: async () => ({ dns: [], routes: [] }),
    put: async (body) => {
      const domain = { ...body, id: 'c'.repeat(40), environment: 'production' };
      domains.push(domain);
      return domain;
    },
    gate: async () => {},
    persist: async (value) => snapshots.push(JSON.parse(JSON.stringify(value))),
    remove: async (id) => { writes.push(id); domains = domains.filter((entry) => entry.id !== id); },
  };
  await attachHosts(receipt, io);
  return { receipt, io, writes, snapshots, current: () => domains,
    drift: (change) => { domains = change(domains); } };
}

describe('domain deletion response-loss reconciliation', () => {
  it('resumes a persisted DELETE intent from exact absent-domain inventory without replaying DELETE', async () => {
    const source = await fixture();
    const remove = source.io.remove;
    source.io.remove = async (id) => { await remove(id); throw new Error('empty deletion response'); };
    await expect(detachCreatedHosts(source.receipt, source.io)).rejects.toThrow('empty deletion response');
    const restarted = source.snapshots.at(-1);
    expect(restarted.state).toBe('detaching');
    expect(restarted.events.at(-1)).toMatchObject({ operation: 'detach-intent', id: 'c'.repeat(40) });
    await detachCreatedHosts(restarted, source.io);
    expect(source.writes).toEqual(['c'.repeat(40)]);
    expect(source.current()).toEqual([app]);
    expect(restarted.created).toEqual([]);
    expect(restarted.state).toBe('detached');
    expect(restarted.events.at(-1)).toMatchObject({ operation: 'detach-reconciled', id: 'c'.repeat(40) });
  });

  it.each(['no intent', 'wrong ID', 'wrong hostname', 'wrong state', 'later event', 'unrelated drift', 'replacement owner'])(
    'rejects absent-domain reconciliation with %s and performs no DELETE', async (kind) => {
      const source = await fixture();
      const created = source.receipt.created[0];
      source.receipt.state = 'detaching';
      source.receipt.events.push({ operation: 'detach-intent', hostname: created.hostname, id: created.id });
      source.drift((domains) => domains.filter((entry) => entry.id !== created.id));
      if (kind === 'no intent') source.receipt.events.pop();
      if (kind === 'wrong ID') source.receipt.events.at(-1).id = 'd'.repeat(40);
      if (kind === 'wrong hostname') source.receipt.events.at(-1).hostname = 'other.takolio.app';
      if (kind === 'wrong state') source.receipt.state = 'attached';
      if (kind === 'later event') source.receipt.events.push({ operation: 'unrelated' });
      if (kind === 'unrelated drift') source.drift((domains) => domains.map((entry) => ({ ...entry, enabled: false })));
      if (kind === 'replacement owner') source.drift((domains) => [...domains, { ...created, id: 'd'.repeat(40), service: 'other' }]);
      await expect(detachCreatedHosts(source.receipt, source.io)).rejects.toThrow('ownership or inventory drift');
      expect(source.writes).toEqual([]);
    },
  );

  it('checks live traffic/operational fences before recording a reconciled deletion', async () => {
    const source = await fixture();
    const created = source.receipt.created[0];
    source.receipt.state = 'detaching';
    source.receipt.events.push({ operation: 'detach-intent', hostname: created.hostname, id: created.id });
    source.drift((domains) => domains.filter((entry) => entry.id !== created.id));
    source.io.gate = async () => { throw new Error('traffic changed'); };
    await expect(detachCreatedHosts(source.receipt, source.io)).rejects.toThrow('traffic changed');
    expect(source.receipt.created).toHaveLength(1);
    expect(source.writes).toEqual([]);
  });
});

it('rejects inventory drift while the pending deletion is being reconciled', async () => {
  const source = await fixture();
  const created = source.receipt.created[0];
  source.receipt.state = 'detaching';
  source.receipt.events.push({ operation: 'detach-intent', hostname: created.hostname, id: created.id });
  source.drift((domains) => domains.filter((entry) => entry.id !== created.id));
  source.io.gate = async () => { source.drift((domains) => domains.map((entry) => ({ ...entry, service: 'changed' }))); };
  await expect(detachCreatedHosts(source.receipt, source.io)).rejects.toThrow('inventory drift');
  expect(source.receipt.created).toHaveLength(1);
  expect(source.writes).toEqual([]);
});
