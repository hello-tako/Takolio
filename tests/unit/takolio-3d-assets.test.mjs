import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const source = resolve(root, 'docs/brand/takolio/v1/source/3d');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

it('pins six genuine alpha render masters with no clipped silhouette', async () => {
  const manifest = JSON.parse(await readFile(resolve(source, 'render-manifest.json'), 'utf8'));
  expect(manifest.files.map((file) => file.pose)).toEqual(['welcome', 'cooking', 'thinking', 'excited', 'completed', 'cheering']);
  expect(manifest.premiumApproved).toBe(false);
  expect(manifest.sourceZipSha256).toBe('d2f77b552c07570d846a20d2602dd3a6c41ebb4fd9c66328234bf86da8ca1142');
  const distinct = new Set();
  for (const file of manifest.files) {
    const bytes = await readFile(resolve(source, file.path));
    expect(hash(bytes), file.pose).toBe(file.sha256);
    distinct.add(file.sha256);
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect([info.width, info.height, info.channels]).toEqual([2048, 2048, 4]);
    let opaque = 0, edgeAlpha = 0;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const alpha = data[(y * info.width + x) * 4 + 3];
      if (alpha === 255) opaque++;
      if (x < 16 || y < 16 || x >= info.width - 16 || y >= info.height - 16) edgeAlpha = Math.max(edgeAlpha, alpha);
    }
    expect(edgeAlpha, file.pose + ': transparent edge').toBe(0);
    expect(opaque).toBeGreaterThan(100000);
    expect(opaque).toBeLessThan(info.width * info.height * .85);
    for (const size of [256, 512, 1024]) {
      const path = resolve(root, `public/takolio/v1/mascot/3d/tako-${file.pose}-${size}.webp`);
      const webp = await readFile(path);
      const metadata = await sharp(webp).metadata();
      expect([metadata.width, metadata.height, metadata.hasAlpha]).toEqual([size, size, true]);
      expect(webp.length).toBeLessThan(size === 1024 ? 200000 : 90000);
    }
  }
  expect(distinct.size).toBe(6);
}, 30000);

it('keeps native 3D work outside the browser and preserves authoring provenance', async () => {
  const manifest = JSON.parse(await readFile(resolve(source, 'render-manifest.json'), 'utf8'));
  for (const file of manifest.authoringFiles) expect(hash(await readFile(resolve(source, file.path)))).toBe(file.sha256);
  const sw = await readFile(resolve(root, 'public/sw.js'), 'utf8');
  expect(sw).not.toMatch(/\.blend|\.glb/);
  expect(sw).toContain('/takolio/v1/mascot/3d/tako-welcome-512.webp');
  expect(sw).toContain('/takolio/v1/mascot/tako-welcome.svg');
});
