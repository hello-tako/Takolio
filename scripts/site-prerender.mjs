#!/usr/bin/env node
/**
 * True React SSR Prerenderer & Multilingual Sitemap/GEO Generator for `https://takolio.com`.
 * - Executes real React `renderToString` from `dist/site-ssr/entry-server.js` for 100% SSR-to-client parity.
 * - Generates 7-locale core pages, standalone editorial Stories, 6 Cuisine Hubs, and 500 Verified Global Recipes.
 * - Produces partitioned XML sitemaps with bidirectional `xhtml:link hreflang` and localized `llms-*.txt`.
 * - Excludes unused 19.9 MB PNG master artwork from `dist/site/takolio`.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DIST_SITE = path.join(REPO_ROOT, 'dist/site');
const DIST_SSR = path.join(REPO_ROOT, 'dist/site-ssr');
const TEMPLATE_PATH = path.join(DIST_SITE, 'site/index.html');
const SSR_ENTRY_PATH = path.join(DIST_SSR, 'entry-server.js');
const MARKETING_ORIGIN = 'https://takolio.com';
const TODAY_ISO = new Date().toISOString().slice(0, 10);

if (!existsSync(TEMPLATE_PATH)) {
  throw new Error(`Missing built site template at ${TEMPLATE_PATH}. Run "vite build -c vite.site.config.ts" first.`);
}
if (!existsSync(SSR_ENTRY_PATH)) {
  throw new Error(`Missing built SSR entry at ${SSR_ENTRY_PATH}. Run SSR build first.`);
}

const ssr = await import(pathToFileURL(SSR_ENTRY_PATH).href);
const {
  buildHreflangCluster,
  buildLocalizedPath,
  buildRegionalPriceReferences,
  getSiteDictionary,
  loadFull500SiteRecipeCatalog,
  LOCALE_CATALOG,
  renderSiteRoute,
  resolveRouteMeta,
  SUPPORTED_LOCALES,
  toRecipeIndexEntry,
} = ssr;

const baseHtml = readFileSync(TEMPLATE_PATH, 'utf8');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeJsonForScript(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

function buildFontPreloads(locale, lcpPreloadHref) {
  const tags = [
    `<link rel="preload" href="/takolio/v1/fonts/plus-jakarta-sans-vietnamese-latin-wght.woff2" as="font" type="font/woff2" crossorigin />`,
    `<link rel="preload" href="/takolio/fonts/nunito-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin />`,
  ];
  if (locale === 'vi') {
    tags.push(
      `<link rel="preload" href="/takolio/fonts/nunito-vietnamese-wght-normal.woff2" as="font" type="font/woff2" crossorigin />`,
    );
  }
  if (lcpPreloadHref) {
    tags.push(`<link rel="preload" as="image" href="${escapeHtml(lcpPreloadHref)}" fetchpriority="high" />`);
  }
  return tags.join('\n    ');
}

function buildHeadSeoTags(meta) {
  const canonicalUrl = `${MARKETING_ORIGIN}${meta.urlPath}`;
  const ogImageUrl = `${MARKETING_ORIGIN}${meta.ogImage}`;
  const locMeta = LOCALE_CATALOG[meta.locale];
  const robots = meta.noindex
    ? 'noindex, nofollow'
    : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

  const tags = [
    `<title>${escapeHtml(meta.title)}</title>`,
    `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="robots" content="${robots}" />`,
  ];

  // Omit canonical & hreflang on 404/noindex documents
  if (!meta.noindex) {
    tags.push(`<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />`);
    const hreflangLocales = meta.hreflangLocales || SUPPORTED_LOCALES;
    for (const alt of buildHreflangCluster(MARKETING_ORIGIN, meta.barePath, hreflangLocales)) {
      tags.push(`<link rel="alternate" hreflang="${escapeHtml(alt.hreflang)}" href="${escapeHtml(alt.href)}" />`);
    }
  }

  tags.push(
    `<meta property="og:site_name" content="Takolio" />`,
    `<meta property="og:locale" content="${escapeHtml(locMeta.ogLocale)}" />`,
  );
  if (!meta.noindex) {
    const altLocales = (meta.hreflangLocales || SUPPORTED_LOCALES).filter((l) => l !== meta.locale);
    for (const altLoc of altLocales) {
      tags.push(`<meta property="og:locale:alternate" content="${escapeHtml(LOCALE_CATALOG[altLoc].ogLocale)}" />`);
    }
  }

  const ogMime = meta.ogImage.endsWith('.png') ? 'image/png' : 'image/webp';
  tags.push(
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:type" content="${meta.ogType}" />`,
    `<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />`,
    `<meta property="og:image" content="${escapeHtml(ogImageUrl)}" />`,
    `<meta property="og:image:type" content="${ogMime}" />`,
    `<meta property="og:image:alt" content="${escapeHtml(meta.ogImageAlt)}" />`,
    `<meta property="og:image:width" content="${meta.ogImageWidth}" />`,
    `<meta property="og:image:height" content="${meta.ogImageHeight}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />`,
    `<meta name="twitter:image:alt" content="${escapeHtml(meta.ogImageAlt)}" />`,
  );

  if (meta.jsonLd) {
    tags.push(
      `<script type="application/ld+json" data-tkv-seo-ld="1">${safeJsonForScript(meta.jsonLd)}</script>`,
    );
  }

  return tags.join('\n    ');
}

function writeRenderedHtml(urlPath, meta, ssrPayload) {
  const locMeta = LOCALE_CATALOG[meta.locale];
  const appHtml = renderSiteRoute(urlPath, ssrPayload);
  const ssrScript = `<script id="tk-ssr-data" type="application/json">${safeJsonForScript(ssrPayload)}</script>`;

  const html = baseHtml
    .replace(/<html\b[^>]*>/, `<html lang="${locMeta.bcp47}" dir="${locMeta.dir}">`)
    .replace('<!--TAKOLIO_FONT_PRELOADS-->', buildFontPreloads(meta.locale, meta.lcpPreloadHref))
    .replace('<!--TAKOLIO_HEAD_SEO-->', buildHeadSeoTags(meta))
    .replace('<!--TAKOLIO_SSR_OUTLET-->', appHtml)
    .replace('</body>', `${ssrScript}\n  </body>`);

  const outFile =
    urlPath === '/'
      ? path.join(DIST_SITE, 'index.html')
      : urlPath === '/404'
        ? path.join(DIST_SITE, '404.html')
        : path.join(DIST_SITE, urlPath.slice(1), 'index.html');

  mkdirSync(path.dirname(outFile), { recursive: true });
  writeFileSync(outFile, html, 'utf8');
}

// 1. Copy static SEO/GEO root documents + lean runtime media (excluding 19.9 MB PNG masters!)
for (const rootDoc of ['robots.txt', 'llms.txt', 'llms-full.txt']) {
  const src = path.join(REPO_ROOT, 'public', rootDoc);
  if (existsSync(src)) cpSync(src, path.join(DIST_SITE, rootDoc));
}

function shouldIncludeTakolioAsset(srcPath) {
  const rel = path.relative(path.join(REPO_ROOT, 'public/takolio'), srcPath);
  if (!rel) return true;
  const stat = statSync(srcPath);
  if (stat.isDirectory()) {
    // Skip unused PNG master archives and legacy v1 artwork not needed on takolio.com
    return !rel.startsWith('brand-v2/masters') && !rel.startsWith('v1/app-icons') && !rel.startsWith('v1/social');
  }
  // Keep all WebP, WOFF2, SVG, and our Brand Board v2 PNG OG/PWA exports; skip raw master PNGs
  if (rel.endsWith('.png')) {
    return rel.startsWith('brand-v2/social/') || rel.startsWith('brand-v2/pwa/') || rel.startsWith('vnext/pwa/');
  }
  return true;
}

cpSync(path.join(REPO_ROOT, 'public/takolio'), path.join(DIST_SITE, 'takolio'), {
  recursive: true,
  filter: shouldIncludeTakolioAsset,
});

// Copy global & Vietnam culinary photography WebPs for the 500-recipe directory
const frigoRecipesSrc = path.join(REPO_ROOT, 'public/frigo/recipes');
if (existsSync(frigoRecipesSrc)) {
  cpSync(frigoRecipesSrc, path.join(DIST_SITE, 'frigo/recipes'), { recursive: true });
}

// 2. Load all 500 verified global recipes & write compact client index + per-slug JSON
const allRecipes = loadFull500SiteRecipeCatalog(REPO_ROOT);
const allIndexEntries = allRecipes.map(toRecipeIndexEntry);
const cuisineCounts = {};
for (const r of allRecipes) {
  cuisineCounts[r.cuisine] = (cuisineCounts[r.cuisine] || 0) + 1;
}

writeFileSync(
  path.join(DIST_SITE, 'recipes-index.json'),
  JSON.stringify({ total: allIndexEntries.length, cuisineCounts, recipes: allIndexEntries }),
  'utf8',
);

const recipesDataDir = path.join(DIST_SITE, 'recipes-data');
mkdirSync(recipesDataDir, { recursive: true });
for (const recipe of allRecipes) {
  const related = allIndexEntries
    .filter((entry) => entry.cuisine === recipe.cuisine && entry.slug !== recipe.slug)
    .slice(0, 4);
  writeFileSync(
    path.join(recipesDataDir, `${recipe.slug}.json`),
    JSON.stringify({ recipe, relatedRecipes: related }),
    'utf8',
  );
}

// Authoritative server-truth VND pricing snapshot for SSR initial state
const DEFAULT_VND_PRICES = { monthly: 49000, annual: 499000 };
const SSR_PRICING_SNAPSHOT = {
  plans: [
    { plan: 'monthly', amountVnd: DEFAULT_VND_PRICES.monthly, currency: 'VND' },
    { plan: 'annual', amountVnd: DEFAULT_VND_PRICES.annual, currency: 'VND' },
  ],
  regionalCatalog: buildRegionalPriceReferences(DEFAULT_VND_PRICES),
};

// 3. Prerender ALL core pages + 6 Cuisine Hubs + 6 standalone Stories across ALL 7 locales
const CORE_BARE_PATHS = [
  '/',
  '/how-it-works',
  '/features/ai-scan',
  '/features/fridge',
  '/features/meal-planning',
  '/features/recipes',
  '/features/cooking',
  '/features/shopping',
  '/pricing',
  '/faq',
  '/stories',
  '/recipes',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
];

const CUISINES = ['vietnamese', 'chinese', 'japanese', 'korean', 'thai', 'italian'];
const STORY_SLUGS = getSiteDictionary('vi').stories.guides.map((g) => g.slug);

let renderedCount = 0;

for (const locale of SUPPORTED_LOCALES) {
  // Core pages
  for (const barePath of CORE_BARE_PATHS) {
    const urlPath = buildLocalizedPath(locale, barePath);
    const meta = resolveRouteMeta(locale, barePath);
    const payload = {
      locale,
      ...(barePath === '/pricing' ? { pricing: SSR_PRICING_SNAPSHOT } : {}),
      ...(barePath === '/recipes'
        ? {
            recipesTotal: allIndexEntries.length,
            cuisineCounts,
            recipesPreview: allIndexEntries.slice(0, 24),
            activeCuisine: 'all',
          }
        : {}),
    };
    writeRenderedHtml(urlPath, meta, payload);
    renderedCount++;
  }

  // 6 Cuisine Hubs per locale
  for (const cuisine of CUISINES) {
    const barePath = `/recipes/cuisine/${cuisine}`;
    const urlPath = buildLocalizedPath(locale, barePath);
    const meta = resolveRouteMeta(locale, barePath);
    const payload = {
      locale,
      recipesTotal: allIndexEntries.length,
      cuisineCounts,
      recipesPreview: allIndexEntries.filter((r) => r.cuisine === cuisine).slice(0, 24),
      activeCuisine: cuisine,
    };
    writeRenderedHtml(urlPath, meta, payload);
    renderedCount++;
  }

  // 6 Standalone Editorial Stories per locale
  for (const slug of STORY_SLUGS) {
    const barePath = `/stories/${slug}`;
    const urlPath = buildLocalizedPath(locale, barePath);
    const meta = resolveRouteMeta(locale, barePath);
    writeRenderedHtml(urlPath, meta, { locale });
    renderedCount++;
  }
}

// 4. Prerender ALL 500 Verified Global Recipes in VI & EN (1,000 pSEO Recipe pages!)
//    + top 24 curated cross-cuisine recipes across Tier-2 locales (ja, ko, th, zh, it)
const TIER2_LOCALES = SUPPORTED_LOCALES.filter((l) => l !== 'vi' && l !== 'en');
const TIER2_FEATURED_SLUGS = new Set([
  ...allRecipes.filter((r) => r.cuisine === 'vietnamese').slice(0, 4).map((r) => r.slug),
  ...allRecipes.filter((r) => r.cuisine === 'japanese').slice(0, 4).map((r) => r.slug),
  ...allRecipes.filter((r) => r.cuisine === 'korean').slice(0, 4).map((r) => r.slug),
  ...allRecipes.filter((r) => r.cuisine === 'chinese').slice(0, 4).map((r) => r.slug),
  ...allRecipes.filter((r) => r.cuisine === 'thai').slice(0, 4).map((r) => r.slug),
  ...allRecipes.filter((r) => r.cuisine === 'italian').slice(0, 4).map((r) => r.slug),
]);

for (const recipe of allRecipes) {
  const barePath = `/recipes/${recipe.slug}`;
  const isFeaturedTier2 = TIER2_FEATURED_SLUGS.has(recipe.slug);
  const targetLocales = isFeaturedTier2 ? SUPPORTED_LOCALES : ['vi', 'en'];
  const relatedRecipes = allIndexEntries
    .filter((entry) => entry.cuisine === recipe.cuisine && entry.slug !== recipe.slug)
    .slice(0, 4);

  for (const locale of targetLocales) {
    const urlPath = buildLocalizedPath(locale, barePath);
    const meta = {
      ...resolveRouteMeta(locale, barePath, recipe),
      hreflangLocales: targetLocales,
    };
    writeRenderedHtml(urlPath, meta, { locale, recipe, relatedRecipes });
    renderedCount++;
  }
}

// 5. Emit clean 404.html (HTTP 404, noindex, nofollow, NO canonical/hreflang)
writeRenderedHtml('/404', resolveRouteMeta('vi', '/404'), { locale: 'vi' });
renderedCount++;

// 6. Generate Language-Partitioned XML Sitemaps (100% same-domain `takolio.com`, 0 `noindex` URLs!)
function xmlEscape(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildUrlBlock(locUrl, barePath, locales, imageInfo = null) {
  const alternates = buildHreflangCluster(MARKETING_ORIGIN, barePath, locales)
    .map((alt) => `    <xhtml:link rel="alternate" hreflang="${xmlEscape(alt.hreflang)}" href="${xmlEscape(alt.href)}" />`)
    .join('\n');
  const imgBlock = imageInfo
    ? `\n    <image:image>\n      <image:loc>${xmlEscape(imageInfo.loc)}</image:loc>\n      <image:title>${xmlEscape(imageInfo.title)}</image:title>\n    </image:image>`
    : '';
  return `  <url>\n    <loc>${xmlEscape(locUrl)}</loc>\n    <lastmod>${TODAY_ISO}</lastmod>\n${alternates}${imgBlock}\n  </url>`;
}

function wrapUrlset(blocks) {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    '        xmlns:xhtml="http://www.w3.org/1999/xhtml"',
    '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">',
    ...blocks,
    '</urlset>',
    '',
  ].join('\n');
}

// 6a. sitemap-pages.xml (Core pages + Cuisine hubs × 7 locales)
const pageBlocks = [];
for (const barePath of [...CORE_BARE_PATHS, ...CUISINES.map((c) => `/recipes/cuisine/${c}`)]) {
  for (const locale of SUPPORTED_LOCALES) {
    const locUrl = `${MARKETING_ORIGIN}${buildLocalizedPath(locale, barePath)}`;
    const meta = resolveRouteMeta(locale, barePath);
    pageBlocks.push(
      buildUrlBlock(locUrl, barePath, SUPPORTED_LOCALES, {
        loc: `${MARKETING_ORIGIN}${meta.ogImage}`,
        title: meta.ogImageAlt,
      }),
    );
  }
}
writeFileSync(path.join(DIST_SITE, 'sitemap-pages.xml'), wrapUrlset(pageBlocks), 'utf8');

// 6b. sitemap-stories.xml (6 standalone Stories × 7 locales)
const storyBlocks = [];
for (const slug of STORY_SLUGS) {
  const barePath = `/stories/${slug}`;
  for (const locale of SUPPORTED_LOCALES) {
    const locUrl = `${MARKETING_ORIGIN}${buildLocalizedPath(locale, barePath)}`;
    const guide = getSiteDictionary(locale).stories.guides.find((g) => g.slug === slug);
    storyBlocks.push(
      buildUrlBlock(locUrl, barePath, SUPPORTED_LOCALES, {
        loc: `${MARKETING_ORIGIN}${guide.coverSrc}`,
        title: guide.title,
      }),
    );
  }
}
writeFileSync(path.join(DIST_SITE, 'sitemap-stories.xml'), wrapUrlset(storyBlocks), 'utf8');

// 6c. sitemap-recipes-vi.xml & sitemap-recipes-en.xml (all 500 recipes in VI + 500 in EN + Tier-2 featured)
const recipeViBlocks = [];
const recipeEnBlocks = [];
const recipeGlobalBlocks = [];

for (const recipe of allRecipes) {
  const barePath = `/recipes/${recipe.slug}`;
  const localesForSlug = TIER2_FEATURED_SLUGS.has(recipe.slug) ? SUPPORTED_LOCALES : ['vi', 'en'];
  const imgLoc = `${MARKETING_ORIGIN}${recipe.imageUrl}`;

  recipeViBlocks.push(
    buildUrlBlock(`${MARKETING_ORIGIN}${buildLocalizedPath('vi', barePath)}`, barePath, localesForSlug, {
      loc: imgLoc,
      title: recipe.titleVi,
    }),
  );
  recipeEnBlocks.push(
    buildUrlBlock(`${MARKETING_ORIGIN}${buildLocalizedPath('en', barePath)}`, barePath, localesForSlug, {
      loc: imgLoc,
      title: recipe.titleEn,
    }),
  );

  if (TIER2_FEATURED_SLUGS.has(recipe.slug)) {
    for (const loc of TIER2_LOCALES) {
      recipeGlobalBlocks.push(
        buildUrlBlock(`${MARKETING_ORIGIN}${buildLocalizedPath(loc, barePath)}`, barePath, localesForSlug, {
          loc: imgLoc,
          title: recipe.titleEn,
        }),
      );
    }
  }
}

writeFileSync(path.join(DIST_SITE, 'sitemap-recipes-vi.xml'), wrapUrlset(recipeViBlocks), 'utf8');
writeFileSync(path.join(DIST_SITE, 'sitemap-recipes-en.xml'), wrapUrlset(recipeEnBlocks), 'utf8');
writeFileSync(path.join(DIST_SITE, 'sitemap-recipes-global.xml'), wrapUrlset(recipeGlobalBlocks), 'utf8');

// 6d. Root sitemap.xml (Sitemap Index)
const sitemapIndexXml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  `  <sitemap><loc>${MARKETING_ORIGIN}/sitemap-pages.xml</loc><lastmod>${TODAY_ISO}</lastmod></sitemap>`,
  `  <sitemap><loc>${MARKETING_ORIGIN}/sitemap-stories.xml</loc><lastmod>${TODAY_ISO}</lastmod></sitemap>`,
  `  <sitemap><loc>${MARKETING_ORIGIN}/sitemap-recipes-vi.xml</loc><lastmod>${TODAY_ISO}</lastmod></sitemap>`,
  `  <sitemap><loc>${MARKETING_ORIGIN}/sitemap-recipes-en.xml</loc><lastmod>${TODAY_ISO}</lastmod></sitemap>`,
  `  <sitemap><loc>${MARKETING_ORIGIN}/sitemap-recipes-global.xml</loc><lastmod>${TODAY_ISO}</lastmod></sitemap>`,
  '</sitemapindex>',
  '',
].join('\n');
writeFileSync(path.join(DIST_SITE, 'sitemap.xml'), sitemapIndexXml, 'utf8');
writeFileSync(path.join(REPO_ROOT, 'public/sitemap.xml'), sitemapIndexXml, 'utf8');

// 7. Emit localized `llms-en.txt` & `llms-vi.txt`
const enDict = getSiteDictionary('en');
const viDict = getSiteDictionary('vi');
writeFileSync(
  path.join(DIST_SITE, 'llms-en.txt'),
  [
    `# ${enDict.brand.siteNameFull}`,
    '',
    `> ${enDict.landing.tldrBody}`,
    '',
    `- Home: ${MARKETING_ORIGIN}/en`,
    `- How It Works: ${MARKETING_ORIGIN}/en/how-it-works`,
    `- 500 Verified Global Recipes: ${MARKETING_ORIGIN}/en/recipes`,
    `- Pricing (Free 0 VND; Pro 49,000 VND/month or 499,000 VND/year): ${MARKETING_ORIGIN}/en/pricing`,
    `- FAQ: ${MARKETING_ORIGIN}/en/faq`,
    `- Kitchen Stories: ${MARKETING_ORIGIN}/en/stories`,
    `- Interactive Kitchen App: https://takolio.app?lang=en`,
    `- Full Context: ${MARKETING_ORIGIN}/llms-full.txt`,
    '',
    '## Verified Recipe Counts by Cuisine (500 Total)',
    ...Object.entries(cuisineCounts).map(([c, n]) => `- ${enDict.recipes.cuisineLabels[c] || c}: ${n} recipes (${MARKETING_ORIGIN}/en/recipes/cuisine/${c})`),
    '',
  ].join('\n'),
  'utf8',
);

writeFileSync(
  path.join(DIST_SITE, 'llms-vi.txt'),
  [
    `# ${viDict.brand.siteNameFull}`,
    '',
    `> ${viDict.landing.tldrBody}`,
    '',
    `- Trang chủ: ${MARKETING_ORIGIN}/`,
    `- Cách hoạt động: ${MARKETING_ORIGIN}/how-it-works`,
    `- Kho 500 công thức 6 nền ẩm thực: ${MARKETING_ORIGIN}/recipes`,
    `- Bảng giá (Miễn phí 0 VND; Takolio Pro 49.000 VND/tháng hoặc 499.000 VND/năm): ${MARKETING_ORIGIN}/pricing`,
    `- Câu hỏi thường gặp (FAQ): ${MARKETING_ORIGIN}/faq`,
    `- Cẩm nang bếp (Stories): ${MARKETING_ORIGIN}/stories`,
    `- Ứng dụng bếp tương tác: https://takolio.app?lang=vi`,
    `- Hồ sơ đầy đủ cho AI (Full Context): ${MARKETING_ORIGIN}/llms-full.txt`,
    '',
    '## Thống kê kho 500 công thức xác minh theo 6 nền ẩm thực',
    ...Object.entries(cuisineCounts).map(([c, n]) => `- ${viDict.recipes.cuisineLabels[c] || c}: ${n} món (${MARKETING_ORIGIN}/recipes/cuisine/${c})`),
    '',
  ].join('\n'),
  'utf8',
);

// Remove intermediate build folders
rmSync(path.join(DIST_SITE, 'site'), { recursive: true, force: true });
rmSync(DIST_SSR, { recursive: true, force: true });

console.log(
  JSON.stringify({
    status: 'OK',
    outDir: 'dist/site',
    locales: SUPPORTED_LOCALES,
    totalRecipesCatalog: allRecipes.length,
    cuisineCounts,
    prerenderedHtmlPages: renderedCount,
    sitemaps: [
      'sitemap.xml',
      'sitemap-pages.xml',
      'sitemap-stories.xml',
      'sitemap-recipes-vi.xml',
      'sitemap-recipes-en.xml',
      'sitemap-recipes-global.xml',
    ],
    geoDocs: ['robots.txt', 'llms.txt', 'llms-en.txt', 'llms-vi.txt', 'llms-full.txt'],
  }),
);
