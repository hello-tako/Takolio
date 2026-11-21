export interface SiteWorkerEnv {
  ASSETS: Fetcher;
  APP_ORIGIN?: string;
}

const DEFAULT_APP_ORIGIN = 'https://takolio.app';

const APP_HANDOFF_PREFIXES = [
  '/auth',
  '/onboarding',
  '/fridge',
  '/inventory',
  '/scan',
  '/recipes',
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
];

function applyEdgeHeaders(
  response: Response,
  options: { cacheControl: string; robotsTag: string },
): Response {
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', options.cacheControl);
  headers.set('X-Robots-Tag', options.robotsTag);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' https://takolio.app https://api.takolio.app",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
    ].join('; '),
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Dedicated Edge Worker for `https://takolio.com` (Public Satellite, SEO & GEO Hub).
 * - Consolidates `www.takolio.com` -> `https://takolio.com` (308) and `/landing` -> `/` (308).
 * - Serves pre-rendered HTML snapshots, `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, and WebP media.
 * - Proxies read-only `GET /api/v1/billing/plans` with 300s edge caching so `/pricing` renders live VND plans.
 * - Redirects interactive application routes (`/auth`, `/fridge`, `/recipes/*`, etc.) to `https://takolio.app`.
 */
export default {
  async fetch(request: Request, env: SiteWorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const appOrigin = (env.APP_ORIGIN || DEFAULT_APP_ORIGIN).replace(/\/+$/, '');

    // 1. Canonicalize www.takolio.com -> takolio.com
    if (url.hostname.toLowerCase() === 'www.takolio.com') {
      url.hostname = 'takolio.com';
      return Response.redirect(url.toString(), 308);
    }

    // 2. Consolidate /landing -> / on the satellite domain
    if (url.pathname === '/landing' || url.pathname === '/landing/') {
      url.pathname = '/';
      return Response.redirect(url.toString(), 308);
    }

    // 3. Read-only Edge Proxy for `/api/v1/billing/plans` (M09 server-truth pricing)
    if (url.pathname === '/api/v1/billing/plans' && request.method === 'GET') {
      const upstream = await fetch(`${appOrigin}/api/v1/billing/plans`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      return applyEdgeHeaders(upstream, {
        cacheControl: 'public, max-age=60, s-maxage=300, stale-while-revalidate=600',
        robotsTag: 'noindex, nofollow',
      });
    }

    // 4. Hand off interactive app routes directly to `https://takolio.app`
    if (
      APP_HANDOFF_PREFIXES.some(
        (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`),
      )
    ) {
      return Response.redirect(`${appOrigin}${url.pathname}${url.search}`, 302);
    }

    // 5. Immutable hashed JS/CSS bundles & static fonts/media
    if (
      url.pathname.startsWith('/assets/') ||
      url.pathname.startsWith('/takolio/fonts/')
    ) {
      const assetRes = await env.ASSETS.fetch(request);
      return applyEdgeHeaders(assetRes, {
        cacheControl: 'public, max-age=31536000, immutable',
        robotsTag: 'index, follow',
      });
    }

    if (url.pathname.startsWith('/takolio/')) {
      const mediaRes = await env.ASSETS.fetch(request);
      return applyEdgeHeaders(mediaRes, {
        cacheControl: 'public, max-age=86400, s-maxage=604800',
        robotsTag: 'index, follow, max-image-preview:large',
      });
    }

    // 6. SEO & GEO Discovery Documents (`robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`)
    if (
      url.pathname === '/robots.txt' ||
      url.pathname === '/sitemap.xml' ||
      url.pathname === '/llms.txt' ||
      url.pathname === '/llms-full.txt'
    ) {
      const docRes = await env.ASSETS.fetch(request);
      return applyEdgeHeaders(docRes, {
        cacheControl: 'public, max-age=300, s-maxage=3600',
        robotsTag: 'index, follow',
      });
    }

    // 7. Pre-rendered Satellite HTML Routes
    const cleanPath = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : '/';
    const htmlLookupUrl = new URL(
      cleanPath === '/' ? '/index.html' : `${cleanPath}/index.html`,
      url.origin,
    );
    const pageRes = await env.ASSETS.fetch(new Request(htmlLookupUrl.toString(), request));
    if (pageRes.ok) {
      return applyEdgeHeaders(pageRes, {
        cacheControl: 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
        robotsTag: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
      });
    }

    // 8. 404 Not Found with proper HTTP 404 status and noindex
    const notFoundUrl = new URL('/404.html', url.origin);
    const fallbackRes = await env.ASSETS.fetch(new Request(notFoundUrl.toString(), request));
    const status = fallbackRes.ok ? 404 : pageRes.status;
    return applyEdgeHeaders(
      new Response(fallbackRes.ok ? fallbackRes.body : pageRes.body, {
        status,
        headers: fallbackRes.ok ? fallbackRes.headers : pageRes.headers,
      }),
      {
        cacheControl: 'no-store',
        robotsTag: 'noindex, nofollow',
      },
    );
  },
};
