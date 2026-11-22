import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/web/stores/useAuthStore', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    const state = { setGuestSession: vi.fn(), avatarUrl: null, displayName: 'Test' };
    return selector ? selector(state) : state;
  },
}));

import { TAKOSAN_BRAND } from '../../src/web/lib/takosan-brand';
import { TAKOLIO_BRAND } from '../../src/web/lib/takolio-brand';
import { M01LandingPilot } from '../../src/web/vnext/screens/M01LandingPilot';
import { ConsumerStudioShell, PublicMarketingShell } from '../../src/web/vnext/components/Shells';
import { TkvEmptyState } from '../../src/web/vnext/components/Primitives';
import { ALL_VNEXT_ICON_NAMES, VNextIcon } from '../../src/web/vnext/components/VNextIcons';
// @ts-expect-error Tailwind's JavaScript config intentionally has no declaration file.
import tailwindConfig from '../../tailwind.config.js';

const root = resolve(__dirname, '../..');
const publicFile = (webPath: string) => resolve(root, 'public', webPath.replace(/^\//, ''));

function collectPaths(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    if (value.startsWith('/takolio/')) out.push(value);
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => collectPaths(v, out));
  }
  return out;
}

describe('Takolio brand contract', () => {
  it('names the product Takolio and uses the kit palette', () => {
    expect(TAKOSAN_BRAND.name).toBe('Takolio');
    expect(TAKOSAN_BRAND.colors).toEqual({
      coral: '#FF6B6B',
      green: '#4CAF6B',
      navy: '#0F2D46',
      cream: '#FFF8ED',
      mint: '#E8F7EC',
      yellow: '#F7C15A',
    });
  });

  it('every referenced runtime brand asset exists under public/takosan', () => {
    const paths = collectPaths(TAKOSAN_BRAND);
    expect(paths.length).toBeGreaterThan(20);
    const missing = paths.filter((p) => !existsSync(publicFile(p)));
    expect(missing).toEqual([]);
  });

  it('uses the supplied SVG lockups rather than typed wordmarks', () => {
    for (const logo of Object.values(TAKOSAN_BRAND.logos)) {
      const svg = readFileSync(publicFile(logo), 'utf8');
      expect(svg).toContain('<svg');
      expect(svg).toContain('<path');
      expect(svg).not.toMatch(/<script|foreignObject|(?:href|src)=/i);
      expect(svg).not.toMatch(/<text/i);
    }
  });

  it('every semantic-* utility referenced in src/web resolves to a Tailwind color key', () => {
    // Tailwind exposes nested color keys verbatim: a camelCase key would
    // silently compile no CSS for the kebab-case utilities pages use.
    const semantic = tailwindConfig.theme.extend.colors.semantic as Record<string, string>;
    const keys = new Set(Object.keys(semantic));
    const used = new Set<string>();
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = resolve(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.(tsx?|css)$/.test(entry.name)) {
          for (const m of readFileSync(full, 'utf8').matchAll(/[a-z]+-semantic-([a-zA-Z-]+?)(?:\/\d+)?(?=[\s"'`)}\]])/g)) used.add(m[1]);
        }
      }
    };
    walk(resolve(root, 'src/web'));
    expect(used.size).toBeGreaterThan(10);
    expect([...used].filter((k) => !keys.has(k))).toEqual([]);
  });

  it('raw palette classes, arbitrary colour values and legacy motion utilities are gone or explicitly allowlisted', async () => {
    // scripts/t17/style-residuals.mjs is the residual authority; this keeps
    // the allowlist enforced by the unit gate, not only by a manual script.
    // @ts-expect-error plain ESM script without a declaration file (same pattern as tailwind.config.js above).
    const { audit, ALLOWLIST } = await import('../../scripts/t17/style-residuals.mjs');
    const findings: Array<{ file: string; line: number; token: string; allow: string | null }> = audit(root);
    expect(findings.filter((f) => !f.allow)).toEqual([]);
    // The only sanctioned residue is the protected payment UI.
    expect(ALLOWLIST.map((a: { id: string }) => a.id)).toEqual(['payment-boundary']);
    expect(new Set(findings.map((f) => f.file))).toEqual(new Set(['src/web/components/payment/VietQRModal.tsx']));
  });
});

describe('PWA metadata', () => {
  it('manifest is branded Takolio with kitchen theme colours and generated icons', () => {
    const manifest = JSON.parse(readFileSync(resolve(root, 'public/manifest.json'), 'utf8'));
    expect(manifest.short_name).toBe('Takolio');
    expect(manifest.name).toMatch(/^Takolio/);
    expect(manifest.theme_color).toBe('#0F2D46');
    expect(manifest.background_color).toBe('#FFF8ED');
    const sizes = manifest.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}${i.purpose ? `:${i.purpose}` : ''}`);
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512', '512x512:maskable']));
    for (const icon of manifest.icons) {
      expect(icon.src.startsWith('/takolio/')).toBe(true);
      expect(existsSync(publicFile(icon.src))).toBe(true);
    }
  });

  it('index.html title, favicon, theme colour and OpenGraph are Takolio while the domain is unchanged', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    expect(html).toMatch(/<title>Takolio/);
    expect(html).toContain('href="/takolio/v1/app-icons/favicon.svg"');
    expect(html).toContain('<meta name="theme-color" content="#0F2D46" />');
    expect(html).toContain('property="og:title" content="Takolio');
    // og:image must be absolute for scrapers; the temporary domain stays until the maintainer picks one.
    expect(html).toContain('property="og:image" content="https://frigo.tungjpstore.net/takolio/v1/social/og-1200x630.png"');
    expect(html).toContain('property="og:url" content="https://frigo.tungjpstore.net"');
    expect(html).not.toMatch(/og:image" content="\//);
    expect(html).not.toMatch(/\/frigo\/(brand|app-icons)\//);
    expect(html).not.toContain('fonts.googleapis.com');
    expect(readFileSync(resolve(root, 'src/web/styles/brand-v3-fonts.css'), 'utf8')).toContain("font-family: 'Nunito'");
  });

  it('favicon, apple-touch-icon and icon links in index.html point at existing Takolio files', () => {
    const html = readFileSync(resolve(root, 'index.html'), 'utf8');
    const iconHrefs = [...html.matchAll(/<link rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
    expect(iconHrefs.length).toBeGreaterThanOrEqual(3);
    for (const href of iconHrefs) {
      expect(href.startsWith('/takolio/v1/app-icons/')).toBe(true);
      expect(existsSync(publicFile(href))).toBe(true);
    }
    expect(existsSync(publicFile(TAKOSAN_BRAND.og))).toBe(true);
  });

  it('service worker cache version moved off frigo-pwa-v1 and precaches Takolio assets', () => {
    const sw = readFileSync(resolve(root, 'public/sw.js'), 'utf8');
    expect(sw).not.toContain("'frigo-pwa-v1'");
    expect(sw).toContain("BUILD_ID = '__TAKOSAN_BUILD_ID__'");
    expect(sw).toContain('CACHE_NAME = `takosan-pwa-${BUILD_ID}`');
    expect(sw).toContain('/takolio/v1/app-icons/icon-192.png');
    expect(sw).toContain("url.pathname.startsWith('/takosan/')");
    const crossOriginBypass = sw.indexOf('if (url.origin !== self.location.origin) return;');
    expect(crossOriginBypass).toBeGreaterThan(-1);
    expect(crossOriginBypass).toBeLessThan(sw.indexOf('event.respondWith'));
    expect(sw).not.toContain("url.hostname.includes('fonts.googleapis.com')");
    expect(sw).not.toContain("url.hostname.includes('fonts.gstatic.com')");
    const precached = [...sw.matchAll(/'(\/takosan\/[^']+)'/g)].map((m) => m[1]);
    expect(precached.filter((p) => !existsSync(publicFile(p)))).toEqual([]);
  });

  it('forces release-aware service worker updates and correct cache headers', () => {
    const main = readFileSync(resolve(root, 'src/web/main.tsx'), 'utf8');
    const sw = readFileSync(resolve(root, 'public/sw.js'), 'utf8');
    const headers = readFileSync(resolve(root, 'public/_headers'), 'utf8');
    const vite = readFileSync(resolve(root, 'vite.config.ts'), 'utf8');
    expect(main).toContain("/sw.js?v=${encodeURIComponent(buildId)}");
    expect(main).toContain("updateViaCache: 'none'");
    expect(sw).toContain("key.startsWith('takosan-pwa-')");
    expect(sw).toContain('void client.navigate(client.url).catch');
    expect(sw).toContain('await self.clients.claim()');
    expect(sw).not.toContain('Failed to precache some assets');
    expect(vite).toContain("replaceAll('__TAKOSAN_BUILD_ID__', buildCommit)");
    expect(headers).toContain('/sw.js\n  ! Cache-Control\n  Cache-Control: no-cache, no-store, must-revalidate');
    expect(headers).toContain('/assets/*\n  ! Cache-Control\n  Cache-Control: public, max-age=31536000, immutable');
    expect(headers).not.toContain('/service-worker.js');
  });
});

describe('Primary vNext shell renders Takolio Kitchen Studio, not Frigo', () => {
  const render = (ui: React.ReactElement, path = '/') =>
    renderToStaticMarkup(<StaticRouter location={path}>{ui}</StaticRouter>);

  it('M01LandingPilot shows the Official Takolio Brand Board v2 identity with zero Frigo copy', () => {
    const html = render(<M01LandingPilot />, '/landing');
    expect(html).toContain('/takolio/brand-v2/brand/takolio-logo-mark');
    expect(html).toContain('Bữa ngon,');
    expect(html).toContain('nhẹ đầu.');
    expect(html).toContain('Ăn đủ. Mua đủ. Dùng hết.');
    expect(html).not.toContain('Frigo');
    expect(html).not.toContain('/frigo/brand/');
  });

  it('PublicMarketingShell and ConsumerStudioShell use the Brand Board v2 lockup and 5-root navigation grammar', () => {
    const pub = render(<PublicMarketingShell screenId="M01"><div>Nội dung</div></PublicMarketingShell>, '/landing');
    expect(pub).toContain('/takolio/brand-v2/brand/takolio-logo-mark');
    expect(pub).toContain('alt="Takolio"');
    expect(pub).not.toContain('frigo-logo');

    const studio = render(<ConsumerStudioShell screenId="C01"><div>Bếp</div></ConsumerStudioShell>, '/');
    expect(studio).toContain('/takolio/brand-v2/brand/takolio-logo-mark');
    for (const label of ['Trang chủ', 'Tủ lạnh', 'Thực đơn', 'Mua sắm', 'Cá nhân']) {
      expect(studio).toContain(label);
    }
    expect(studio).toContain('aria-current="page"');
  });

  it('TkvEmptyState renders Bé Mầm Bếp mascot poses cleanly without legacy octopus or Frigo art', () => {
    const empty = render(<TkvEmptyState pose="empty-fridge" title="Trống" description="x" />);
    expect(empty).toContain('/takolio/vnext/mascot/pose-04-empty-fridge');
    expect(empty).not.toContain('/frigo/');
  });
});

describe('Palette hardening (P2-BRAND-1)', () => {
  const protectedPaymentFiles = new Set([
    resolve(root, 'src/web/components/payment/VietQRModal.tsx'),
    resolve(root, 'src/web/pages/PlusPaywallPage.tsx'),
  ]);
  const runtimeFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) return runtimeFiles(full);
      return /\.(tsx?|css)$/.test(entry.name) ? [full] : [];
    });
  const LEGACY = /emerald-|#059669|#047857|#0F3D2E|#14532D|#22C55E|#1ea750|#DDF7E3|#FFFDF6|#F8FAF9|#34d399/i;

  it('runtime frontend source and Tailwind config carry no legacy Frigo/emerald palette', () => {
    const offenders: string[] = [];
    for (const file of [...runtimeFiles(resolve(root, 'src/web')), resolve(root, 'tailwind.config.js'), resolve(root, 'index.html')]) {
      if (protectedPaymentFiles.has(file)) continue;
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (LEGACY.test(line)) offenders.push(`${file.replace(root, '')}:${i + 1}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  it('Tailwind config parses and exposes the locked palette plus Takolio-green tinted shadows', () => {
    const theme = (tailwindConfig as { theme: { extend: { colors: Record<string, unknown>; boxShadow: Record<string, string> } } }).theme.extend;
    const takosan = theme.colors.takosan as Record<string, string | Record<string, string>>;
    const value = (c: string | Record<string, string>) => (typeof c === 'string' ? c : c.DEFAULT);
    for (const [name, hex] of Object.entries({ coral: '#FF7B6B', green: '#2E7D5B', navy: '#202C28', cream: '#FFF8F3', mint: '#DFF4E6', yellow: '#FFC857' })) {
      const actual = value(takosan[name]);
      if (name === 'navy') {
        expect(actual).toContain('--takosan-navy-color-rgb');
        expect(readFileSync(resolve(root, 'src/web/styles/takosan-tokens.css'), 'utf8')).toContain('--takosan-navy-color-rgb: 15 45 70');
      } else if (actual.startsWith('rgb(var(')) {
        const rgb = [1, 3, 5].map(index => Number.parseInt(hex.slice(index, index + 2), 16)).join(' ');
        expect(actual).toContain(`, ${rgb}) / <alpha-value>)`);
      } else expect(actual).toBe(hex);
    }
    for (const name of ['float', 'glow']) {
      expect(theme.boxShadow[name]).toContain('rgba(46, 125, 91');
      expect(theme.boxShadow[name]).not.toMatch(/rgba\((5, 150, 105|16, 185, 129)/);
    }
    // Legacy `frigo.*` aliases must resolve to Takolio values, never to the old emerald ramp.
    expect(JSON.stringify(theme.colors.frigo)).not.toMatch(/#059669|#047857|#0F3D2E|#10B981|#34D399/i);
  });

  it('active runtime components do not reference legacy Frigo brand or app-icon assets', () => {
    const offenders: string[] = [];
    for (const file of runtimeFiles(resolve(root, 'src/web'))) {
      const text = readFileSync(file, 'utf8');
      if (file.endsWith('frigo-assets.ts')) continue; // legacy manifest kept for content paths
      if (/\/frigo\/(brand|app-icons|illustrations)\/|\/assets\/frigo-logo/.test(text)) offenders.push(file.replace(root, ''));
    }
    expect(offenders).toEqual([]);
  });

  it('visible runtime copy no longer says Frigo (technical identifiers excluded)', () => {
    const offenders: string[] = [];
    const technical = /X-Frigo-|frigo_[a-z_]+|@frigo\/|\/frigo\/|frigo-assets|frigo-tokens|--frigo-|frigo\.tungjpstore\.net/;
    const files = [
      ...runtimeFiles(resolve(root, 'src/web')),
      resolve(root, 'index.html'),
      resolve(root, 'public/manifest.json'),
      resolve(root, 'public/sw.js'),
    ];
    for (const file of files) {
      if (protectedPaymentFiles.has(file)) continue;
      readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
        if (/\bFrigo\b/.test(line) && !technical.test(line) && !/^\s*(\/\/|\/\*|\*|\{\/\*)/.test(line)) {
          offenders.push(`${file.replace(root, '')}:${i + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe('Brand generator (P2-BRAND-2)', () => {
  it('sharp is a direct, exactly pinned devDependency and the generator imports it directly', () => {
    const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
    expect(pkg.devDependencies.sharp).toBe('0.35.5');
    expect(pkg.scripts['brand:icons']).toBe('node scripts/generate-takolio-brand.mjs');
    const script = readFileSync(resolve(root, 'scripts/generate-takosan-icons.mjs'), 'utf8');
    expect(script).toContain("import sharp from 'sharp'");
    expect(script).not.toContain('NODE_PATH');
    expect(script).not.toContain('createRequire');
  });

  it('every generated runtime icon the generator promises exists', () => {
    const expected = [16, 32, 48, 64, 128, 180, 192, 256, 512].map((s) => `/takosan/app-icons/icon-${s}.png`).concat([
      '/takosan/app-icons/icon-maskable-512.png',
      '/takosan/app-icons/takosan-app-icon-light-512.png',
      '/takosan/app-icons/takosan-app-icon-mint-512.png',
      '/takosan/brand/takosan-og.png',
    ]);
    expect(expected.filter((p) => !existsSync(publicFile(p)))).toEqual([]);
  });
});

it('keeps brand constants identical and renders pure-vector vNext 24x24 SVG icons cleanly', () => {
  expect(TAKOSAN_BRAND).toBe(TAKOLIO_BRAND);
  expect(ALL_VNEXT_ICON_NAMES.length).toBe(53);
  const fridge = renderToStaticMarkup(<VNextIcon name="fridge" label="Tủ lạnh" />);
  expect(fridge).toContain('viewBox="0 0 24 24"');
  expect(fridge).toContain('aria-label="Tủ lạnh"');
  expect(fridge).not.toContain('<image');
});
