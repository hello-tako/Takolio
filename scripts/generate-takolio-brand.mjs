import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(root, 'docs/brand/takolio/v1/source');
export const TAKOLIO_ICON_SIZES = [16, 24, 32, 48, 64, 128, 180, 192, 256, 512];
export const TAKOLIO_COLORS = { coral: '#FF6B6B', navy: '#0F2D46', gold: '#F7C15A', green: '#4CAF6B', cream: '#FFF8ED' };
const inner = (s) => s.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const svg = (w, h, body, viewBox = `0 0 ${w} ${h}`) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${viewBox}">${body}</svg>\n`;
const read = (p) => readFile(resolve(source, p), 'utf8');
const png = { compressionLevel: 9, adaptiveFiltering: false, palette: false };
const sha256 = (data) => createHash('sha256').update(data).digest('hex');

async function outlined(sourceSvg) {
  const texts = [...sourceSvg.matchAll(/<text([^>]*)>([^<]*)<\/text>/g)];
  for (const [element, attributes, text] of texts) {
    const name = text === '?' ? 'question' : text.startsWith('Lên') ? 'tagline-vi' : 'tagline-en';
    const attr = (name) => attributes.match(new RegExp(`${name}="([^"]+)"`))?.[1];
    const size = Number(attr('font-size'));
    // Font outlines have a 1000-unit em with the baseline at y=1000.
    const path = inner(await read(`typography/${name}.svg`));
    sourceSvg = sourceSvg.replace(element, `<g fill="${attr('fill')}" transform="translate(${attr('x')} ${Number(attr('y')) - size}) scale(${size / 1000})">${path}</g>`);
  }
  return sourceSvg;
}

async function normalized(sourceSvg, padding) {
  const { data, info } = await sharp(Buffer.from(sourceSvg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let left = info.width, top = info.height, right = 0, bottom = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 0) {
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
    }
  }
  const width = right - left + padding * 2, height = bottom - top + padding * 2;
  return svg(width, height, inner(sourceSvg), `${left - padding} ${top - padding} ${width} ${height}`);
}

/** Offline, pinned-source exports. Old V3 sources and URLs are never overwritten. */
export async function generateTakolio(out = resolve(root, 'public/takolio/v1')) {
  const files = new Map();
  const put = (path, bytes) => files.set(path, typeof bytes === 'string' ? Buffer.from(bytes) : bytes);
  const logoMap = {
    primary: 'primary', horizontal: 'horizontal-primary', stacked: 'stacked-primary', wordmark: 'wordmark-primary',
    'monochrome-navy': 'wordmark-mono-dark', 'monochrome-white': 'wordmark-mono-white',
    'icon-only': 'symbol-primary', 'on-coral': 'wordmark-on-coral', 'on-cream': 'wordmark-on-cream', 'on-navy': 'wordmark-on-navy',
  };
  for (const [name, target] of Object.entries(logoMap)) {
    const original = await outlined(await read(`02_Logo/takolio-logo-${name}.svg`));
    put(`logo/${target}.svg`, await normalized(original, name === 'icon-only' ? 16 : 53));
  }
  const horizontal = files.get('logo/horizontal-primary.svg').toString();
  const stacked = files.get('logo/stacked-primary.svg').toString();
  for (const [name, original] of [['horizontal', horizontal], ['stacked', stacked]]) {
    const reverse = original.replace(/(<g (?:transform="[^"]+" )?fill=")#0F2D46(")/g, '$1#FFFFFF$2');
    put(`logo/${name}-reverse.svg`, reverse);
    // One-ink lockups use wordmark master counters and an alpha knockout face.
    for (const [suffix, ink] of [['mono-dark', TAKOLIO_COLORS.navy], ['mono-white', '#FFFFFF']]) {
      const word = files.get(`logo/wordmark-${suffix}.svg`).toString();
      const micro = inner(await read('micro.svg'));
      const silhouette = micro.replace(/<ellipse cx="410"[\s\S]*$/, '').replaceAll(TAKOLIO_COLORS.coral, ink).replaceAll(TAKOLIO_COLORS.cream, ink).replaceAll(TAKOLIO_COLORS.green, ink).replaceAll(TAKOLIO_COLORS.navy, ink);
      const symbol = `<defs><mask id="face"><rect width="1024" height="1024" fill="white"/><ellipse cx="410" cy="500" rx="32" ry="44" fill="black"/><path d="M582 509Q627 467 675 508M469 595Q512 650 562 595" fill="none" stroke="black" stroke-width="28" stroke-linecap="round"/></mask></defs><g mask="url(#face)">${silhouette}</g>`;
      const wordFrame = `<svg x="${name === 'horizontal' ? 76 : 10}" y="${name === 'horizontal' ? 0 : 160}" width="${name === 'horizontal' ? 224 : 220}" height="${name === 'horizontal' ? 100 : 110}" viewBox="${word.match(/viewBox="([^"]+)"/)[1]}">${inner(word)}</svg>`;
      const markFrame = `<svg x="${name === 'horizontal' ? 0 : 35}" y="0" width="${name === 'horizontal' ? 80 : 170}" height="${name === 'horizontal' ? 100 : 170}" viewBox="0 0 1024 1024">${symbol}</svg>`;
      put(`logo/${name}-${suffix}.svg`, svg(name === 'horizontal' ? 300 : 240, name === 'horizontal' ? 100 : 270, markFrame + wordFrame));
    }
  }
  put('logo/symbol-micro.svg', await read('micro.svg'));
  const poseNames = ['welcome', 'cooking', 'thinking', 'excited', 'completed', 'cheering', 'master-front', 'mascot-side', 'mascot-back', 'mascot-three-quarter'];
  for (const name of poseNames) put(`mascot/tako-${name}.svg`, await outlined(await read(`03_Mascot/takolio-mascot-${name}.svg`)));
  for (const file of (await readdir(resolve(source, '05_UI_Icons'))).sort()) put(`ui-icons/${file.replace('takolio-icon-', '')}`, await read(`05_UI_Icons/${file}`));
  put('ui-icons/scan-label-reverse.svg', (await read('05_UI_Icons/takolio-icon-scan-label.svg')).replaceAll(TAKOLIO_COLORS.navy, '#FFFFFF'));
  // No home artwork is invented: the existing home semantic maps to the meal-plan icon.
  const regular = await read('04_App_Icons/takolio-appicon-primary.svg');
  const foreground = await read('04_App_Icons/takolio-android-adaptive-foreground.svg');
  const maskable = svg(1024, 1024, `<rect width="1024" height="1024" fill="${TAKOLIO_COLORS.coral}"/>${inner(foreground)}`);
  const micro = svg(1024, 1024, `<rect width="1024" height="1024" fill="${TAKOLIO_COLORS.cream}"/>${inner(await read('micro.svg'))}`);
  put('app-icons/icon-master.svg', regular);
  put('app-icons/icon-maskable.svg', maskable);
  put('app-icons/favicon.svg', micro);
  put('app-icons/android-adaptive-foreground.svg', foreground);
  put('app-icons/android-adaptive-background.svg', svg(1024, 1024, `<rect width="1024" height="1024" fill="${TAKOLIO_COLORS.coral}"/>`));
  for (const size of TAKOLIO_ICON_SIZES) put(`app-icons/icon-${size}.png`, await sharp(Buffer.from(size <= 32 ? micro : regular)).resize(size, size).flatten({ background: TAKOLIO_COLORS.coral }).png(png).toBuffer());
  for (const [file, size, src] of [['icon-maskable-512.png', 512, maskable], ['ios-1024.png', 1024, regular], ['googleplay-512.png', 512, regular]]) put(`app-icons/${file}`, await sharp(Buffer.from(src)).resize(size, size).flatten({ background: TAKOLIO_COLORS.coral }).png(png).toBuffer());
  put('app-icons/android-adaptive-foreground-432.png', await sharp(Buffer.from(foreground)).resize(432, 432).png(png).toBuffer());
  const ogLogo = await sharp(files.get('logo/horizontal-primary.svg')).resize({ width: 1080, height: 500, fit: 'inside' }).png().toBuffer();
  put('social/og-1200x630.png', await sharp({ create: { width: 1200, height: 630, channels: 3, background: TAKOLIO_COLORS.cream } }).composite([{ input: ogLogo, gravity: 'centre' }]).png(png).toBuffer());
  for (const file of ['plus-jakarta-sans-vietnamese-latin-wght.woff2', 'Plus-Jakarta-Sans-OFL.txt']) put(`fonts/${file}`, await readFile(resolve(source, 'fonts', file)));
  // Pinned authoring renders keep native Blender/GPU work outside runtime and CI.
  const renders = JSON.parse(await read('3d/render-manifest.json'));
  for (const render of renders.files) {
    const input = await readFile(resolve(source, '3d', render.path));
    if (sha256(input) !== render.sha256) throw new Error(`3D master integrity: ${render.path}`);
    for (const size of [256, 512, 1024]) {
      put(`mascot/3d/tako-${render.pose}-${size}.webp`, await sharp(input).resize(size, size).webp({ quality: 84, alphaQuality: 100, effort: 4 }).toBuffer());
    }
  }
  const manifest = [...files].map(([path, data]) => ({ path, bytes: data.length, sha256: sha256(data) }));
  for (const [path, bytes] of files) { await mkdir(dirname(resolve(out, path)), { recursive: true }); await writeFile(resolve(out, path), bytes); }
  await writeFile(resolve(out, 'asset-manifest.json'), JSON.stringify({ generator: 'sharp 0.35.5; offline pinned SVG/path and 3D PNG masters', files: manifest }, null, 2) + '\n');
  return [...files.keys(), 'asset-manifest.json'];
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(`Takolio V1 exports: ${(await generateTakolio()).length}`);
