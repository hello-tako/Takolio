import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

const source = readFileSync('public/sw.js', 'utf8');
const origin = 'https://takolio.app';
const response = (type, body = 'asset', status = 200) => new Response(body, {
  status, headers: type ? { 'Content-Type': type } : {},
});

function harness(path, cached, network) {
  const request = { url: `${origin}${path}`, method: 'GET', mode: 'cors' };
  const entries = new Map(cached ? [[request.url, cached]] : []);
  const listeners = new Map();
  const fetch = vi.fn(network);
  const put = vi.fn(async (key, value) => entries.set(key.url, value));
  runInNewContext(source, {
    self: { location: { origin }, addEventListener: (name, handler) => listeners.set(name, handler) },
    caches: { match: async (key) => entries.get(key.url)?.clone(), open: async () => ({ put }) },
    URL, console, fetch,
  });
  const load = (overrides = {}) => {
    let result;
    listeners.get('fetch')({ request: { ...request, ...overrides }, respondWith: (value) => { result = value; } });
    return result;
  };
  return { load, entries, fetch, put, request };
}

it.each([
  ['/assets/RecipesPage.js', 'text/javascript; charset=utf-8'],
  ['/assets/planner.mjs', 'application/javascript'],
  ['/assets/index.css', 'text/css; charset=utf-8'],
])('repairs cached SPA HTML at %s without clearing user data', async (path, type) => {
  const h = harness(path, response('text/html', '<html>OFF shell</html>'), async () => response(type, 'valid code'));
  expect(await (await h.load()).text()).toBe('valid code');
  expect(h.put).toHaveBeenCalledOnce();
  expect(await (await h.load()).text()).toBe('valid code');
  expect(h.fetch).toHaveBeenCalledOnce();
  expect(h.put.mock.calls[0][0]).toEqual(h.request);
});

it.each(['text/html', '', 'application/json', 'text/javascript-invalid'])('does not retain %s as a missing JavaScript chunk', async (type) => {
  let restored = false;
  const h = harness('/assets/missing.js', null, async () => restored
    ? response('text/javascript', 'restored') : response(type, 'OFF shell'));
  await h.load();
  expect(h.put).not.toHaveBeenCalled();
  restored = true;
  expect(await (await h.load()).text()).toBe('restored');
  expect(h.fetch).toHaveBeenCalledTimes(2);
  expect(h.put).toHaveBeenCalledOnce();
});

it('keeps valid cached code available offline; rejects poisoned cached code offline', async () => {
  const offline = async () => { throw new Error('offline'); };
  const good = harness('/assets/app.js', response('application/javascript', 'cached code'), offline);
  expect(await (await good.load()).text()).toBe('cached code');
  expect(good.fetch).not.toHaveBeenCalled();
  const bad = harness('/assets/app.js', response('text/html'), offline);
  await expect(bad.load()).rejects.toThrow('offline');
  expect(bad.put).not.toHaveBeenCalled();
});

it('preserves non-code cache behavior; never caches an unsuccessful code response', async () => {
  const image = harness('/takolio/mascot.webp', response('image/webp', 'image'), async () => { throw new Error('offline'); });
  expect(await (await image.load()).text()).toBe('image');
  expect(image.fetch).not.toHaveBeenCalled();
  const missing = harness('/assets/app.js', null, async () => response('text/javascript', 'missing', 404));
  expect((await missing.load()).status).toBe(404);
  expect(missing.put).not.toHaveBeenCalled();
});

it('leaves third-party scripts and non-GET requests outside the service worker', () => {
  const h = harness('/assets/app.js', null, async () => response('text/javascript'));
  expect(h.load({ url: 'https://accounts.google.com/gsi/client' })).toBeUndefined();
  expect(h.load({ method: 'POST' })).toBeUndefined();
  expect(h.fetch).not.toHaveBeenCalled();
});
