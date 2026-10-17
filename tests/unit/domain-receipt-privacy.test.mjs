import { describe, expect, it } from 'vitest';
import { privateDomainReceipt, restorePrivateDomains, hasPrivateDomains } from '../../scripts/domain/receipt-privacy.mjs';

const domain = (hostname, service, id) => ({ id: id.repeat(40), hostname, service, environment: 'production',
  zone_id: 'a'.repeat(32), enabled: true, previews_enabled: false });
function fixture() {
  return { hosts: { environment: 'staging', before: [domain('unrelated.example.test', 'unrelated-worker', 'b'),
    domain('staging.takolio.app', 'frigo-staging', 'c')], created: [] } };
}

describe('public hostname receipt privacy', () => {
  it('keeps only intended Takolio hosts and hashes unrelated account metadata', () => {
    const context = fixture();
    const receipt = privateDomainReceipt(context);
    const json = JSON.stringify(receipt);
    expect(json).not.toContain('unrelated.example.test');
    expect(json).not.toContain('unrelated-worker');
    expect(json).not.toContain('b'.repeat(40));
    expect(json).toContain('staging.takolio.app');
    expect(context.hosts.before[0].hostname).toBe('unrelated.example.test');
    expect(hasPrivateDomains(receipt)).toBe(true);
    expect(privateDomainReceipt(receipt)).toEqual(receipt);
  });

  it('rehydrates exact committed metadata without changing the public receipt', () => {
    const context = fixture();
    const receipt = privateDomainReceipt(context);
    const restored = restorePrivateDomains(structuredClone(receipt), context.hosts.before);
    expect(restored).toEqual(context);
    expect(hasPrivateDomains(restored)).toBe(false);
    expect(JSON.stringify(receipt)).not.toContain('unrelated-worker');
  });

  it('stops recovery on missing, changed or duplicate private inventory', () => {
    const context = fixture();
    const receipt = privateDomainReceipt(context);
    const changed = structuredClone(context.hosts.before); changed[0].service = 'another-worker';
    for (const inventory of [[], changed, [context.hosts.before[0], context.hosts.before[0]]]) {
      expect(() => restorePrivateDomains(structuredClone(receipt), inventory)).toThrow();
    }
  });

  it('rejects malformed commitments and unredacted unrelated metadata', () => {
    const context = fixture();
    expect(() => restorePrivateDomains(context, context.hosts.before)).toThrow('Unredacted');
    const receipt = privateDomainReceipt(fixture());
    receipt.hosts.before[0].unexpected = 'extra';
    expect(() => restorePrivateDomains(receipt, fixture().hosts.before)).toThrow('commitment');
  });

  it('preserves preflight-only receipts and applies the production hostname boundary', () => {
    expect(privateDomainReceipt({ state: 'preflight-failed' })).toEqual({ state: 'preflight-failed' });
    const context = fixture(); context.hosts.environment = 'production';
    const receipt = privateDomainReceipt(context);
    expect(JSON.stringify(receipt)).not.toContain('staging.takolio.app');
    expect(restorePrivateDomains(receipt, context.hosts.before)).toEqual(context);
  });
});
