import { describe, expect, it } from 'vitest';
import worker from '../../src/worker/index';
import { DOMAIN_PROFILES, domainProfile } from '../../src/worker/config/domains';

const base = {
  ENVIRONMENT: 'production', APP_URL: DOMAIN_PROFILES.production.app, PUBLIC_DOMAIN_ROUTING: 'true',
  DB: {}, CACHE: {}, AI: {}, SCAN_QUEUE: {}, QWEN_API_KEY: 'fixture-only',
  JWT_SECRET: 'fixture-only', OTP_HASH_SECRET: 'fixture-only', TURNSTILE_SITE_KEY: 'fixture', TURNSTILE_SECRET_KEY: 'fixture',
  ASSETS: { fetch: async () => new Response('<html><head><meta property="og:url" content="https://frigo.tungjpstore.net"></head><body>Takolio</body></html>', { headers: { 'Content-Type': 'text/html', ETag: 'old-etag' } }) },
};
const probe = (path = '/', options = {}, env = base) => worker.fetch(new Request(path.startsWith('https:') ? path : `${env.APP_URL || 'https://takolio.app'}${path}`, options), env);

describe('domain integration boundaries', () => {
  it('keeps domain activation explicit and configuration fail-closed', async () => {
    expect(domainProfile({})).toBeNull();
    for (const overrides of [
      { ENVIRONMENT: 'staging' }, { APP_URL: 'https://takolio.app/' }, { APP_URL: 'https://takolio.app.evil.test' },
      { ENVIRONMENT: '__proto__', APP_URL: undefined }, { PUBLIC_DOMAIN_ROUTING: 'TRUE' },
    ]) {
      const response = await probe('/', {}, { ...base, ...overrides });
      expect(response.status).toBe(503);
    }
  });

  it('serves the SPA and canonical metadata on apex and preserves security headers', async () => {
    const response = await probe('/');
    const html = await response.text();
    expect(response.status).toBe(200);
    expect(html).toContain('rel="canonical" href="https://takolio.app/"');
    expect(html).toContain('name="twitter:card"');
    expect(html).not.toContain('frigo.tungjpstore.net');
    expect(response.headers.get('ETag')).toBeNull();
    expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=31536000');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('keeps nested SPA refresh working while excluding private screens from indexing', async () => {
    const response = await probe('/recipes/fixture');
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(await response.text()).not.toContain('rel="canonical"');
  });

  it('redirects WWW document paths preserving query and encoded path', async () => {
    for (const origin of ['https://www.takolio.app']) {
      const response = await probe(`${origin}/recipes/a%2Fb?x=1&next=https://evil.test`);
      expect(response.status).toBe(308);
      expect(response.headers.get('Location')).toBe('https://takolio.app/recipes/a%2Fb?x=1&next=https://evil.test');
    }
  });

  it('ignores forged forwarding and host headers when constructing a redirect', async () => {
    const response = await probe('https://www.takolio.app//evil.test/route?q=1', {
      headers: { Host: 'evil.test', 'X-Forwarded-Host': 'evil.test', Origin: 'https://evil.test' },
    });
    expect(response.headers.get('Location')).toBe('https://takolio.app//evil.test/route?q=1');
  });

  it('never redirects WWW API callbacks or mutating requests', async () => {
    for (const path of ['/api/v1/auth/google', '/api/v1/billing/payos/webhook', '/auth']) {
      const response = await probe(`https://www.takolio.app${path}`, { method: 'POST' });
      expect(response.status).toBe(404);
      expect(response.headers.has('Location')).toBe(false);
    }
    expect((await probe('https://www.takolio.app/api/v1/health')).status).toBe(404);
  });

  it('preserves old app sessions and API URLs without redirecting a webhook', async () => {
    const legacy = await probe('https://frigo.tungjpstore.net/plus');
    expect(legacy.status).toBe(200);
    expect(legacy.headers.has('Location')).toBe(false);
    expect(legacy.headers.get('Strict-Transport-Security')).toBe('max-age=63072000; includeSubDomains; preload');
    expect(legacy.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    const response = await probe('https://frigo.tungjpstore.net/api/v1/billing/payos/webhook', { method: 'POST' });
    expect(response.status).toBe(503);
    expect(response.headers.has('Location')).toBe(false);
    expect((await probe('https://frigo.tungjpstore.net/api/v1/health')).status).toBe(200);
  });

  it('serves API aliases and rejects static assets, SPA, native associations and Admin', async () => {
    expect((await probe('https://api.takolio.app/api/v1/health')).status).toBe(200);
    for (const path of ['https://api.takolio.app/', 'https://api.takolio.app/assets/fixture.js',
      'https://admin.takolio.app/', '/.well-known/assetlinks.json', '/.well-known/apple-app-site-association']) {
      const response = await probe(path);
      expect(response.status).toBe(404);
      expect(response.headers.get('Content-Type')).not.toContain('text/html');
    }
    expect((await probe('/api/v1/unknown')).status).toBe(401);
  });

  it('allows credentials only from apex with correct cache variation', async () => {
    for (const origin of ['https://takolio.app', 'https://frigo.tungjpstore.net', 'https://staging.takolio.app', 'https://evil.test', 'null']) {
      const response = await probe('https://api.takolio.app/api/v1/inventory', {
        method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'Idempotency-Key,X-Frigo-Expected-User-Id' },
      });
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe([base.APP_URL, DOMAIN_PROFILES.production.legacy].includes(origin) ? origin : null);
      expect(response.headers.get('Vary')).toContain('Origin');
      expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe('*');
    }
  });

  it('isolates staging URLs and provides noindex even for static assets', async () => {
    const staging = { ...base, ENVIRONMENT: 'staging', APP_URL: DOMAIN_PROFILES.staging.app };
    const response = await probe('/', {}, staging);
    expect(response.status).toBe(200);
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    expect(await response.text()).toContain('https://staging.takolio.app');
    expect((await probe('https://takolio.app/', {}, staging)).status).toBe(404);
    const preflight = await probe('https://api-staging.takolio.app/api/v1/health', { method: 'OPTIONS', headers: { Origin: 'https://takolio.app' } }, staging);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBeNull();
    const robots = await probe('/robots.txt', {}, staging);
    expect(await robots.text()).toBe('User-agent: *\nDisallow: /\n');
  });

  it('serves only a public landing URL in the production sitemap', async () => {
    const response = await probe('/sitemap.xml');
    expect(response.headers.get('Content-Type')).toContain('application/xml');
    expect(await response.text()).toContain('<loc>https://takolio.app/</loc>');
    expect(await (await probe('/robots.txt')).text()).toContain('Disallow: /api/');
  });
});
