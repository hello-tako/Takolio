import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchServiceWorkerWithCurl, waitForServiceWorkerRelease } from '../../scripts/wait-for-service-worker-release.mjs';

const sha = 'a'.repeat(40);
const previousSha = 'b'.repeat(40);
const source = readFileSync('public/sw.js', 'utf8');
const sw = (buildId = sha) => source.replace('__TAKOSAN_BUILD_ID__', buildId);
const exact = () => sw();
const pair = () => [exact(), exact()];
const origin = 'https://frigo.example.net';

function harness(responses, overrides = {}) {
  let clock = 0;
  const calls = [];
  const logs = [];
  const fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    const next = responses.shift();
    if (next === undefined) throw new Error('Harness exhausted');
    if (next instanceof Error) throw next;
    clock += next.elapsedMs ?? 0;
    return new Response(typeof next === 'string' ? next : next.body, {
      status: next.status ?? 200,
      headers: { 'content-type': 'text/javascript', 'cache-control': 'no-cache, no-store, must-revalidate', ...next.headers },
    });
  };
  return { calls, logs, clock: () => clock, options: { fetch, now: () => clock,
    sleep: async (ms) => { clock += ms; }, log: (line) => logs.push(line), ...overrides } };
}

afterEach(() => vi.restoreAllMocks());

describe('curl service-worker smoke release convergence', () => {
  it('reproduces run 38245609645: revalidated exact assets do not prove the ordinary transport profile', async () => {
    const h = harness([sw(previousSha), ...pair(), ...pair(), ...pair()]);
    const proof = await waitForServiceWorkerRelease(origin, sha, h.options);
    expect(proof).toMatchObject({ sha, attempts: 4, waitedMs: 9_000, consecutiveObservations: 3,
      profiles: { ordinary: { sha256: createHash('sha256').update(sw()).digest('hex') }, revalidated: { sha } } });
    expect(h.calls).toHaveLength(7);
    expect(h.calls[0].options.headers).toEqual({ Accept: '*/*' });
    expect(h.calls[2].options.headers).toEqual({ Accept: 'text/javascript, application/javascript', 'Cache-Control': 'no-cache' });
    expect(h.calls.every((call) => call.url === `${origin}/sw.js` && call.options.signal instanceof AbortSignal)).toBe(true);
    expect(h.logs.join('\n')).toContain('ordinary');
    expect(h.logs.join('\n')).not.toContain(previousSha);
  });

  it('requires three fresh pairs after a valid older profile appears', async () => {
    const h = harness([...pair(), ...pair(), exact(), sw(previousSha), ...pair(), ...pair(), ...pair()]);
    await expect(waitForServiceWorkerRelease(origin, sha, h.options)).resolves.toMatchObject({ attempts: 6, consecutiveObservations: 3 });
  });

  it('keeps a shared deadline when old assets never converge', async () => {
    const h = harness(Array.from({ length: 40 }, () => sw(previousSha)));
    await expect(waitForServiceWorkerRelease(origin, sha, h.options)).rejects.toThrow('within 90000 ms');
    expect(h.clock()).toBe(90_000);
    expect(h.calls).toHaveLength(30);
  });

  it.each([
    ['branch identity', { body: sw('main') }],
    ['duplicate identity', { body: `${sw()}\nconst BUILD_ID = '${sha}';` }],
    ['comment identity', { body: sw().replace(`const BUILD_ID = '${sha}';`, `// const BUILD_ID = '${sha}';`) }],
    ['HTML', { body: '<html>upstream</html>', headers: { 'content-type': 'text/html' } }],
    ['missing no-store', { body: sw(), headers: { 'cache-control': 'max-age=3600' } }],
    ['missing marker', { body: sw().replace("self.addEventListener('install',", "self.addEventListener('other',") }],
    ['oversize body', { body: `${sw()}\n// ${'x'.repeat(256 * 1024)}` }],
    ['redirect', { body: 'redirect', status: 302 }],
    ['server error', { body: 'unavailable', status: 503 }],
  ])('fails closed immediately on %s', async (_name, response) => {
    const h = harness([response, ...pair(), ...pair(), ...pair()]);
    await expect(waitForServiceWorkerRelease(origin, sha, h.options)).rejects.toThrow('Service worker');
    expect(h.calls).toHaveLength(1);
    expect(h.clock()).toBe(0);
  });

  it('sanitizes transport failure without treating it as old-release propagation', async () => {
    const h = harness([new Error('private-fixture-do-not-log')]);
    const error = await waitForServiceWorkerRelease(origin, sha, h.options).catch((failure) => failure);
    expect(error.message).toBe('Service worker ordinary request failed');
    expect(h.logs.join('\n')).not.toContain('private-fixture');
    expect(h.calls).toHaveLength(1);
  });

  it('clips both native requests to the shared deadline and rejects a late exact response', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const h = harness([{ body: sw(), elapsedMs: 89_000 }, { body: sw(), elapsedMs: 1_001 }], { requiredConsecutive: 1 });
    await expect(waitForServiceWorkerRelease(origin, sha, h.options)).rejects.toThrow('within 90000 ms');
    expect(timeout.mock.calls.map(([ms]) => ms)).toEqual([15_000, 1_000]);
    expect(h.calls.map((call) => call.options.timeoutMs)).toEqual([15_000, 1_000]);
    expect(h.calls).toHaveLength(2);
  });

  it('does not request another profile after the first consumes the deadline', async () => {
    const h = harness([{ body: sw(), elapsedMs: 90_001 }, exact()], { requiredConsecutive: 1 });
    await expect(waitForServiceWorkerRelease(origin, sha, h.options)).rejects.toThrow('within 90000 ms');
    expect(h.calls).toHaveLength(1);
  });

  it('requires byte-identical service worker content in both profiles', async () => {
    const h = harness([sw(), `${sw()}\n// different deployed content`]);
    await expect(waitForServiceWorkerRelease(origin, sha, h.options)).rejects.toThrow('different content');
    expect(h.calls).toHaveLength(2);
  });

  it('rejects malformed expected identities and noncanonical origins before requesting', async () => {
    for (const [url, expectedSha] of [[origin, 'main'], [origin, sha.toUpperCase()], [`${origin}/`, sha], ['http://frigo.example.net', sha]]) {
      const h = harness([]);
      await expect(waitForServiceWorkerRelease(url, expectedSha, h.options)).rejects.toThrow();
      expect(h.calls).toHaveLength(0);
    }
  });
});


describe('native curl service-worker transport', () => {
  it('parses the exact body after interim headers without executing or following it', async () => {
    const controller = new AbortController();
    const output = Buffer.from(`HTTP/2 103 Early Hints\r\nLink: </assets/app.js>\r\n\r\nHTTP/2 200 \r\nContent-Type: text/javascript\r\nCache-Control: no-store\r\n\r\n${sw()}`);
    const execute = vi.fn(async () => ({ stdout: output }));
    const response = await fetchServiceWorkerWithCurl(new URL('/sw.js', origin), {
      signal: controller.signal, timeoutMs: 1_234, headers: { Accept: '*/*' },
    }, execute);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).toBe(sw());
    const [command, args, options] = execute.mock.calls[0];
    expect(command).toBe('curl');
    expect(args[0]).toBe('--disable');
    expect(args).toEqual(['--disable', '--silent', '--show-error', '--suppress-connect-headers', '--proto', '=https',
      '--max-time', '1.234', '--request', 'GET', '--dump-header', '-', '--header', 'Accept: */*', `${origin}/sw.js`]);
    expect(args).not.toContain('--location');
    expect(options.signal).toBe(controller.signal);
    expect(options.encoding).toBe('buffer');
    expect(options.maxBuffer).toBe(320 * 1024);
  });

  it.each(['unparseable', 'HTTP/2 200 \r\nNot-A-Header\r\n\r\nbody'])('fails closed on malformed transport headers', async (stdout) => {
    await expect(fetchServiceWorkerWithCurl(`${origin}/sw.js`, {
      signal: AbortSignal.timeout(1000), timeoutMs: 1000, headers: {},
    }, async () => ({ stdout }))).rejects.toThrow('malformed');
  });
});
