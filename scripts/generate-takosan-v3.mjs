import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const V3_COLORS = { coral: '#FF7B6B', green: '#2E7D5B', ink: '#202C28', cream: '#FFF8F3', yellow: '#FFC857', mint: '#DFF4E6', white: '#FFFFFF' };
export const V3_ICON_SIZES = [16, 24, 32, 48, 64, 128, 180, 192, 256, 512];
const inner = (source) => source.replace(/^<svg[^>]+>/, '').replace(/<\/svg>\s*$/, '');
const svg = (width, height, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>\n`;

/** Preserve the supplied paths; adjust composition, optical margins and safe zones only. */
export async function generateV3(out = resolve(root, 'public/takosan/v3')) {
  const source = resolve(root, 'docs/brand/v3/source');
  const read = (name) => readFile(resolve(source, name), 'utf8');
  const mark = inner(await read('01_logo/svg/symbol-primary.svg'));
  const micro = inner(await read('01_logo/svg/symbol-micro.svg'));
  const word = inner(await read('01_logo/svg/wordmark-primary.svg'));
  const exports = {};
  const frame = (body, x, y, width, height, viewBox) => `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="${viewBox}">${body}</svg>`;
  const silhouette = mark.replace(/<ellipse[^>]*\/>|<circle[^>]*\/>/g, '').replace(/<path d="M239 315[^>]*\/>/, '');
  const monochrome = (color) => `<defs><mask id="face" maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="512"><rect width="512" height="512" fill="white"/><ellipse cx="200" cy="277" rx="15" ry="19" fill="black"/><ellipse cx="312" cy="277" rx="15" ry="19" fill="black"/><path d="M239 315 Q256 334 273 315" stroke="black" stroke-width="7" stroke-linecap="round" fill="none"/></mask></defs><g mask="url(#face)">${silhouette.replace(/#[a-f\d]{6}/gi, color)}</g>`;
  const variants = {
    primary: { mark, word },
    reverse: { mark, word: word.replaceAll(V3_COLORS.ink, V3_COLORS.white) },
    'mono-dark': { mark: monochrome(V3_COLORS.ink), word: word.replaceAll(V3_COLORS.coral, V3_COLORS.ink) },
    'mono-white': { mark: monochrome(V3_COLORS.white), word: word.replace(/#[a-f\d]{6}/gi, V3_COLORS.white) },
  };
  for (const [name, variant] of Object.entries(variants)) {
    exports[`logo/horizontal-${name}.svg`] = svg(300, 72,
      frame(variant.mark, 0, 0, 72, 72, '0 0 512 512') + frame(variant.word, 78, 16, 216, 46, '10 42 656 128'));
    exports[`logo/stacked-${name}.svg`] = svg(240, 220,
      frame(variant.mark, 40, 0, 160, 160, '0 0 512 512') + frame(variant.word, 12, 174, 216, 42, '10 42 656 128'));
    exports[`logo/wordmark-${name}.svg`] = svg(656, 128, `<g transform="translate(-10 -42)">${variant.word}</g>`);
    exports[`logo/symbol-${name}.svg`] = svg(512, 512, variant.mark);
  }
  exports['logo/symbol-micro.svg'] = svg(512, 512, micro);
  exports['logo/symbol-micro-dark.svg'] = svg(512, 512, micro.replaceAll(V3_COLORS.coral, V3_COLORS.cream));
  for (const name of ['happy', 'thinking', 'wink', 'celebrate']) exports[`mascot/tako-${name}.svg`] = await read(`03_mascot/tako-${name}.svg`);
  for (const name of ['home', 'planner', 'recipe', 'fridge', 'shopping', 'scan', 'nutrition', 'budget', 'profile', 'settings', 'favorite', 'search']) exports[`ui-icons/${name}.svg`] = await read(`05_ui_icons/${name}.svg`);
  const regular = svg(512, 512, `<rect width="512" height="512" fill="${V3_COLORS.cream}"/><g transform="translate(32 32) scale(.875)">${mark}</g>`);
  const maskable = svg(512, 512, `<rect width="512" height="512" fill="${V3_COLORS.green}"/><circle cx="256" cy="256" r="150" fill="${V3_COLORS.cream}"/><g transform="translate(121 119) scale(.5275)">${mark}</g>`);
  exports['app-icons/icon-master.svg'] = regular;
  exports['app-icons/icon-maskable.svg'] = maskable;
  exports['app-icons/favicon.svg'] = svg(64, 64, `<rect width="64" height="64" rx="14" fill="${V3_COLORS.cream}"/>` + frame(micro, -2, -14, 68, 82, '0 0 512 512'));
  for (const [name, body] of Object.entries(exports)) {
    await mkdir(dirname(resolve(out, name)), { recursive: true });
    await writeFile(resolve(out, name), body);
  }
  const png = { compressionLevel: 9, adaptiveFiltering: false, palette: false };
  for (const size of V3_ICON_SIZES) {
    await sharp(Buffer.from(size <= 32 ? exports['app-icons/favicon.svg'] : regular)).resize(size, size).flatten({ background: V3_COLORS.cream }).png(png).toFile(resolve(out, `app-icons/icon-${size}.png`));
  }
  await sharp(Buffer.from(maskable)).flatten({ background: V3_COLORS.green }).png(png).toFile(resolve(out, 'app-icons/icon-maskable-512.png'));
  // The validated social raster stays outside JS and needs no runtime font.
  await mkdir(resolve(out, 'social'), { recursive: true });
  await sharp(resolve(root, 'docs/brand/v3/source/og-1200x630.png')).png(png).toFile(resolve(out, 'social/og-1200x630.png'));
  return [...Object.keys(exports), ...V3_ICON_SIZES.map((size) => `app-icons/icon-${size}.png`), 'app-icons/icon-maskable-512.png', 'social/og-1200x630.png'];
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(`V3 exports: ${(await generateV3()).length}`);
