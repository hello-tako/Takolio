import type { ReactElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { matchPath, StaticRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/web/stores/useAuthStore', () => ({ useAuthStore: () => ({ avatarUrl: null }) }));
import { AppLayout, isKitchenSurface } from '../../src/web/components/layout/AppLayout';
import { KitchenScanLink, NAV_ITEMS } from '../../src/web/design-system/navigation';

const render = (node: ReactElement, route: string) => renderToStaticMarkup(<StaticRouter location={route}>{node}</StaticRouter>);
const router = readFileSync('src/web/App.tsx', 'utf8');
const shell = router.slice(router.indexOf('{/* Core App Shell */}'), router.indexOf('{/* Catch-all fallback */}'));
// Redirect-only aliases do not display a page; every rendered destination shares the shell.
const aliases = new Set(['/inventory', '/profile', '/family', '/settings']);
const routes = [...shell.matchAll(/path="([^"]+)"/g)].map((match) => match[1])
  .filter((route) => !aliases.has(route))
  .map((route) => route.replace(/:[^/]+/g, 'fixture'));
const immersive = (route: string) => /^\/scan\/?$/.test(route) || /^\/(cook|cooking)(?:\/|$)/.test(route);
const cases = routes.flatMap((canonical) => [...new Set([
  canonical, canonical.toUpperCase(), canonical === '/' ? '/' : `${canonical}/`,
  `${canonical}?payment=success&orderCode=123`,
])].map((route) => ({ canonical, route, pathname: new URL(route, 'https://test.local').pathname })));

describe('all rendered app routes share the current navigation', () => {
  it.each(cases.filter(({ canonical }) => !immersive(canonical)))('$route retains five destinations and the current shell', ({ canonical, route, pathname }) => {
    expect(matchPath(canonical, pathname)).not.toBeNull();
    expect(isKitchenSurface(pathname)).toBe(true);
    const html = render(<AppLayout />, route);
    expect(html).toContain('data-kitchen-navigation="persistent"');
    expect(html).toContain('id="kitchen-main"');
    const bottom = /<nav[^>]*class="kitchen-bottom-nav"[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[1];
    expect(bottom).toBeDefined();
    expect(bottom?.match(/<a /g)).toHaveLength(5);
    for (const item of NAV_ITEMS) expect(bottom).toContain(item.label);
    expect(bottom).not.toContain('href="/scan"');
    expect(html).not.toContain('aria-label="Quét AI"');
  });

  it.each(cases.filter(({ canonical }) => immersive(canonical)))('$route retains the full-screen workflow', ({ canonical, route, pathname }) => {
    expect(matchPath(canonical, pathname)).not.toBeNull();
    const html = render(<AppLayout />, route);
    expect(html).not.toContain('<nav');
    expect(html).not.toContain('data-kitchen-navigation="persistent"');
  });

  it.each(['/plus', '/Plus', '/PLUS/', '/plus?payment=success&orderCode=123'])('recognizes %s as part of the account destination', (route) => {
    const html = render(<AppLayout />, route);
    const bottom = /<nav[^>]*class="kitchen-bottom-nav"[^>]*>([\s\S]*?)<\/nav>/.exec(html)?.[1];
    expect(bottom).toMatch(/<a(?=[^>]*href="\/me")(?=[^>]*aria-current="page")[^>]*>/);
  });

  it.each(['/scan/item/review', '/SCAN/ITEM/REVIEW/', '/scan/result?scanId=fixture'])('recognizes %s as the active Scan action', (route) => {
    expect(render(<KitchenScanLink />, route)).toContain('aria-current="page"');
  });
});
