import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types';
import { domainProfile } from '../config/domains';

// Only an explicitly prepared domain deployment enables these host boundaries.
export const publicDomainRouting: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  let profile;
  try {
    profile = domainProfile(c.env);
  } catch {
    c.header('Cache-Control', 'no-store');
    return c.json({ code: 'DOMAIN_CONFIGURATION_INVALID' }, 503);
  }
  if (!profile) return next();

  const url = new URL(c.req.url);
  const apiPath = url.pathname === '/api' || url.pathname.startsWith('/api/');
  const safeRead = c.req.method === 'GET' || c.req.method === 'HEAD';
  const knownApp = url.origin === profile.app;
  const knownApi = url.origin === profile.api;
  const legacy = url.origin === profile.legacy;

  if (url.origin === profile.www) {
    // WWW is navigation-only; API/auth callbacks never redirect here.
    if (!apiPath && safeRead && !url.pathname.startsWith('/.well-known/')) {
      return c.redirect(`${profile.app}${url.pathname}${url.search}`, 308);
    }
    return c.json({ code: 'NOT_FOUND' }, 404);
  } else if (!knownApp && !knownApi && !legacy) {
    return c.json({ code: 'NOT_FOUND' }, 404);
  }

  if (c.env.ENVIRONMENT === 'staging' || knownApi || legacy) c.header('X-Robots-Tag', 'noindex, nofollow');
  // Missing native association files must not become successful SPA HTML responses.
  if (url.pathname === '/.well-known' || url.pathname.startsWith('/.well-known/')) return c.json({ code: 'NOT_FOUND' }, 404);
  if (knownApi && !apiPath) return c.json({ code: 'NOT_FOUND' }, 404);

  if (knownApp && safeRead && url.pathname === '/robots.txt') {
    return c.text(c.env.ENVIRONMENT === 'production'
      ? `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /auth\nDisallow: /account\nSitemap: ${profile.app}/sitemap.xml\n`
      : 'User-agent: *\nDisallow: /\n');
  }
  if (knownApp && safeRead && url.pathname === '/sitemap.xml') {
    c.header('Content-Type', 'application/xml; charset=utf-8');
    return c.body(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${profile.app}/</loc></url></urlset>`);
  }
  await next();

  if (apiPath && c.res.headers.get('Content-Type')?.includes('text/html')) return c.json({ code: 'NOT_FOUND' }, 404);
  if ((knownApp || legacy) && !apiPath && c.res.status === 200 && c.res.headers.get('Content-Type')?.includes('text/html')) {
    // APP_URL comes from the verified environment profile, never forwarded headers.
    const html = (await c.res.text()).replace(/<meta property="og:(image|url)" content="[^"]*"/g, (_tag, key: string) =>
      `<meta property="og:${key}" content="${profile.app}${key === 'image' ? '/takolio/v1/social/og-1200x630.png' : ''}"`);
    const canonical = url.pathname === '/' ? `${profile.app}/` : null;
    const metadata = `${canonical ? `<link rel="canonical" href="${canonical}" />` : ''}` +
      `<meta name="twitter:card" content="summary_large_image" />` +
      `<meta name="twitter:image" content="${profile.app}/takolio/v1/social/og-1200x630.png" />`;
    const headers = new Headers(c.res.headers);
    headers.delete('Content-Length');
    headers.delete('Content-Encoding');
    headers.delete('ETag');
    c.res = new Response(html.replace('</head>', `${metadata}</head>`), { status: c.res.status, headers });
    c.res.headers.delete('ETag');
    c.res.headers.delete('Content-Length');
    c.res.headers.delete('Content-Encoding');
    c.header('Cache-Control', 'no-store');
    // Authenticated and nested application screens are not public SEO landing pages.
    if (url.pathname !== '/') c.header('X-Robots-Tag', 'noindex, nofollow');
  }
};
