import {
  buildRegionalPriceReferences,
  DEFAULT_VND_PRICES,
} from '../shared/global-pricing';

export interface SiteWorkerEnv {
  ASSETS: Fetcher;
  APP_ORIGIN?: string;
  PAYOS_TEST_MONTHLY_PRICE_VND?: string;
}

const MARKETING_ORIGIN = 'https://takolio.com';
const DEFAULT_APP_ORIGIN = 'https://takolio.app';
const PUBLIC_PRICING_CORS_ORIGINS = new Set([
  'https://takolio.com',
  'https://takolio.app',
  'https://staging.takolio.app',
]);

const APP_HANDOFF_PREFIXES = [
  '/auth',
  '/onboarding',
  '/fridge',
  '/inventory',
  '/scan',
  '/cook',
  '/cooking',
  '/planner',
  '/week',
  '/shopping',
  '/notifications',
  '/me',
  '/profile',
  '/settings',
  '/plus',
  '/search',
];

const LOCALE_CONTENT_LANGUAGE: Readonly<Record<string, string>> = {
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  th: 'th',
  zh: 'zh-Hans',
  it: 'it',
};

const COUNTRY_TO_LOCALE: Readonly<Record<string, string>> = {
  VN: 'vi',
  JP: 'ja',
  KR: 'ko',
  TH: 'th',
  CN: 'zh',
  TW: 'zh',
  HK: 'zh',
  SG: 'en',
  IT: 'it',
  US: 'en',
  GB: 'en',
  AU: 'en',
  CA: 'en',
};

const SUPPORTED_LOCALE_CODES = new Set(['vi', 'en', 'ja', 'ko', 'th', 'zh', 'it']);

const BOT_UA_PATTERN =
  /googlebot|bingbot|applebot|yandex|baiduspider|duckduckbot|slurp|gptbot|oai-searchbot|chatgpt-user|perplexitybot|perplexity-user|claudebot|claude-searchbot|claude-user|anthropic-ai|google-extended|meta-externalagent|facebookexternalhit|twitterbot|linkedinbot|zalo/i;

function detectRouteLocale(pathname: string): { locale: string; contentLanguage: string } {
  const match = pathname.match(/^\/([a-z]{2})(?:\/|$)/);
  if (match && match[1] && LOCALE_CONTENT_LANGUAGE[match[1]]) {
    return { locale: match[1], contentLanguage: LOCALE_CONTENT_LANGUAGE[match[1]] };
  }
  return { locale: 'vi', contentLanguage: 'vi-VN' };
}

function suggestLocaleForVisitor(request: Request): string | null {
  const ua = request.headers.get('User-Agent') || '';
  if (BOT_UA_PATTERN.test(ua)) return null;

  const acceptLanguage = request.headers.get('Accept-Language') || '';
  if (acceptLanguage) {
    for (const part of acceptLanguage.split(',')) {
      const primary = part.trim().split(';')[0]?.toLowerCase().split('-')[0];
      if (primary && SUPPORTED_LOCALE_CODES.has(primary)) {
        return primary;
      }
    }
  }

  const cfCountry = (request as Request & { cf?: { country?: string } }).cf?.country?.toUpperCase();
  if (cfCountry && COUNTRY_TO_LOCALE[cfCountry]) {
    return COUNTRY_TO_LOCALE[cfCountry];
  }
  return null;
}

function applyEdgeHeaders(
  response: Response,
  options: {
    cacheControl: string;
    robotsTag: string;
    contentLanguage?: string;
    extraHeaders?: Record<string, string>;
  },
): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', options.cacheControl);
  headers.set('X-Robots-Tag', options.robotsTag);
  headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' https://takolio.app https://api.takolio.app https://cloudflareinsights.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      'upgrade-insecure-requests',
    ].join('; '),
  );
  if (options.contentLanguage) {
    headers.set('Content-Language', options.contentLanguage);
  }
  if (options.extraHeaders) {
    for (const [key, value] of Object.entries(options.extraHeaders)) {
      headers.set(key, value);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function canonicalRedirectResponse(targetUrl: string, status: 302 | 308): Response {
  return applyEdgeHeaders(
    new Response(null, {
      status,
      headers: { Location: targetUrl },
    }),
    {
      cacheControl: status === 308 ? 'public, max-age=3600' : 'no-store',
      robotsTag: 'noindex, nofollow',
    },
  );
}

/**
 * Dedicated Edge Worker for `https://takolio.com` (Public Satellite, Multilingual SEO & GEO Hub).
 * - Single-hop 308 canonicalization for `www.takolio.com`, `/landing`, `/vi` -> `/`, and trailing slashes.
 * - Serves True SSR prerendered multilingual HTML, localized sitemaps, `robots.txt`, `llms*.txt`, and WebP/PNG media.
 * - Proxies read-only `GET /api/v1/public/pricing` (and legacy `/api/v1/billing/plans`) with strict `upstream.ok` caching.
 * - Never auto-redirects crawlers or users by IP; emits non-intrusive `X-Takolio-Suggested-Locale` hint only.
 */
export default {
  async fetch(request: Request, env: SiteWorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const appOrigin = (env.APP_ORIGIN || DEFAULT_APP_ORIGIN).replace(/\/+$/, '');

    // 1. Single-hop canonicalization (www -> apex, /landing -> /, /vi -> /, trailing slash strip)
    const isWww = url.hostname.toLowerCase() === 'www.takolio.com';
    let normalizedPath = url.pathname;
    if (normalizedPath === '/landing' || normalizedPath === '/landing/') {
      normalizedPath = '/';
    } else if (normalizedPath === '/vi' || normalizedPath === '/vi/') {
      normalizedPath = '/';
    } else if (normalizedPath.startsWith('/vi/')) {
      normalizedPath = normalizedPath.slice(3) || '/';
    }
    if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
      normalizedPath = normalizedPath.replace(/\/+$/, '');
    }
    if (isWww || normalizedPath !== url.pathname) {
      const canonical = new URL(url.toString());
      canonical.hostname = 'takolio.com';
      canonical.pathname = normalizedPath;
      return canonicalRedirectResponse(canonical.toString(), 308);
    }

    // 2. Public read-only Edge Pricing Catalog (eliminates unauthenticated 401 on /pricing without relaxing app auth)
    if (
      (url.pathname === '/api/v1/public/pricing' || url.pathname === '/api/v1/billing/plans') &&
      (request.method === 'GET' || request.method === 'OPTIONS')
    ) {
      const origin = request.headers.get('Origin') || '';
      const corsHeaders: Record<string, string> = {};
      if (PUBLIC_PRICING_CORS_ORIGINS.has(origin)) {
        corsHeaders['Access-Control-Allow-Origin'] = origin;
        corsHeaders['Access-Control-Allow-Methods'] = 'GET, OPTIONS';
        corsHeaders.Vary = 'Origin';
      }
      if (request.method === 'OPTIONS') {
        return applyEdgeHeaders(new Response(null, { status: 204 }), {
          cacheControl: 'public, max-age=3600',
          robotsTag: 'noindex, nofollow',
          extraHeaders: corsHeaders,
        });
      }
      const monthlyVnd =
        env.PAYOS_TEST_MONTHLY_PRICE_VND === '2000' ? 2000 : DEFAULT_VND_PRICES.monthly;
      const annualVnd = DEFAULT_VND_PRICES.annual;
      const payload = {
        brandTierName: 'Takolio Pro',
        baseCurrency: 'VND',
        plans: [
          { plan: 'monthly', amountVnd: monthlyVnd, currency: 'VND' },
          { plan: 'annual', amountVnd: annualVnd, currency: 'VND' },
        ],
        regionalCatalog: buildRegionalPriceReferences({
          monthly: monthlyVnd,
          annual: annualVnd,
        }),
        checkoutSettlement: {
          liveProviders: ['VietQR (VND)'],
          internationalReferenceNote:
            'Displayed non-VND amounts are indicative reference equivalents. Live checkout settles in VND via VietQR until global card billing launches.',
        },
      };
      return applyEdgeHeaders(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }),
        {
          cacheControl: 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
          robotsTag: 'noindex, nofollow',
          extraHeaders: corsHeaders,
        },
      );
    }

    // 3. Hand off interactive app routes directly to `https://takolio.app`
    if (
      APP_HANDOFF_PREFIXES.some(
        (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
      )
    ) {
      return canonicalRedirectResponse(`${appOrigin}${url.pathname}${url.search}`, 302);
    }

    // 4. Immutable hashed JS/CSS bundles & static self-hosted fonts (strictly guarded by `res.ok`)
    if (
      url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/takolio/fonts/') ||
      url.pathname.startsWith('/takolio/v1/fonts/')
    ) {
      const assetRes = await env.ASSETS.fetch(request);
      if (!assetRes.ok) {
        return applyEdgeHeaders(assetRes, {
          cacheControl: 'no-store',
          robotsTag: 'noindex, nofollow',
        });
      }
      return applyEdgeHeaders(assetRes, {
        cacheControl: 'public, max-age=31536000, immutable',
        robotsTag: 'index, follow',
      });
    }

    if (url.pathname.startsWith('/takolio/') || url.pathname.startsWith('/frigo/recipes/')) {
      const mediaRes = await env.ASSETS.fetch(request);
      if (!mediaRes.ok) {
        return applyEdgeHeaders(mediaRes, {
          cacheControl: 'no-store',
          robotsTag: 'noindex, nofollow',
        });
      }
      return applyEdgeHeaders(mediaRes, {
        cacheControl: 'public, max-age=86400, s-maxage=604800',
        robotsTag: 'index, follow, max-image-preview:large',
      });
    }

    // 5. SEO & GEO Discovery Documents (`robots.txt`, `sitemap*.xml`, `llms*.txt`)
    const isDiscoveryDoc =
      url.pathname === '/robots.txt' ||
      url.pathname === '/sitemap.xml' ||
      /^\/sitemap-[a-z0-9-]+\.xml$/i.test(url.pathname) ||
      url.pathname === '/llms.txt' ||
      url.pathname === '/llms-full.txt' ||
      /^\/llms-[a-z]{2}(?:-[a-z0-9]+)?\.txt$/i.test(url.pathname);

    if (isDiscoveryDoc) {
      const docRes = await env.ASSETS.fetch(request);
      if (!docRes.ok) {
        return applyEdgeHeaders(docRes, {
          cacheControl: 'no-store',
          robotsTag: 'noindex, nofollow',
        });
      }
      return applyEdgeHeaders(docRes, {
        cacheControl: 'public, max-age=300, s-maxage=3600',
        robotsTag: 'index, follow',
      });
    }

    // 6. Pre-rendered Satellite HTML Routes (including `/recipes` & localized `/en/*`, `/ja/*`, etc.)
    const pageRes = await env.ASSETS.fetch(request);
    if (pageRes.status >= 300 && pageRes.status < 400) {
      return applyEdgeHeaders(pageRes, {
        cacheControl: 'public, max-age=300',
        robotsTag: 'noindex, nofollow',
      });
    }
    if (pageRes.ok) {
      const { locale, contentLanguage } = detectRouteLocale(url.pathname);
      const suggestedLocale = suggestLocaleForVisitor(request);
      const extraHeaders: Record<string, string> = {
        Link: `<${MARKETING_ORIGIN}/llms.txt>; rel="alternate"; type="text/plain"`,
      };
      if (suggestedLocale && suggestedLocale !== locale) {
        extraHeaders['X-Takolio-Suggested-Locale'] = suggestedLocale;
      }
      return applyEdgeHeaders(pageRes, {
        cacheControl: 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
        robotsTag: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
        contentLanguage,
        extraHeaders,
      });
    }

    // Fallback: if `/recipes*` static directory is not yet emitted, hand off gracefully to app
    if (url.pathname === '/recipes' || url.pathname.startsWith('/recipes/')) {
      return canonicalRedirectResponse(`${appOrigin}${url.pathname}${url.search}`, 302);
    }

    // 7. 404 Not Found (`dist/site/404.html` served with HTTP 404 and noindex)
    return applyEdgeHeaders(pageRes, {
      cacheControl: 'no-store',
      robotsTag: 'noindex, nofollow',
    });
  },
};
