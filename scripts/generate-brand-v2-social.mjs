#!/usr/bin/env node
/**
 * Generates deterministic Brand Board v2 Social OG cards (1200x630 PNG + WebP, VI & EN)
 * and Bé Mầm Bếp favicon/apple-touch icons from committed Brand Board v2 raster masters.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SOCIAL_DIR = path.join(REPO_ROOT, 'public/takolio/brand-v2/social');
const PWA_DIR = path.join(REPO_ROOT, 'public/takolio/brand-v2/pwa');

mkdirSync(SOCIAL_DIR, { recursive: true });
mkdirSync(PWA_DIR, { recursive: true });

const LOGO_SRC = path.join(REPO_ROOT, 'public/takolio/brand-v2/brand/takolio-logo-mark-512.png');
const HERO_SRC = path.join(REPO_ROOT, 'public/takolio/brand-v2/mascot/bemam-hero-kitchen.webp');
const PWA_MASTER = path.join(REPO_ROOT, 'public/takolio/vnext/pwa/pwa-icon-512.png');

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function generateOgCard({ filenameBase, badge, headlineLine1, headlineLine2, slogan, subline, domain }) {
  const width = 1200;
  const height = 630;

  // Prepare rounded right-side kitchen hero artwork (540x430)
  const heroW = 530;
  const heroH = 420;
  const heroMask = Buffer.from(
    `<svg width="${heroW}" height="${heroH}" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="${heroW}" height="${heroH}" rx="32" ry="32" fill="#fff"/></svg>`,
  );
  const heroRounded = await sharp(HERO_SRC)
    .resize(heroW, heroH, { fit: 'cover', position: 'centre' })
    .composite([{ input: heroMask, blend: 'dest-in' }])
    .png()
    .toBuffer();

  // Prepare logo mark (80x80)
  const logoBuf = await sharp(LOGO_SRC).resize(76, 76, { fit: 'contain' }).png().toBuffer();

  const overlaySvg = Buffer.from(`<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFF9F1" />
      <stop offset="65%" stop-color="#FFF9F1" />
      <stop offset="100%" stop-color="#E7F4EC" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" fill="url(#bg)" />
  <rect x="24" y="24" width="${width - 48}" height="${height - 48}" rx="36" fill="none" stroke="#BDE0CC" stroke-width="2" />
  <circle cx="1090" cy="80" r="140" fill="#E7F4EC" opacity="0.65" />
  <circle cx="120" cy="560" r="110" fill="#FFF0E9" opacity="0.7" />
  <!-- Right hero frame border -->
  <rect x="614" y="99" width="542" height="432" rx="36" fill="#E7F4EC" stroke="#BDE0CC" stroke-width="2.5" />
  <!-- Brand wordmark next to logo -->
  <text x="158" y="128" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="38" font-weight="800" fill="#196149" letter-spacing="-0.8">Takolio</text>
  <!-- Category pill -->
  <rect x="64" y="170" width="388" height="38" rx="19" fill="#E7F4EC" stroke="#BDE0CC" stroke-width="1.5" />
  <circle cx="88" cy="189" r="5" fill="#196149" />
  <text x="104" y="195" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="16" font-weight="700" fill="#196149">${escapeXml(badge)}</text>
  <!-- Headline -->
  <text x="64" y="286" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="60" font-weight="900" fill="#196149" letter-spacing="-1.4">${escapeXml(headlineLine1)}</text>
  <text x="64" y="356" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="60" font-weight="900" fill="#F46B52" letter-spacing="-1.4">${escapeXml(headlineLine2)}</text>
  <!-- Slogan badge -->
  <rect x="64" y="388" width="446" height="48" rx="24" fill="#FFF0E9" stroke="#FAD0C4" stroke-width="1.5" />
  <text x="90" y="419" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="22" font-weight="800" fill="#B33A22">${escapeXml(slogan)}</text>
  <!-- Subline -->
  <text x="64" y="484" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="20" font-weight="600" fill="#3C5954">${escapeXml(subline)}</text>
  <!-- Domain footer -->
  <rect x="64" y="520" width="210" height="44" rx="22" fill="#196149" />
  <text x="96" y="548" font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="19" font-weight="800" fill="#FFFFFF">${escapeXml(domain)}</text>
</svg>`);

  const base = sharp(overlaySvg).composite([
    { input: logoBuf, left: 64, top: 76 },
    { input: heroRounded, left: 620, top: 105 },
  ]);

  await base.clone().png({ compressionLevel: 9 }).toFile(path.join(SOCIAL_DIR, `${filenameBase}.png`));
  await base.clone().webp({ quality: 88 }).toFile(path.join(SOCIAL_DIR, `${filenameBase}.webp`));
}

await generateOgCard({
  filenameBase: 'og-1200x630',
  badge: 'Trợ lý bếp gia đình thông minh với AI',
  headlineLine1: 'Bữa ngon,',
  headlineLine2: 'nhẹ đầu.',
  slogan: 'Ăn đủ. Mua đủ. Dùng hết.',
  subline: 'Tủ lạnh FEFO · 500 công thức · Thực đơn 7 ngày',
  domain: 'takolio.com',
});

await generateOgCard({
  filenameBase: 'og-en-1200x630',
  badge: 'Smart AI Family Kitchen Assistant',
  headlineLine1: 'Good meals,',
  headlineLine2: 'light mind.',
  slogan: 'Eat enough. Buy enough. Use it all.',
  subline: 'FEFO Fridge · 500 Global Recipes · 7-Day Planner',
  domain: 'takolio.com/en',
});

// Brand Board v2 Bé Mầm Bếp PWA / Favicon icon set
for (const size of [32, 180, 192, 512]) {
  await sharp(PWA_MASTER)
    .resize(size, size, { fit: 'cover' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(PWA_DIR, `icon-${size}.png`));
}

console.log('Generated Brand Board v2 OG cards (VI & EN, PNG + WebP) and PWA icons successfully.');
