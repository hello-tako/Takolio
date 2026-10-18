import { describe, expect, it } from 'vitest';
import { attachHosts, detachCreatedHosts, planHosts } from '../../scripts/domain/hosts.mjs';
import { ZONE } from '../../scripts/domain/audit-cloud.mjs';

const identity = { environment: 'staging', sha: 'a'.repeat(40), versionId: '00000000-0000-4000-8000-000000000001' };
const legacy = { id: 'a'.repeat(40), hostname: 'legacy.example.com', service: 'unrelated', environment: 'production',
  zone_id: 'b'.repeat(32), enabled: true, previews_enabled: false };
function fixture() {
  let domains = [structuredClone(legacy)];
  const persisted = [];
  const calls = [];
  const receipt = planHosts({ ...identity, domains, dns: [], routes: [] });
  const io = {
    list: async () => structuredClone(domains),
    put: async (body) => {
      calls.push(body);
      const created = { ...body, id: String(calls.length).repeat(40), environment: 'production' };
      domains.push(created);
      return { ...created, environment: '' };
    },
    gate: async () => {},
    persist: async (value) => persisted.push(structuredClone(value)),
    inventory: async () => ({ dns: [], routes: [] }),
    remove: async (id) => { domains = domains.filter((domain) => domain.id !== id); },
  };
  return { receipt, io, persisted, calls, drift: (update) => { domains = update(domains); }, current: () => domains };
}

describe('attachment acknowledgement and independent inventory confirmation', () => {
  it('handles the observed empty PUT environment, persists ID before GET and rolls back only confirmed hosts', async () => {
    const source = fixture();
    const list = source.io.list;
    source.io.list = async () => {
      if (source.calls.length > source.receipt.created.length) {
        expect(source.persisted.at(-1).events.at(-1)).toMatchObject({ operation: 'attach-acknowledged', id: String(source.calls.length).repeat(40) });
      }
      return list();
    };
    await attachHosts(source.receipt, source.io);
    expect(source.receipt.created.map((entry) => entry.hostname)).toEqual(['staging.takolio.app', 'api-staging.takolio.app']);
    expect(source.receipt.created.every((entry) => entry.environment === 'production')).toBe(true);
    await attachHosts(source.receipt, source.io);
    expect(source.calls).toHaveLength(2);
    source.io.list = list;
    await detachCreatedHosts(source.receipt, source.io);
    expect(source.current()).toEqual([legacy]);
  });

  it('also confirms a complete production-environment PUT response through GET', async () => {
    const source = fixture();
    const put = source.io.put;
    source.io.put = async (body) => ({ ...await put(body), environment: 'production' });
    await attachHosts(source.receipt, source.io);
    expect(source.receipt.created).toHaveLength(2);
  });

  it.each([
    ['missing ID', (response) => ({ ...response, id: undefined })],
    ['malformed ID', (response) => ({ ...response, id: '../other' })],
    ['existing ID', (response) => ({ ...response, id: legacy.id })],
    ['wrong hostname', (response) => ({ ...response, hostname: 'admin.takolio.app' })],
    ['wrong service', (response) => ({ ...response, service: 'frigo' })],
    ['wrong zone', (response) => ({ ...response, zone_id: 'c'.repeat(32) })],
    ['missing environment', (response) => ({ ...response, environment: undefined })],
    ['wrong environment', (response) => ({ ...response, environment: 'staging' })],
    ['disabled routing', (response) => ({ ...response, enabled: false })],
    ['preview exposure', (response) => ({ ...response, previews_enabled: true })],
    ['ID-only response', (response) => ({ id: response.id })],
  ])('rejects %s without claiming or retrying the attachment', async (_name, alter) => {
    const source = fixture();
    const put = source.io.put;
    source.io.put = async (body) => alter(await put(body));
    await expect(attachHosts(source.receipt, source.io)).rejects.toThrow();
    expect(source.receipt.created).toEqual([]);
    expect(source.calls).toHaveLength(1);
    await expect(attachHosts(source.receipt, source.io)).rejects.toThrow('reconciliation');
    await expect(detachCreatedHosts(source.receipt, source.io)).rejects.toThrow('reconciliation');
  });

  it.each([
    ['missing domain', (domains) => domains.slice(0, 1)],
    ['changed ID', (domains) => domains.map((domain, i) => i ? { ...domain, id: 'f'.repeat(40) } : domain)],
    ['wrong hostname', (domains) => domains.map((domain, i) => i ? { ...domain, hostname: 'admin.takolio.app' } : domain)],
    ['wrong service', (domains) => domains.map((domain, i) => i ? { ...domain, service: 'frigo' } : domain)],
    ['wrong zone', (domains) => domains.map((domain, i) => i ? { ...domain, zone_id: 'c'.repeat(32) } : domain)],
    ['empty environment', (domains) => domains.map((domain, i) => i ? { ...domain, environment: '' } : domain)],
    ['wrong environment', (domains) => domains.map((domain, i) => i ? { ...domain, environment: 'preview' } : domain)],
    ['disabled routing', (domains) => domains.map((domain, i) => i ? { ...domain, enabled: false } : domain)],
    ['preview exposure', (domains) => domains.map((domain, i) => i ? { ...domain, previews_enabled: true } : domain)],
    ['unrelated drift', (domains) => domains.map((domain, i) => i ? domain : { ...domain, service: 'changed' })],
    ['duplicate hostname', (domains) => [...domains, { ...domains[1], id: 'f'.repeat(40) }]],
  ])('stops at read-back %s, retains intent and refuses deletion', async (_name, alter) => {
    const source = fixture();
    const put = source.io.put;
    source.io.put = async (body) => {
      const response = await put(body);
      source.drift(alter);
      return response;
    };
    await expect(attachHosts(source.receipt, source.io)).rejects.toThrow();
    expect(source.receipt.state).toBe('attaching');
    expect(source.receipt.created).toEqual([]);
    expect(source.persisted.at(-1).events.at(-1)).toMatchObject({ operation: 'attach-acknowledged' });
    await expect(detachCreatedHosts(source.receipt, source.io)).rejects.toThrow('reconciliation');
    expect(source.calls).toHaveLength(1);
  });

  it('retains acknowledgement when GET fails and does not issue another PUT', async () => {
    const source = fixture();
    const list = source.io.list;
    source.io.list = async () => {
      if (source.calls.length) throw new Error('read unavailable');
      return list();
    };
    await expect(attachHosts(source.receipt, source.io)).rejects.toThrow('read unavailable');
    expect(source.persisted.at(-1).events.at(-1).operation).toBe('attach-acknowledged');
    expect(source.receipt.created).toEqual([]);
    expect(source.calls).toHaveLength(1);
  });
});
