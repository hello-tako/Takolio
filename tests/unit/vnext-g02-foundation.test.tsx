// @vitest-environment jsdom
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ALL_RECIPES } from '@frigo/recipes';
import { ALL_VNEXT_ICON_NAMES, VNextIcon } from '../../src/web/vnext/components/VNextIcons';
import { VERIFIED_VNEXT_RECIPE_MEDIA } from '../../src/web/vnext/components/VNextMedia';
import { M01LandingPilot } from '../../src/web/vnext/screens/M01LandingPilot';
import {
  M02HowItWorksPage,
  M09PricingPage,
  M10FaqPage,
  M11StoriesPage,
  M12CompanyLegalPage,
} from '../../src/web/vnext/screens/PublicSitePages';
import { VNextAuthFlow } from '../../src/web/vnext/screens/AuthFlowPages';
import { VNextOnboardingFlow } from '../../src/web/vnext/screens/OnboardingFlowPages';
import { C02QuickSearchPage } from '../../src/web/vnext/screens/FridgeAndScanWrappers';
import {
  C15RecipesDiscoveryVNext,
  C20C21CookingStudioVNext,
  C22CookingCompleteVNext,
} from '../../src/web/vnext/screens/RecipesAndCookPages';
import {
  S02NotFoundPage,
  U01ProfileHubVNext,
  U06HouseholdHonestPage,
  U09U10PrivacyAndDataRightsPage,
  VNextSystemStatePage,
} from '../../src/web/vnext/screens/AccountAndSystemPages';

const REPO_ROOT = path.resolve(__dirname, '../..');

function collectSvgFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectSvgFiles(full));
    else if (entry.name.endsWith('.svg')) out.push(full);
  }
  return out;
}

function mountWithProviders(ui: React.ReactElement, initialEntries = ['/']) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
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
      if (!el) throw new Error('Target element not found for click');
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

describe('Takolio Frontend vNext — G00/G01/G02 Foundation & Safety Gates', () => {
  beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          turnstileSiteKey: null,
          googleClientId: null,
        }),
      ),
    );
  });
  it('keeps all 341 protected files byte-for-byte identical to origin/main (87f279a0)', () => {
    const manifestPath = path.join(REPO_ROOT, 'docs/handoff/vnext/PROTECTED_FILE_HASHES.json');
    expect(existsSync(manifestPath)).toBe(true);
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      file_count: number;
      files: Record<string, string>;
    };
    expect(manifest.file_count).toBeGreaterThanOrEqual(340);
    for (const [relPath, expectedHash] of Object.entries(manifest.files)) {
      const abs = path.join(REPO_ROOT, relPath);
      expect(existsSync(abs), `Protected file missing: ${relPath}`).toBe(true);
      const actualHash = createHash('sha256').update(readFileSync(abs)).digest('hex');
      expect(actualHash, `Protected file modified: ${relPath}`).toBe(expectedHash);
    }
  });

  it('maps 85/85 unique Screen IDs in ROUTE_STATE_API_MATRIX.csv', () => {
    const csvPath = path.join(REPO_ROOT, 'docs/handoff/vnext/ROUTE_STATE_API_MATRIX.csv');
    const lines = readFileSync(csvPath, 'utf8').trim().split('\n');
    expect(lines.length).toBe(86); // 1 header + 85 screens
    const ids = lines.slice(1).map((line) => line.split(',')[0]);
    expect(new Set(ids).size).toBe(85);
    for (const required of ['M01', 'A02', 'O03', 'C01', 'C03', 'C18', 'C23', 'U06', 'U08', 'U10', 'S02', 'AD02']) {
      expect(ids).toContain(required);
    }
  });

  it('enforces pure editable SVG vectors in public/takolio/vnext (zero embedded raster bitmaps)', () => {
    const vnextDir = path.join(REPO_ROOT, 'public/takolio/vnext');
    const svgs = collectSvgFiles(vnextDir);
    expect(svgs.length).toBeGreaterThanOrEqual(57);
    for (const svgFile of svgs) {
      const content = readFileSync(svgFile, 'utf8');
      expect(content).toContain('<svg');
      expect(content.toLowerCase()).not.toContain('<image');
      expect(content.toLowerCase()).not.toContain('data:image/');
    }
  });

  it('verifies every vNext recipe photo maps to an exact canonical recipe slug', () => {
    const canonicalSlugs = new Set(ALL_RECIPES.map((r) => r.slug));
    expect(Object.keys(VERIFIED_VNEXT_RECIPE_MEDIA).length).toBeGreaterThanOrEqual(12);
    for (const [slug, meta] of Object.entries(VERIFIED_VNEXT_RECIPE_MEDIA)) {
      expect(canonicalSlugs.has(slug), `Unverified recipe slug: ${slug}`).toBe(true);
      expect(existsSync(path.join(REPO_ROOT, 'public', meta.src))).toBe(true);
      expect(existsSync(path.join(REPO_ROOT, 'public', meta.src640))).toBe(true);
    }
  });

  it('verifies all ASSET_REGISTRY.csv export files exist and carry G02 owner approval', () => {
    const regPath = path.join(REPO_ROOT, 'docs/handoff/vnext/ASSET_REGISTRY.csv');
    const rows = readFileSync(regPath, 'utf8').trim().split('\n').slice(1);
    expect(rows.length).toBeGreaterThanOrEqual(85);
    for (const row of rows) {
      expect(row).toMatch(/"APPROVED_G02_OWNER"/);
      const match = row.match(/"(public\/takolio\/vnext\/[^"]+)"/);
      expect(match).not.toBeNull();
      if (match) {
        expect(existsSync(path.join(REPO_ROOT, match[1]))).toBe(true);
      }
    }
  });

  it('renders all 53 pure-vector VNextIcons at 24px cleanly', () => {
    expect(ALL_VNEXT_ICON_NAMES.length).toBe(53);
    const mounted = mountWithProviders(
      <div>
        {ALL_VNEXT_ICON_NAMES.map((name) => (
          <VNextIcon key={name} name={name} size={24} label={name} />
        ))}
      </div>,
    );
    expect(mounted.container.querySelectorAll('svg').length).toBe(53);
    mounted.unmount();
  });

  it('renders G03 Public Website (M01-M12) and G04 Auth/Onboarding (A01-O06) flows cleanly', () => {
    const m01 = mountWithProviders(<M01LandingPilot />, ['/landing?vnext=1']);
    expect(m01.container.querySelector('h1')?.textContent).toMatch(/Hôm nay ăn gì\?/i);
    expect(m01.container.querySelector('[data-testid="m01-start-free-cta"]')).not.toBeNull();
    m01.unmount();

    const m02 = mountWithProviders(<M02HowItWorksPage />, ['/how-it-works']);
    expect(m02.container.querySelector('h1')?.textContent).toMatch(/Takolio hoạt động thế nào/i);
    m02.unmount();

    const m09 = mountWithProviders(<M09PricingPage />, ['/pricing']);
    expect(m09.container.querySelector('h1')?.textContent).toMatch(/Các gói Takolio/i);
    expect(m09.container.textContent).toMatch(/Miễn phí/);
    expect(m09.container.textContent).toMatch(/Takolio Plus/);
    m09.unmount();

    const m10 = mountWithProviders(<M10FaqPage />, ['/faq']);
    expect(m10.container.querySelector('h1')?.textContent).toMatch(/Câu hỏi thường gặp/i);
    m10.unmount();

    const m11 = mountWithProviders(<M11StoriesPage />, ['/stories']);
    expect(m11.container.querySelector('h1')?.textContent).toMatch(/Takolio Stories/i);
    m11.unmount();

    const m12 = mountWithProviders(<M12CompanyLegalPage />, ['/privacy']);
    expect(m12.container.querySelector('h1')?.textContent).toMatch(/Chính sách bảo mật/i);
    m12.unmount();

    const a02 = mountWithProviders(<VNextAuthFlow />, ['/auth?mode=login&vnext=1']);
    expect(a02.container.querySelector('h1')?.textContent).toMatch(/Đăng nhập tài khoản/i);
    expect(a02.container.querySelector('[data-testid="a02-submit-btn"]')).not.toBeNull();
    a02.unmount();

    const a05 = mountWithProviders(<VNextAuthFlow />, ['/auth/verify?vnext=1']);
    expect(a05.container.querySelector('h1')?.textContent).toMatch(/Xác minh OTP/i);
    expect(a05.container.querySelectorAll('input[inputmode="numeric"]').length).toBe(6);
    a05.unmount();

    const a08 = mountWithProviders(<VNextAuthFlow />, ['/auth?mode=transfer-deferred&vnext=1']);
    expect(a08.container.querySelector('h1')?.textContent).toMatch(/Chuyển dữ liệu khách/i);
    a08.unmount();

    const o03 = mountWithProviders(
      <Routes>
        <Route path="/onboarding/*" element={<VNextOnboardingFlow />} />
      </Routes>,
      ['/onboarding/household?vnext=1'],
    );
    expect(o03.container.querySelector('h1')?.textContent).toMatch(/Gia đình và khẩu phần/i);
    o03.click(o03.container.querySelector('[data-testid="o03-bucket-5"]'));
    expect(o03.container.textContent).toMatch(/5 người/i);
    o03.unmount();
  });

  it('renders G05-G09 Consumer, Honest Gap (U06/U10), and System State (S01-S08) screens without deception', () => {
    const c02 = mountWithProviders(<C02QuickSearchPage />, ['/search?vnext=1']);
    expect(c02.container.querySelector('h1')?.textContent).toMatch(/Tìm nhanh/i);
    c02.unmount();

    const c15 = mountWithProviders(<C15RecipesDiscoveryVNext />, ['/recipes?vnext=1']);
    expect(c15.container.querySelector('h1')?.textContent).toMatch(/Khám phá món ăn/i);
    c15.unmount();

    const u01 = mountWithProviders(<U01ProfileHubVNext />, ['/me?vnext=1']);
    expect(u01.container.querySelector('h1')?.textContent).toMatch(/Hồ sơ cá nhân/i);
    u01.unmount();

    const u06 = mountWithProviders(<U06HouseholdHonestPage />, ['/me/household?vnext=1']);
    expect(u06.container.querySelector('h1')?.textContent).toMatch(/Hộ gia đình/i);
    expect(u06.container.textContent).toMatch(/Chưa hỗ trợ API/i);
    u06.unmount();

    const u10 = mountWithProviders(<U09U10PrivacyAndDataRightsPage />, ['/settings/privacy#data-rights']);
    expect(u10.container.textContent).toMatch(/Xuất và xóa dữ liệu/i);
    expect(u10.container.textContent).toMatch(/RFC-002/);
    u10.unmount();

    const s02 = mountWithProviders(<S02NotFoundPage />, ['/khong-ton-tai']);
    expect(s02.container.querySelector('h1')?.textContent).toMatch(/Không tìm thấy trang/i);
    s02.unmount();

    for (const code of ['s01', 's03', 's04', 's05', 's06', 's07', 's08']) {
      const st = mountWithProviders(
        <Routes>
          <Route path="/vnext/states/:stateId" element={<VNextSystemStatePage />} />
        </Routes>,
        [`/vnext/states/${code}`],
      );
      expect(st.container.querySelector('h1')?.textContent?.length).toBeGreaterThan(3);
      st.unmount();
    }

    const c20 = mountWithProviders(
      <Routes>
        <Route path="/cook/:slug" element={<C20C21CookingStudioVNext />} />
      </Routes>,
      ['/cook/thit-kho-trung?stage=prep&vnext=1'],
    );
    expect(c20.container.querySelector('[data-tkv-screen="C20"]')).not.toBeNull();
    c20.unmount();

    const c22 = mountWithProviders(<C22CookingCompleteVNext />, ['/cooking/complete?vnext=1']);
    expect(c22.container.querySelector('h1')?.textContent).toMatch(/Hoàn thành bữa ăn/i);
    c22.unmount();
  });

  it('accounts for all 85/85 Screen IDs in SCREEN_COVERAGE.csv with zero remaining PLAN rows and 85x2 capture paths', () => {
    const covPath = path.join(REPO_ROOT, 'docs/handoff/vnext/SCREEN_COVERAGE.csv');
    const lines = readFileSync(covPath, 'utf8').trim().split('\n');
    expect(lines.length).toBe(86);
    for (const row of lines.slice(1)) {
      expect(row).not.toContain(',"PLAN",');
      expect(row).toMatch(/vnext_g11_85x2\/[A-Z0-9]+_390x844\.png/);
      expect(row).toMatch(/vnext_g11_85x2\/[A-Z0-9]+_1440x900\.png/);
    }
  });

  it('keeps Login and Register in one unified 2-tab card with live Google GSI mount and direct /landing exit', async () => {
    const renderedButtons: Array<Record<string, unknown>> = [];
    (window as unknown as { google?: unknown }).google = {
      accounts: {
        id: {
          initialize: () => {},
          renderButton: (el: HTMLElement, opts: Record<string, unknown>) => {
            renderedButtons.push(opts);
            const fakeIframe = document.createElement('div');
            fakeIframe.setAttribute('data-testid', 'mock-google-gsi-btn');
            el.appendChild(fakeIframe);
          },
        },
      },
    };
    const origFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/config')) {
        return new Response(
          JSON.stringify({ turnstileSiteKey: null, googleClientId: 'test-google-client-id.apps.googleusercontent.com' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('{}', { status: 200 });
    }) as typeof fetch;

    try {
      const authMount = mountWithProviders(<VNextAuthFlow />, ['/auth?mode=login']);
      await new Promise((r) => setTimeout(r, 50));

      // Unified 2-tab switcher + Google button + Email form all present together
      expect(authMount.container.querySelector('[data-testid="auth-tab-login"]')?.getAttribute('aria-selected')).toBe('true');
      expect(authMount.container.querySelector('[data-testid="auth-tab-register"]')?.getAttribute('aria-selected')).toBe('false');
      expect(authMount.container.querySelector('[data-testid="google-auth-section"]')).not.toBeNull();
      expect(authMount.container.querySelector('[data-testid="mock-google-gsi-btn"]')).not.toBeNull();
      expect(renderedButtons.some((b) => b.text === 'signin_with')).toBe(true);

      // Exit link goes straight to /landing, NEVER traps in ?mode=choose
      const links = Array.from(authMount.container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
      expect(links).toContain('/landing');
      expect(links.some((h) => h?.includes('mode=choose'))).toBe(false);

      // Switch to Register tab -> Google button re-renders with signup_with + Register form visible
      authMount.click(authMount.container.querySelector('[data-testid="auth-tab-register"]'));
      await new Promise((r) => setTimeout(r, 50));
      expect(authMount.container.querySelector('h1')?.textContent).toMatch(/Tạo tài khoản mới/i);
      expect(authMount.container.querySelector('[data-testid="a04-submit-btn"]')).not.toBeNull();
      expect(renderedButtons.some((b) => b.text === 'signup_with')).toBe(true);

      authMount.unmount();
    } finally {
      globalThis.fetch = origFetch;
      delete (window as unknown as { google?: unknown }).google;
    }
  });
});
