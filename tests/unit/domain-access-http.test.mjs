import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { accessCurl, accessHeaders } from '../../scripts/domain/access-http.mjs';

const env = { CF_ACCESS_CLIENT_ID: 'approved-fixture-client.access', CF_ACCESS_CLIENT_SECRET: 'private-fixture-secret-never-log' };

describe('application-scoped Access transport', () => {
  it('limits credential transmission to the three approved staging origins', () => {
    for (const origin of ['https://staging.takolio.app', 'https://api-staging.takolio.app', 'https://frigo-staging.tungbipdz.workers.dev']) {
      expect(accessHeaders(`${origin}/sw.js`, env)).toEqual({ 'CF-Access-Client-Id': env.CF_ACCESS_CLIENT_ID,
        'CF-Access-Client-Secret': env.CF_ACCESS_CLIENT_SECRET });
    }
    const credentialedUrl = new URL('https://staging.takolio.app/');
    credentialedUrl.username = 'fixture';
    for (const url of ['https://takolio.app/', 'https://evil.example/', 'http://staging.takolio.app/',
      'https://staging.takolio.app.evil.example/', credentialedUrl.href]) {
      expect(() => accessHeaders(url, env)).toThrow('approved staging origins');
    }
    expect(accessHeaders('https://takolio.app', {})).toEqual({});
  });

  it('rejects incomplete credentials and header injection without disclosing values', () => {
    for (const credentials of [{ CF_ACCESS_CLIENT_ID: env.CF_ACCESS_CLIENT_ID },
      { ...env, CF_ACCESS_CLIENT_SECRET: `${env.CF_ACCESS_CLIENT_SECRET}\r\nX-Other: secret` }]) {
      let error;
      try { accessHeaders('https://staging.takolio.app', credentials); } catch (value) { error = value; }
      expect(error.message).toBe('Incomplete or invalid staging Access credentials');
    }
  });

  it('passes credentials only on curl stdin and sanitizes process failures', async () => {
    const observed = {};
    const spawnImpl = (command, args, options) => {
      Object.assign(observed, { command, args, options });
      const child = new EventEmitter();
      child.stderr = new EventEmitter();
      child.stdin = new EventEmitter();
      child.stdin.end = (text) => {
        observed.stdin = text;
        queueMicrotask(() => {
          child.stderr.emit('data', Buffer.from(env.CF_ACCESS_CLIENT_SECRET));
          child.emit('close', 22);
        });
      };
      return child;
    };
    const error = await accessCurl(['--silent', '--fail', 'https://staging.takolio.app/sw.js'], { env, spawnImpl }).catch((value) => value);
    expect(error.message).toContain('Release curl failed (exit 22;');
    expect(error.message).not.toContain(env.CF_ACCESS_CLIENT_SECRET);
    expect(observed.command).toBe('curl');
    expect(observed.args).toContain('@-');
    expect(JSON.stringify(observed.args)).not.toContain(env.CF_ACCESS_CLIENT_SECRET);
    expect(observed.stdin).toContain(`CF-Access-Client-Secret: ${env.CF_ACCESS_CLIENT_SECRET}\n`);
    expect(observed.args[0]).toBe('--disable');
  });

  it('rejects redirect and multiple-transfer options before spawning', async () => {
    for (const flag of ['-L', '--location', '--location-trusted', '--next']) {
      await expect(accessCurl([flag, 'https://staging.takolio.app'], { env,
        spawnImpl: () => { throw new Error('must not spawn'); } })).rejects.toThrow('forbids redirects');
    }
  });
});

it('scopes fetch credentials and forbids redirects and writes before transmission', async () => {
  const { stagingFetch } = await import('../../scripts/domain/access-http.mjs');
  const calls = [];
  const fetchImpl = async (...args) => { calls.push(args); return new Response('{}'); };
  await stagingFetch('https://staging.takolio.app/api/v1/health', { redirect: 'follow', credentials: 'include' }, { env, fetchImpl });
  expect(calls[0][1].redirect).toBe('error');
  expect(calls[0][1].credentials).toBe('omit');
  expect(calls[0][1].headers.get('CF-Access-Client-Secret')).toBe(env.CF_ACCESS_CLIENT_SECRET);
  await expect(stagingFetch('https://evil.example', {}, { env, fetchImpl })).rejects.toThrow('approved staging origins');
  await expect(stagingFetch('https://staging.takolio.app', { method: 'POST' }, { env, fetchImpl })).rejects.toThrow('read-only');
  await expect(stagingFetch('https://staging.takolio.app', {}, { env: {}, fetchImpl })).rejects.toThrow('required');
  expect(calls).toHaveLength(1);
  const error = await stagingFetch('https://staging.takolio.app', {}, { env,
    fetchImpl: async () => { throw new Error(env.CF_ACCESS_CLIENT_SECRET); } }).catch((value) => value);
  expect(error.message).toBe('Staging Access request failed');
});

it('rejects mismatched native URLs and curl options that could expose credentials', async () => {
  const { stagingCurlExecute } = await import('../../scripts/domain/access-http.mjs');
  for (const args of [
    ['--location', 'https://staging.takolio.app'],
    ['--verbose', 'https://staging.takolio.app'],
    ['https://evil.example'],
    ['--next', 'https://staging.takolio.app'],
  ]) {
    await expect(stagingCurlExecute('curl', args, { maxBuffer: 1024 }, 'https://staging.takolio.app', env)).rejects.toThrow();
  }
});
