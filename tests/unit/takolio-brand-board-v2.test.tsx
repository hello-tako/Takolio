import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  BEMAM_MASCOT_SHOWCASE,
  BRAND_FEATURE_ICONS,
  BrandFeatureIcon,
  BrandLockup,
  CulinaryHillsBanner,
  MascotIllustration,
} from '../../src/web/vnext/components/VNextMedia';

const REPO_ROOT = path.resolve(__dirname, '../..');

describe('Takolio Official Brand Board v2 — Artwork Rule 5b & Token Compliance', () => {
  it('defines exact Brand Board hex tokens and Nunito + Plus Jakarta Sans fonts in tokens.css', () => {
    const css = readFileSync(path.join(REPO_ROOT, 'src/web/vnext/styles/tokens.css'), 'utf8');
    expect(css).toMatch(/--tkv-primary:\s*#196149/i);
    expect(css).toMatch(/--tkv-coral:\s*#f46b52/i);
    expect(css).toMatch(/--tkv-saffron:\s*#f6c453/i);
    expect(css).toMatch(/--tkv-bg:\s*#fff9f1/i);
    expect(css).toMatch(/--tkv-ink:\s*#152e2c/i);
    expect(css).toMatch(/--tkv-surface-mint:\s*#e7f4ec/i);
    expect(css).toMatch(/--tkv-surface-coral:\s*#fff0e9/i);
    expect(css).toContain('Nunito');
    expect(css).toContain('Plus Jakarta Sans');
  });

  it('stores all 17 high-resolution PNG masters and exports all raster WebP/PNG UI assets', () => {
    const mastersDir = path.join(REPO_ROOT, 'public/takolio/brand-v2/masters');
    expect(existsSync(mastersDir)).toBe(true);
    const masters = readdirSync(mastersDir).filter((f) => f.endsWith('-master.png'));
    expect(masters.length).toBe(17);

    for (const iconMeta of Object.values(BRAND_FEATURE_ICONS)) {
      expect(existsSync(path.join(REPO_ROOT, 'public', iconMeta.src))).toBe(true);
      expect(existsSync(path.join(REPO_ROOT, 'public', iconMeta.src128))).toBe(true);
    }
  });

  it('enforces Rule 5b: BrandLockup, MascotIllustration, BrandFeatureIcon, and CulinaryHillsBanner render 100% AI raster images (zero inline SVG)', () => {
    const lockupHtml = renderToStaticMarkup(<BrandLockup showTagline />);
    expect(lockupHtml).not.toContain('<svg');
    expect(lockupHtml).toContain('/takolio/brand-v2/brand/takolio-logo-mark');
    expect(lockupHtml).toContain('Trợ lý bếp gia đình thông minh với AI');

    for (const item of BEMAM_MASCOT_SHOWCASE) {
      const mascotHtml = renderToStaticMarkup(<MascotIllustration pose={item.pose} />);
      expect(mascotHtml).not.toContain('<svg');
      expect(mascotHtml).not.toContain('.svg');
      expect(mascotHtml).toContain('Bé Mầm Bếp');
      expect(mascotHtml).not.toMatch(/bạch tuộc|Tako\b/i);
    }

    for (const key of Object.keys(BRAND_FEATURE_ICONS) as Array<keyof typeof BRAND_FEATURE_ICONS>) {
      const iconHtml = renderToStaticMarkup(<BrandFeatureIcon name={key} decorative={false} />);
      expect(iconHtml).not.toContain('<svg');
      expect(iconHtml).toContain(`/takolio/brand-v2/icons/feature-${key}`);
    }

    const hillsHtml = renderToStaticMarkup(<CulinaryHillsBanner />);
    expect(hillsHtml).not.toContain('<svg');
    expect(hillsHtml).toContain('/takolio/brand-v2/decor/culinary-hills-strip');
  });
});
