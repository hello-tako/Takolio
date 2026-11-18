// @vitest-environment jsdom
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VIETNAMESE_RECIPES } from '@frigo/recipes';
import { ALL_VNEXT_ICON_NAMES, VNextIcon } from '../../src/web/vnext/components/VNextIcons';
import { VERIFIED_VNEXT_RECIPE_MEDIA } from '../../src/web/vnext/components/VNextMedia';
import { M01LandingPilot } from '../../src/web/vnext/screens/M01LandingPilot';
import { A02LoginPilot } from '../../src/web/vnext/screens/A02LoginPilot';
import { O03HouseholdPilot } from '../../src/web/vnext/screens/O03HouseholdPilot';
import { G02ReviewHubPage } from '../../src/web/vnext/screens/G02ReviewHubPage';

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
    expect(svgs.length).toBeGreaterThanOrEqual(59);
    for (const svgFile of svgs) {
      const content = readFileSync(svgFile, 'utf8');
      expect(content).toContain('<svg');
      expect(content.toLowerCase()).not.toContain('<image');
      expect(content.toLowerCase()).not.toContain('data:image/');
    }
  });

  it('verifies every vNext recipe photo maps to an exact canonical Vietnamese recipe slug', () => {
    const canonicalSlugs = new Set(VIETNAMESE_RECIPES.map((r) => r.slug));
    for (const [slug, meta] of Object.entries(VERIFIED_VNEXT_RECIPE_MEDIA)) {
      expect(canonicalSlugs.has(slug), `Unverified recipe slug: ${slug}`).toBe(true);
      expect(existsSync(path.join(REPO_ROOT, 'public', meta.src))).toBe(true);
      expect(existsSync(path.join(REPO_ROOT, 'public', meta.src640))).toBe(true);
    }
  });

  it('verifies all ASSET_REGISTRY.csv export files exist and carry PENDING owner approval', () => {
    const regPath = path.join(REPO_ROOT, 'docs/handoff/vnext/ASSET_REGISTRY.csv');
    const rows = readFileSync(regPath, 'utf8').trim().split('\n').slice(1);
    expect(rows.length).toBeGreaterThanOrEqual(75);
    for (const row of rows) {
      expect(row).toContain('"PENDING"');
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

  it('renders M01 Landing, A02 Login, O03 Household (1..20), and G02 Review Hub with Style A/B/C switcher', () => {
    const m01 = mountWithProviders(<M01LandingPilot />, ['/vnext/m01']);
    expect(m01.container.querySelector('h1')?.textContent).toMatch(/Hôm nay ăn gì\?/i);
    expect(m01.container.querySelector('[data-testid="m01-start-free-cta"]')).not.toBeNull();
    m01.unmount();

    const a02 = mountWithProviders(<A02LoginPilot />, ['/auth?mode=login&vnext=1']);
    expect(a02.container.querySelector('h1')?.textContent).toMatch(/Đăng nhập tài khoản/i);
    expect(a02.container.querySelector('[data-testid="a02-submit-btn"]')).not.toBeNull();
    a02.unmount();

    const o03 = mountWithProviders(
      <Routes>
        <Route path="/onboarding/household" element={<O03HouseholdPilot />} />
      </Routes>,
      ['/onboarding/household?vnext=1'],
    );
    expect(o03.container.querySelector('h1')?.textContent).toMatch(/Gia đình và khẩu phần/i);
    o03.click(o03.container.querySelector('[data-testid="o03-bucket-5"]'));
    expect(o03.container.textContent).toMatch(/5 người/i);
    o03.unmount();

    const hub = mountWithProviders(<G02ReviewHubPage />, ['/vnext']);
    const styleBBtn = Array.from(hub.container.querySelectorAll('button')).find(
      (b) => b.textContent?.trim() === 'Style B',
    );
    hub.click(styleBBtn ?? null);
    expect(hub.container.querySelector('[data-tkv-direction="b"]')).not.toBeNull();
    hub.unmount();
  });
});
