import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import siteWorker from '../../src/site/site-worker';
import { fetchWorker } from '../helpers/worker-fetch.mjs';
import { DOMAIN_PROFILES } from '../../src/worker/config/domains';
import { buildLocalizedOtpEmail } from '../../src/shared/localized-email-templates';
import {
  buildHreflangCluster,
  buildLocalizedPath,
  parseLocaleFromPathname,
  SUPPORTED_LOCALES,
} from '../../src/shared/locales';
import { buildRegionalPriceReferences, formatGlobalMinorCurrency } from '../../src/shared/global-pricing';
import { convertStepTemperatures, formatDisplayQuantity } from '../../packages/domain/src/unit-conversion';
import { getScanLocalePromptDirectives } from '../../packages/ai/src/locale-prompt';
import {
  loadFull500SiteRecipeCatalog,
  renderSiteRoute,
  resolveRouteMeta,
  toRecipeIndexEntry,
} from '../../site/entry-server';

const REPO_ROOT = path.resolve(__dirname, '../..');
const DIST_SITE = path.join(REPO_ROOT, 'dist/site');

describe('Phase P0–P3: Public Pricing, Edge Workers & Multi-Domain Hygiene', () => {
  const appEnv = {
    ENVIRONMENT: 'production',
    APP_URL: DOMAIN_PROFILES.production.app,
    PUBLIC_DOMAIN_ROUTING: 'true',
    DB: {},
    CACHE: {},
    AI: {},
    SCAN_QUEUE: {},
    QWEN_API_KEY: 'fixture',
    JWT_SECRET: 'fixture-secret-at-least-32-chars-long',
    OTP_HASH_SECRET: 'fixture',
    TURNSTILE_SITE_KEY: 'fixture',
    TURNSTILE_SECRET_KEY: 'fixture',
    ASSETS: {
      fetch: async () =>
        new Response('<html><head><meta property="og:image" content="https://frigo.tungjpstore.net/takolio/v1/social/og-1200x630.png"></head><body>Takolio</body></html>', {
          headers: { 'Content-Type': 'text/html' },
        }),
    },
  };

  it('serves unauthenticated public read-only edge pricing on takolio.com while keeping takolio.app billing auth-gated', async () => {
    const mockAssets = { fetch: vi.fn(async () => new Response('ok')) };
    const res = await siteWorker.fetch(
      new Request('https://takolio.com/api/v1/public/pricing', {
        headers: { Origin: 'https://takolio.app' },
      }),
      { ASSETS: mockAssets as never },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://takolio.app');
    const body = (await res.json()) as {
      brandTierName: string;
      plans: Array<{ plan: string; amountVnd: number; currency: string }>;
      regionalCatalog: Array<{ currency: string; checkoutMode: string }>;
    };
    expect(body.brandTierName).toBe('Takolio Pro');
    expect(body.plans).toEqual([
      { plan: 'monthly', amountVnd: 49000, currency: 'VND' },
      { plan: 'annual', amountVnd: 499000, currency: 'VND' },
    ]);
    expect(body.regionalCatalog.length).toBe(9);
    expect(body.regionalCatalog.find((c) => c.currency === 'VND')?.checkoutMode).toBe('live_vietqr');
    expect(body.regionalCatalog.find((c) => c.currency === 'USD')?.checkoutMode).toBe('live_dodo_mor');

    // Legacy /api/v1/billing/plans on takolio.com also returns 200 public read-only catalog
    const aliasRes = await siteWorker.fetch(
      new Request('https://takolio.com/api/v1/billing/plans'),
      { ASSETS: mockAssets as never },
    );
    expect(aliasRes.status).toBe(200);
  });

  it('preserves strict noindex boundary on non-root takolio.app routes without breaking frozen app middleware', async () => {
    for (const nestedPath of ['/pricing', '/faq', '/en/recipes']) {
      const res = await fetchWorker(new Request(`https://takolio.app${nestedPath}`), appEnv as never);
      expect(res.status).toBe(200);
      expect(res.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');
    }
  });

  it('enforces single-hop 308 canonicalization, HSTS, safe 404 caching, and bot-safe locale hints in site-worker', async () => {
    const mockAssets = {
      fetch: vi.fn(async (req: Request) => {
        const u = new URL(req.url);
        if (u.pathname === '/assets/missing.js') return new Response('Not found', { status: 404 });
        if (u.pathname === '/takolio/v1/fonts/plus-jakarta-sans-vietnamese-latin-wght.woff2') {
          return new Response('font-bytes', { status: 200, headers: { 'Content-Type': 'font/woff2' } });
        }
        return new Response('<!doctype html><html><body>ok</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });
      }),
    };

    // Single-hop www + /landing/ -> https://takolio.com/
    const hop = await siteWorker.fetch(
      new Request('https://www.takolio.com/landing/'),
      { ASSETS: mockAssets as never },
    );
    expect(hop.status).toBe(308);
    expect(hop.headers.get('Location')).toBe('https://takolio.com/');
    expect(hop.headers.get('Strict-Transport-Security')).toContain('max-age=63072000');

    // /vi/pricing/ -> single-hop 308 -> https://takolio.com/pricing
    const viNorm = await siteWorker.fetch(
      new Request('https://takolio.com/vi/pricing/'),
      { ASSETS: mockAssets as never },
    );
    expect(viNorm.status).toBe(308);
    expect(viNorm.headers.get('Location')).toBe('https://takolio.com/pricing');

    // 404 under /assets/* is NEVER cached immutable or indexed
    const missingAsset = await siteWorker.fetch(
      new Request('https://takolio.com/assets/missing.js'),
      { ASSETS: mockAssets as never },
    );
    expect(missingAsset.status).toBe(404);
    expect(missingAsset.headers.get('Cache-Control')).toBe('no-store');
    expect(missingAsset.headers.get('X-Robots-Tag')).toBe('noindex, nofollow');

    // /takolio/v1/fonts/* gets immutable caching
    const fontRes = await siteWorker.fetch(
      new Request('https://takolio.com/takolio/v1/fonts/plus-jakarta-sans-vietnamese-latin-wght.woff2'),
      { ASSETS: mockAssets as never },
    );
    expect(fontRes.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');

    // Bot visits /en -> gets Content-Language: en, Link llms.txt, NO X-Takolio-Suggested-Locale
    const botRes = await siteWorker.fetch(
      new Request('https://takolio.com/en', {
        headers: { 'User-Agent': 'Googlebot/2.1', 'Accept-Language': 'ja-JP,ja;q=0.9' },
      }),
      { ASSETS: mockAssets as never },
    );
    expect(botRes.status).toBe(200);
    expect(botRes.headers.get('Content-Language')).toBe('en');
    expect(botRes.headers.get('Link')).toContain('/llms.txt');
    expect(botRes.headers.get('X-Takolio-Suggested-Locale')).toBeNull();

    // Human visitor with Japanese Accept-Language visiting /en gets non-intrusive locale hint (never auto-redirect)
    const humanRes = await siteWorker.fetch(
      new Request('https://takolio.com/en', {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'Accept-Language': 'ja-JP,ja;q=0.9',
        },
      }),
      { ASSETS: mockAssets as never },
    );
    expect(humanRes.status).toBe(200);
    expect(humanRes.headers.get('X-Takolio-Suggested-Locale')).toBe('ja');
  });

  it('keeps robots.txt RFC 9309 compliant and llms*.txt unified on Bé Mầm Bếp without internal codes', () => {
    const robots = readFileSync(path.join(REPO_ROOT, 'public/robots.txt'), 'utf8');
    expect(robots).toContain('User-agent: Claude-SearchBot');
    expect(robots).toContain('User-agent: Perplexity-User');
    expect(robots).not.toContain('Allow: /landing');

    const llms = readFileSync(path.join(REPO_ROOT, 'public/llms.txt'), 'utf8');
    const llmsFull = readFileSync(path.join(REPO_ROOT, 'public/llms-full.txt'), 'utf8');
    expect(llms).toContain('Bé Mầm Bếp');
    expect(llms).not.toContain('/landing');
    expect(llmsFull).toContain('Bé Mầm Bếp');
    expect(llmsFull).not.toMatch(/Bạch Tuộc|Tako\b|\(C03\)|\(C20\)|\(M09\)/i);
  });
});

describe('Phase P1–P3: True SSR Output, 500 Global Recipes, Sitemaps, Unit Conversion & i18n', () => {
  it('renders True React SSR HTML, bidirectional 7-locale metadata, FAQ parity, and standalone Stories in-process (and verifies dist/site when built)', () => {
    // In-process True React SSR verification (works cleanly on fresh CI checkouts before build:site)
    const viLandingHtml = renderSiteRoute('/', { locale: 'vi' });
    expect(viLandingHtml).toContain('Bữa ngon,');
    expect(viLandingHtml).toContain('nhẹ đầu.');

    const enFaqHtml = renderSiteRoute('/en/faq', { locale: 'en' });
    const faqMainMatch = enFaqHtml.match(/<main\b[^>]*>([\s\S]*?)<\/main>/);
    expect(faqMainMatch).toBeTruthy();
    expect((faqMainMatch?.[1].match(/<details\b/g) || []).length).toBe(6);

    const enFaqMeta = resolveRouteMeta('en', '/faq');
    expect(JSON.stringify(enFaqMeta.jsonLd)).toContain('"@type":"FAQPage"');

    const storyMeta = resolveRouteMeta('en', '/stories/5-mon-nhanh-toi-ban-ron');
    expect(JSON.stringify(storyMeta.jsonLd)).toContain('"@type":"Article"');
    expect(JSON.stringify(storyMeta.jsonLd)).toContain('"@type":"HowTo"');

    const notFoundMeta = resolveRouteMeta('vi', '/404');
    expect(notFoundMeta.noindex).toBe(true);
    expect(notFoundMeta.jsonLd).toBeNull();

    // Physical dist/site prerender verification when build:site has run
    if (existsSync(path.join(DIST_SITE, 'index.html'))) {
      const viHome = readFileSync(path.join(DIST_SITE, 'index.html'), 'utf8');
      expect(viHome).toContain('<html lang="vi" dir="ltr">');
      expect(viHome).toContain('hreflang="vi-VN" href="https://takolio.com/"');
      expect(viHome).toContain('hreflang="en" href="https://takolio.com/en"');
      expect(viHome).toContain('hreflang="ja" href="https://takolio.com/ja"');
      expect(viHome).toContain('hreflang="x-default" href="https://takolio.com/en"');
      expect(viHome).toContain('og:image:type" content="image/png"');
      expect(viHome).toContain('twitter:image:alt');
      expect(viHome).toContain('https://takolio.com/recipes?q={search_term_string}');

      for (const [loc, expectedLang] of [
        ['en', 'en'],
        ['ja', 'ja'],
        ['ko', 'ko'],
        ['th', 'th'],
        ['zh', 'zh-Hans'],
        ['it', 'it'],
      ]) {
        const html = readFileSync(path.join(DIST_SITE, loc, 'index.html'), 'utf8');
        expect(html).toContain(`<html lang="${expectedLang}" dir="ltr">`);
        expect(html).toContain(`rel="canonical" href="https://takolio.com/${loc}"`);
      }

      const notFoundHtml = readFileSync(path.join(DIST_SITE, '404.html'), 'utf8');
      expect(notFoundHtml).toContain('noindex, nofollow');
      expect(notFoundHtml).not.toContain('rel="canonical"');
      expect(notFoundHtml).not.toContain('hreflang=');

      // Unused 19.9 MB PNG master archive excluded from dist/site
      expect(existsSync(path.join(DIST_SITE, 'takolio/brand-v2/masters'))).toBe(false);
    }
  });

  it('loads all 500 verified global recipes with accurate per-cuisine JSON-LD & verifies partitioned same-domain sitemaps', () => {
    const catalog = loadFull500SiteRecipeCatalog(REPO_ROOT);
    expect(catalog.length).toBe(500);
    const cuisineCounts: Record<string, number> = {};
    for (const r of catalog) {
      cuisineCounts[r.cuisine] = (cuisineCounts[r.cuisine] ?? 0) + 1;
    }
    expect(cuisineCounts).toEqual({
      vietnamese: 202,
      chinese: 73,
      japanese: 57,
      korean: 57,
      thai: 56,
      italian: 55,
    });

    // Japanese recipe gets accurate recipeCuisine: "Japanese" (never hardcoded Vietnamese)
    const oyakodon = catalog.find((r) => r.slug === 'oyakodon');
    expect(oyakodon).toBeDefined();
    const oyakodonMeta = resolveRouteMeta('en', '/recipes/oyakodon', oyakodon);
    expect(JSON.stringify(oyakodonMeta.jsonLd)).toContain('"@type":"Recipe"');
    expect(JSON.stringify(oyakodonMeta.jsonLd)).toContain('"recipeCuisine":"Japanese"');
    const oyakodonSsr = renderSiteRoute('/en/recipes/oyakodon', {
      locale: 'en',
      recipe: oyakodon,
      relatedRecipes: catalog.slice(0, 4).map(toRecipeIndexEntry),
    });
    expect(oyakodonSsr).toContain('Japanese Chicken');

    if (existsSync(path.join(DIST_SITE, 'sitemap.xml'))) {
      const index = JSON.parse(readFileSync(path.join(DIST_SITE, 'recipes-index.json'), 'utf8')) as {
        total: number;
      };
      expect(index.total).toBe(500);

      for (const file of [
        'sitemap.xml',
        'sitemap-pages.xml',
        'sitemap-stories.xml',
        'sitemap-recipes-vi.xml',
        'sitemap-recipes-en.xml',
      ]) {
        const xml = readFileSync(path.join(DIST_SITE, file), 'utf8');
        expect(xml).not.toContain('https://takolio.app');
        if (file !== 'sitemap.xml') {
          expect(xml).toContain('xhtml:link rel="alternate"');
        }
      }
    }
  });

  it('supports deterministic metric/imperial conversion, multi-currency formatting, OTP localization, and AI prompt locales', () => {
    expect(formatDisplayQuantity(500, 'g', 'imperial', 'en').unit).toBe('lb');
    expect(formatDisplayQuantity(250, 'ml', 'imperial', 'en').unit).toBe('cup');
    expect(formatDisplayQuantity(1500, 'g', 'metric', 'vi').text).toBe('1.5 kg');
    expect(convertStepTemperatures('Nướng ở 180°C và bảo quản ở 4°C.', 'imperial')).toBe(
      'Nướng ở 356°F và bảo quản ở 39°F.',
    );

    const refs = buildRegionalPriceReferences({ monthly: 49000, annual: 499000 });
    expect(refs.length).toBe(9);
    expect(formatGlobalMinorCurrency(299, 'USD', 2, 'en-US')).toContain('2.99');

    expect(buildLocalizedPath('vi', '/pricing')).toBe('/pricing');
    expect(buildLocalizedPath('ja', '/pricing')).toBe('/ja/pricing');
    expect(parseLocaleFromPathname('/ko/recipes/oyakodon')).toEqual({
      locale: 'ko',
      barePath: '/recipes/oyakodon',
    });
    expect(buildHreflangCluster('https://takolio.com', '/faq')).toHaveLength(SUPPORTED_LOCALES.length + 1);

    const viOtp = buildLocalizedOtpEmail('123456', 'verify', 'vi');
    const enOtp = buildLocalizedOtpEmail('123456', 'verify', 'en');
    expect(viOtp.subject).toContain('123456');
    expect(viOtp.lang).toBe('vi');
    expect(enOtp.subject).toContain('123456');
    expect(enOtp.lang).toBe('en');

    // Proposed D1 global recipe translation migration DDL exists cleanly outside frozen ledger
    const proposedSql = readFileSync(
      path.join(REPO_ROOT, 'docs/migrations/proposed/0048_recipe_translations_global.sql'),
      'utf8',
    );
    expect(proposedSql).toContain('CREATE TABLE IF NOT EXISTS recipe_localized_content');

    for (const loc of SUPPORTED_LOCALES) {
      expect(getScanLocalePromptDirectives(loc).locale).toBe(loc);
    }
  });
});
