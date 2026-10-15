import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { generateTakolio, TAKOLIO_ICON_SIZES } from '../../scripts/generate-takolio-brand.mjs';
const root = resolve(import.meta.dirname, '../..');
const runtime = resolve(root, 'public/takolio/v1');
const hash = (b) => createHash('sha256').update(b).digest('hex');

describe('Takolio V1 migration exports', () => {
  it('regenerates exact source bytes and decoded pixels, with stable same-toolchain hashes', async () => {
    const first = await mkdtemp(resolve(tmpdir(), 'takolio-first-'));
    const second = await mkdtemp(resolve(tmpdir(), 'takolio-second-'));
    const files = await generateTakolio(first);
    await generateTakolio(second);
    expect(files.length).toBeGreaterThan(60);
    for (const name of files) {
      const a = await readFile(resolve(first, name));
      const b = await readFile(resolve(second, name));
      const committed = await readFile(resolve(runtime, name));
      expect(hash(a), name).toBe(hash(b));
      if (name.endsWith('.png')) {
        expect(await sharp(a).raw().toBuffer(), name).toEqual(await sharp(committed).raw().toBuffer());
      } else if (name !== 'asset-manifest.json') expect(a, name).toEqual(committed);
    }
  }, 30000);
  it('keeps every canonical output hashed and SVG free of fonts, scripts or external references', async () => {
    const manifest = JSON.parse(await readFile(resolve(runtime, 'asset-manifest.json'), 'utf8'));
    for (const file of manifest.files) {
      const bytes = await readFile(resolve(runtime, file.path));
      expect(hash(bytes), file.path).toBe(file.sha256);
      if (file.path.endsWith('.svg')) {
        const source = bytes.toString();
        expect(source, file.path).not.toMatch(/<(script|foreignObject|image|text)\b|(?:href|onload|onclick)=|<!ENTITY|<!DOCTYPE/i);
        for (const match of source.matchAll(/url\(([^)]+)\)/g)) expect(match[1], file.path).toMatch(/^#[a-z\d-]+$/i);
        await expect(sharp(bytes).png().toBuffer()).resolves.toBeInstanceOf(Buffer);
      }
    }
  }, 30000);
  it('exports opaque platform PNGs, transparent Android foreground and a safe-circle maskable', async () => {
    for (const size of TAKOLIO_ICON_SIZES) {
      const m = await sharp(resolve(runtime, `app-icons/icon-${size}.png`)).metadata();
      expect([m.width, m.height, m.hasAlpha]).toEqual([size, size, false]);
    }
    for (const [name, size] of [['ios-1024.png', 1024], ['googleplay-512.png', 512]]) {
      const m = await sharp(resolve(runtime, 'app-icons', name)).metadata();
      expect([m.width, m.height, m.hasAlpha]).toEqual([size, size, false]);
    }
    const foreground = await sharp(resolve(runtime, 'app-icons/android-adaptive-foreground-432.png')).metadata();
    expect([foreground.width, foreground.hasAlpha]).toEqual([432, true]);
    const { data, info } = await sharp(resolve(runtime, 'app-icons/icon-maskable-512.png')).raw().toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(3);
    let maxRadius = 0, painted = 0;
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const i = (y * 512 + x) * 3;
      if ([255, 107, 107].some((v, c) => Math.abs(v - data[i + c]) > 3)) {
        painted++; maxRadius = Math.max(maxRadius, Math.hypot(x + .5 - 256, y + .5 - 256));
      }
    }
    expect(painted).toBeGreaterThan(10000);
    expect(maxRadius).toBeLessThanOrEqual(204.8);
  });
  it('preserves the payment/legacy root token bytes and service-worker lifecycle', async () => {
    const css = await readFile(resolve(root, 'src/web/styles/takosan-tokens.css'), 'utf8');
    expect(css.slice(0, css.indexOf('/* Takolio V1'))).toContain('--semantic-danger: #C93D3D');
    expect(css).toContain('--semantic-focus: #2E7D5B');
    const sw = await readFile(resolve(root, 'public/sw.js'), 'utf8');
    expect(sw).toContain("const BUILD_ID = '__TAKOSAN_BUILD_ID__'");
    expect(sw).toContain('CACHE_NAME = `takosan-pwa-${BUILD_ID}`');
    expect(sw).toContain("url.pathname.startsWith('/takosan/')");
    expect(sw).toContain("url.pathname.startsWith('/takolio/')");
    for (const [, path] of sw.matchAll(/'(\/(?:takolio|takosan)\/[^']+)'/g)) {
      if (path.endsWith('/')) continue;
      expect((await readFile(resolve(root, 'public', '.' + path))).length).toBeGreaterThan(0);
    }
  });
});
