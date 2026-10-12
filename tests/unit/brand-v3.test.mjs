import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { generateV3, V3_ICON_SIZES, V3_COLORS } from '../../scripts/generate-takosan-v3.mjs';

const root = resolve(import.meta.dirname, '../..');
const runtime = resolve(root, 'public/takosan/v3');
describe('V3 canonical production identity', () => {
  it('reproduces all runtime exports byte-for-byte from committed masters', async () => {
    const out = await mkdtemp(resolve(tmpdir(), 'takosan-v3-'));
    const files = await generateV3(out);
    expect(files.length).toBe(49);
    for (const file of files) expect(await readFile(resolve(out, file)), file).toEqual(await readFile(resolve(runtime, file)));
  });
  it('keeps every maskable foreground pixel inside the launcher safe circle', async () => {
    const { data, info } = await sharp(resolve(runtime, 'app-icons/icon-maskable-512.png')).raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height, info.channels]).toEqual([512, 512, 3]);
    let painted = 0, maxRadius = 0;
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      const offset = (y * 512 + x) * 3;
      if ([46, 125, 91].some((color, channel) => Math.abs(data[offset + channel] - color) > 3)) {
        painted++;
        maxRadius = Math.max(maxRadius, Math.hypot(x + .5 - 256, y + .5 - 256));
      }
    }
    expect(painted).toBeGreaterThan(10000);
    expect(maxRadius).toBeLessThanOrEqual(204.8);
  });
  it('exports opaque PNGs at declared sizes, and true one-ink reverse/mono artwork', async () => {
    for (const size of V3_ICON_SIZES) {
      const meta = await sharp(resolve(runtime, `app-icons/icon-${size}.png`)).metadata();
      expect([meta.width, meta.height, meta.hasAlpha]).toEqual([size, size, false]);
    }
    for (const name of ['horizontal', 'stacked', 'symbol', 'wordmark']) for (const suffix of ['mono-dark', 'mono-white']) {
      const source = await readFile(resolve(runtime, `logo/${name}-${suffix}.svg`), 'utf8');
      // Mask paint is only alpha construction. Visible ink must be a single colour.
      const visible = source.replace(/<defs>[\s\S]*?<\/defs>/g, '');
      const colors = [...visible.matchAll(/(?:fill|stroke)="(#[a-f\d]{6})"/ig)].map((m) => m[1]);
      expect(new Set(colors)).toEqual(new Set([suffix === 'mono-dark' ? V3_COLORS.ink : V3_COLORS.white]));
      expect(source).not.toMatch(/<(script|text|image|foreignObject)|(?:href|onload)=/i);
      expect(source.matchAll(/url\(([^)]+)\)/g).toArray().every((m) => m[1] === '#face')).toBe(true);
    }
  });
  it('has licensed local variable fonts with exact recorded hashes', async () => {
    const fonts = resolve(runtime, 'fonts');
    const manifest = JSON.parse(await readFile(resolve(fonts, 'manifest.json'), 'utf8'));
    expect(manifest.map((m) => m.file)).toHaveLength(3);
    for (const item of manifest) expect(createHash('sha256').update(await readFile(resolve(fonts, item.file))).digest('hex')).toBe(item.sha256);
    expect(await readFile(resolve(fonts, 'OFL.txt'), 'utf8')).toContain('SIL OPEN FONT LICENSE Version 1.1');
    const css = await readFile(resolve(root, 'src/web/styles/brand-v3-fonts.css'), 'utf8');
    expect(css).toContain('font-weight: 200 1000');
    expect(css).toContain('U+1EA0-1EF9');
    expect(css).toContain('font-display: swap');
  });
  it('keeps previews/source/native outside public and only V3 paths in the new precache', async () => {
    expect(await readdir(runtime)).not.toContain('source');
    expect(await readdir(runtime)).not.toContain('native');
    const sw = await readFile(resolve(root, 'public/sw.js'), 'utf8');
    const precache = sw.slice(sw.indexOf('const STATIC_PRECACHE'), sw.indexOf('self.addEventListener'));
    expect(precache).not.toContain('/takosan/rebuild/');
    expect(precache).not.toContain('/takosan/brand/');
    const paths = [...precache.matchAll(/'(\/takosan\/[^']+)'/g)].map((m) => m[1]);
    for (const path of paths) expect((await readFile(resolve(root, 'public', '.' + path))).length).toBeGreaterThan(0);
  });
});
