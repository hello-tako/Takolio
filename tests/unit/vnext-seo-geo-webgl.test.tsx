// @vitest-environment jsdom
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  buildRecipeJsonLd,
  resolveCanonicalOrigin,
  TAKOLIO_APP_ORIGIN,
  TAKOLIO_MARKETING_ORIGIN,
} from '../../src/web/vnext/lib/seo';
import {
  detectRuntimeDomainRole,
  resolveAppSurfaceHref,
  resolveSatelliteSurfaceHref,
} from '../../src/web/vnext/lib/domain-surface';
import { M01LandingPilot } from '../../src/web/vnext/screens/M01LandingPilot';
import { M10FaqPage, M11StoriesPage } from '../../src/web/vnext/screens/PublicSitePages';
import { VNextAuthFlow } from '../../src/web/vnext/screens/AuthFlowPages';
import {
  InteractiveAiScanHudSvg,
  InteractiveFridgeCutawaySvg,
  InteractiveKitchenLoopSvg,
  InteractivePortionMacroDialSvg,
  InteractiveSimmerWaveSvg,
  InteractiveTakoChefSvg,
} from '../../src/web/vnext/interactive-svg';
import {
  CulinarySimmerShaderBg,
  FridgeFreshnessOrbital3D,
  SunlitKitchenStage3D,
} from '../../src/web/vnext/webgl';

const REPO_ROOT = path.resolve(__dirname, '../..');

function mountUi(ui: React.ReactElement, initialEntries = ['/']) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={initialEntries}>{ui}</MemoryRouter>
      </QueryClientProvider>,
    );
  });
  return {
    container,
    click: (el: Element | null) => {
      if (!el) throw new Error('Target element missing');
      act(() => {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
    },
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('Takolio Dual-Domain SEO/GEO, 3D WebGL & Interactive SVG Suite', () => {
  beforeEach(() => {
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    document.head.innerHTML = '';
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          turnstileSiteKey: null,
          googleClientId: null,
          plans: [],
        }),
      ),
    );
  });

  it('resolves takolio.com satellite vs takolio.app application roles and cross-domain handoff URLs', () => {
    expect(TAKOLIO_MARKETING_ORIGIN).toBe('https://takolio.com');
    expect(TAKOLIO_APP_ORIGIN).toBe('https://takolio.app');

    expect(detectRuntimeDomainRole('takolio.com')).toBe('satellite-com');
    expect(detectRuntimeDomainRole('www.takolio.com')).toBe('satellite-com');
    expect(detectRuntimeDomainRole('takolio.app')).toBe('application-app');
    expect(detectRuntimeDomainRole('127.0.0.1')).toBe('local-unified');

    expect(resolveAppSurfaceHref('/auth?mode=guest', 'takolio.com')).toBe(
      'https://takolio.app/auth?mode=guest',
    );
    expect(resolveAppSurfaceHref('/auth?mode=guest', '127.0.0.1')).toBe('/auth?mode=guest');
    expect(resolveSatelliteSurfaceHref('/pricing', 'takolio.app')).toBe(
      'https://takolio.com/pricing',
    );

    expect(resolveCanonicalOrigin('marketing')).toBe('https://takolio.com');
    expect(resolveCanonicalOrigin('app')).toBe('https://takolio.app');
  });

  it('emits canonical takolio.com metadata, Schema.org JSON-LD, and GEO comparison table on M01/M10/M11 while keeping Auth noindex on takolio.app', () => {
    const m01 = mountUi(<M01LandingPilot />, ['/landing']);
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://takolio.com/',
    );
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toContain(
      'index, follow, max-image-preview:large',
    );
    const m01Ld = document.head.querySelector('script[type="application/ld+json"]')?.textContent;
    expect(m01Ld).toContain('WebApplication');
    expect(m01Ld).toContain('https://takolio.com');
    expect(m01Ld).toContain('https://takolio.app');
    expect(m01.container.querySelector('#tkv-geo-summary table')).not.toBeNull();
    m01.unmount();

    const m10 = mountUi(<M10FaqPage />, ['/faq']);
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://takolio.com/faq',
    );
    expect(
      document.head.querySelector('script[type="application/ld+json"]')?.textContent,
    ).toContain('FAQPage');
    m10.unmount();

    const m11 = mountUi(<M11StoriesPage />, ['/stories']);
    expect(m11.container.querySelectorAll('article').length).toBe(6);
    expect(
      document.head.querySelector('script[type="application/ld+json"]')?.textContent,
    ).toContain('BlogPosting');
    m11.unmount();

    const auth = mountUi(<VNextAuthFlow />, ['/auth?mode=login']);
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://takolio.app/auth',
    );
    expect(document.head.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    );
    auth.unmount();

    const recipeLd = buildRecipeJsonLd({
      slug: 'thit-kho-trung',
      title: 'Thịt kho tàu nước dừa trứng',
      description: 'Món kho truyền thống đậm đà.',
      cookMinutes: 45,
      servings: 4,
      calories: 520,
      ingredients: ['Thịt ba chỉ (400 g)', 'Trứng gà ta (4 quả)'],
      steps: ['Ướp thịt 20 phút.', 'Kho lửa riu với nước dừa.'],
    });
    expect(recipeLd['@type']).toBe('Recipe');
    expect(recipeLd.url).toBe('https://takolio.app/recipes/thit-kho-trung');
  });

  it('provides complete GEO discovery files (llms.txt, llms-full.txt, robots.txt, sitemap.xml) and dedicated wrangler.site.jsonc', () => {
    const llms = readFileSync(path.join(REPO_ROOT, 'public/llms.txt'), 'utf8');
    const llmsFull = readFileSync(path.join(REPO_ROOT, 'public/llms-full.txt'), 'utf8');
    const robots = readFileSync(path.join(REPO_ROOT, 'public/robots.txt'), 'utf8');
    const sitemap = readFileSync(path.join(REPO_ROOT, 'public/sitemap.xml'), 'utf8');
    const wranglerSite = readFileSync(path.join(REPO_ROOT, 'wrangler.site.jsonc'), 'utf8');

    expect(llms).toContain('https://takolio.com');
    expect(llms).toContain('https://takolio.app');
    expect(llmsFull).toContain('Takolio');

    expect(robots).toContain('User-agent: OAI-SearchBot');
    expect(robots).toContain('User-agent: PerplexityBot');
    expect(robots).toContain('Sitemap: https://takolio.com/sitemap.xml');

    expect(sitemap).toContain('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    expect(sitemap).toContain('<loc>https://takolio.com/</loc>');
    expect(sitemap).toContain('<loc>https://takolio.app/recipes/thit-kho-trung</loc>');

    expect(wranglerSite).toContain('"name": "takolio-site"');
    expect(wranglerSite).toContain('"pattern": "takolio.com"');
    expect(wranglerSite).not.toContain('d1_databases');

    for (const storyIdx of [
      'story-01-weeknight-dinner.webp',
      'story-02-crisp-greens.webp',
      'story-03-parallel-cooking.webp',
      'story-04-aromatics-prep.webp',
      'story-05-zero-waste-tray.webp',
      'story-06-claypot-braise.webp',
    ]) {
      expect(existsSync(path.join(REPO_ROOT, 'public/takolio/vnext/stories', storyIdx))).toBe(true);
    }
  });

  it('renders all 6 real interactive inline SVGs and 3 WebGL components with clean JSDOM fallbacks', () => {
    const selectedStations: string[] = [];
    const loop = mountUi(
      <InteractiveKitchenLoopSvg onSelectStation={(id) => selectedStations.push(id)} />,
    );
    const tabs = loop.container.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBeGreaterThanOrEqual(5);
    loop.click(tabs[1]);
    expect(selectedStations.length).toBe(1);
    loop.unmount();

    const selectedZones: string[] = [];
    const fridge = mountUi(
      <InteractiveFridgeCutawaySvg
        countsByZone={{ cool: 4, crisper: 5, chiller: 2, freezer: 3 }}
        expiringCount={2}
        onSelectZone={(z) => selectedZones.push(z)}
      />,
    );
    const zoneBtns = fridge.container.querySelectorAll('button');
    expect(zoneBtns.length).toBeGreaterThanOrEqual(4);
    fridge.click(zoneBtns[1]);
    expect(selectedZones.length).toBe(1);
    fridge.unmount();

    const scan = mountUi(<InteractiveAiScanHudSvg />);
    expect(scan.container.querySelector('svg')).not.toBeNull();
    scan.unmount();

    let nextServings = 4;
    const dial = mountUi(
      <InteractivePortionMacroDialSvg
        initialServings={4}
        onServingsChange={(s) => {
          nextServings = s;
        }}
      />,
    );
    dial.click(dial.container.querySelector('button[aria-label="Tăng khẩu phần"]'));
    expect(nextServings).toBe(5);
    dial.unmount();

    const chef = mountUi(<InteractiveTakoChefSvg size={96} mood="celebrate" defaultShowTip />);
    expect(chef.container.textContent).toContain('Mẹo bếp Tako');
    chef.unmount();

    const wave = mountUi(
      <InteractiveSimmerWaveSvg
        progress={0.5}
        isRunning={true}
        totalSeconds={600}
        remainingSeconds={300}
      />,
    );
    expect(wave.container.querySelector('svg')).not.toBeNull();
    wave.unmount();

    const stage3d = mountUi(
      <div>
        <SunlitKitchenStage3D posterAlt="Poster fallback" />
        <FridgeFreshnessOrbital3D freshCount={6} soonCount={2} urgentCount={1} />
        <CulinarySimmerShaderBg timerRunning />
      </div>,
    );
    expect(stage3d.container.querySelector('[data-testid="webgl-hero-controls"]')).not.toBeNull();
    stage3d.unmount();
  });
});
