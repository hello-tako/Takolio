import { afterEach, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { channelPlan, confirmChannel, main, readCredentials } from '../../scripts/payos-channel.mjs';

const credentials = { PAYOS_CLIENT_ID: 'test-client', PAYOS_API_KEY: 'test-api', PAYOS_CHECKSUM_KEY: 'test-checksum' };
const folders = [];
afterEach(() => { for (const path of folders.splice(0)) rmSync(path, { recursive: true }); });
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

describe('payOS operator setup', () => {
  it('pins isolated environment URLs and defaults to no network mutation', async () => {
    expect(channelPlan('staging').webhookUrl).toBe('https://frigo-staging.tungbipdz.workers.dev/api/v1/billing/payos/webhook');
    expect(channelPlan('production').webhookUrl).toBe('https://frigo.tungjpstore.net/api/v1/billing/payos/webhook');
    expect(() => channelPlan('development')).toThrow();
    expect(await main(['--env', 'production'])).toMatchObject({ dryRun: true, confirmed: false });
    expect(await main(['--env', 'production', '--confirm-webhook', '--dry-run'])).toMatchObject({ dryRun: true });
  });

  it('requires private regular credential files and rejects missing/extra keys', () => {
    const dir = mkdtempSync(join(tmpdir(), 'payos-operator-')); folders.push(dir);
    const file = join(dir, 'credentials.json');
    writeFileSync(file, JSON.stringify(credentials), { mode: 0o600 });
    expect(readCredentials(file)).toEqual(credentials);
    chmodSync(file, 0o644); expect(() => readCredentials(file)).toThrow();
    chmodSync(file, 0o600);
    const link = join(dir, 'link.json'); symlinkSync(file, link); expect(() => readCredentials(link)).toThrow();
    writeFileSync(file, JSON.stringify({ ...credentials, other: 'unexpected' })); expect(() => readCredentials(file)).toThrow();
    writeFileSync(file, '{}'); expect(() => readCredentials(file)).toThrow();
  });

  it('signs a no-purchase probe before registering the exact webhook URL', async () => {
    const calls = [];
    const result = await confirmChannel('staging', credentials, async (url, init) => {
      calls.push({ url, init });
      if (calls.length === 1) return json({ success: true });
      return json({ code: '00', data: { webhookUrl: channelPlan('staging').webhookUrl } });
    });
    const { data, signature } = JSON.parse(calls[0].init.body);
    const canonical = Object.keys(data).sort().map((key) => `${key}=${data[key]}`).join('&');
    expect(signature).toBe(createHmac('sha256', credentials.PAYOS_CHECKSUM_KEY).update(canonical).digest('hex'));
    expect(calls[0].init.headers['x-api-key']).toBeUndefined();
    expect(calls[1].url).toBe('https://api-merchant.payos.vn/confirm-webhook');
    expect(calls[1].init.headers['x-api-key']).toBe('test-api');
    expect(result).toEqual({ ...channelPlan('staging'), confirmed: true });
    expect(JSON.stringify(result)).not.toContain('test-');
  });

  it('stops before provider mutation if the Worker cannot verify the key', async () => {
    let calls = 0;
    await expect(confirmChannel('production', credentials, async () => { calls++; return json({ error: 'Invalid signature' }, 401); })).rejects.toThrow();
    expect(calls).toBe(1);
  });

  it('rejects a mismatched confirmed URL and oversized provider payload', async () => {
    let calls = 0;
    await expect(confirmChannel('production', credentials, async () => ++calls === 1 ? json({ success: true })
      : json({ code: '00', data: { webhookUrl: channelPlan('staging').webhookUrl } }))).rejects.toThrow();
    await expect(confirmChannel('production', credentials, async () => json({ success: true, padding: 'x'.repeat(65 * 1024) }))).rejects.toThrow();
  });
});
