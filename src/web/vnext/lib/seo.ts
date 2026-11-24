import { useEffect } from 'react';
import { LOCALE_CATALOG, type SupportedLocale } from '../../../shared/locales';
import { getActiveAppLocale } from '../../i18n/LocaleContext';
import { lSync } from '../../i18n/app-i18n';

export const TAKOLIO_MARKETING_ORIGIN = 'https://takolio.com';
export const TAKOLIO_APP_ORIGIN = 'https://takolio.app';

export type JsonLdNode = Record<string, unknown>;

export interface VNextSeoOptions {
  title: string;
  description: string;
  canonicalPath: string;
  /** Defaults to 'marketing' (`https://takolio.com`) for public site routes and 'app' (`https://takolio.app`) when specified. */
  domainSurface?: 'marketing' | 'app';
  ogType?: 'website' | 'article';
  ogImage?: string;
  ogImageAlt?: string;
  ogImageWidth?: number;
  ogImageHeight?: number;
  lang?: string;
  ogLocale?: string;
  hreflangs?: ReadonlyArray<{ hreflang: string; href: string }>;
  /** Set true on auth, onboarding, private user settings, and error states so crawlers never index private shells. */
  noindex?: boolean;
  /** Optional structured data graph or single schema.org object(s) injected as `<script type="application/ld+json">`. */
  jsonLd?: JsonLdNode | JsonLdNode[] | null;
}

function upsertMeta(selector: string, attrs: Record<string, string>) {
  if (typeof document === 'undefined') return;
  let el = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    document.head.appendChild(el);
  }
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
}

function upsertLink(selector: string, attrs: Record<string, string>) {
  if (typeof document === 'undefined') return;
  let link = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    document.head.appendChild(link);
  }
  for (const [k, v] of Object.entries(attrs)) {
    link.setAttribute(k, v);
  }
}

function upsertJsonLd(payload: JsonLdNode | JsonLdNode[] | null | undefined) {
  if (typeof document === 'undefined') return;
  const selector = 'script[type="application/ld+json"][data-tkv-seo-ld="1"]';
  const existing = document.head.querySelector(selector);
  if (!payload) {
    existing?.remove();
    return;
  }
  const graphBody = Array.isArray(payload)
    ? { '@context': 'https://schema.org', '@graph': payload }
    : { '@context': 'https://schema.org', ...payload };
  let script = existing as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-tkv-seo-ld', '1');
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(graphBody);
}

/**
 * Resolves the canonical origin (`https://takolio.com` for public marketing/editorial,
 * `https://takolio.app` for interactive kitchen app surfaces).
 * Deterministic across hosts so crawlers always consolidate equity to the canonical domain.
 */
export function resolveCanonicalOrigin(surface: 'marketing' | 'app' = 'marketing'): string {
  return surface === 'app' ? TAKOLIO_APP_ORIGIN : TAKOLIO_MARKETING_ORIGIN;
}

export function buildBreadcrumbJsonLd(
  crumbs: ReadonlyArray<{ name: string; path: string; surface?: 'marketing' | 'app' }>,
): JsonLdNode {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((crumb, idx) => {
      const base = crumb.surface === 'app' ? TAKOLIO_APP_ORIGIN : TAKOLIO_MARKETING_ORIGIN;
      const cleanPath = crumb.path.startsWith('/') ? crumb.path : `/${crumb.path}`;
      return {
        '@type': 'ListItem',
        position: idx + 1,
        name: crumb.name,
        item: `${base}${cleanPath}`,
      };
    }),
  };
}

export function buildPlatformWebAppJsonLd(
  locale: SupportedLocale = getActiveAppLocale(),
): JsonLdNode[] {
  const isVi = locale === 'vi';
  const inLanguage = isVi ? 'vi-VN' : (LOCALE_CATALOG[locale]?.bcp47 ?? 'en');
  return [
    {
      '@type': 'Organization',
      '@id': `${TAKOLIO_MARKETING_ORIGIN}/#organization`,
      name: 'Takolio',
      url: TAKOLIO_MARKETING_ORIGIN,
      sameAs: [TAKOLIO_APP_ORIGIN],
      logo: {
        '@type': 'ImageObject',
        url: `${TAKOLIO_MARKETING_ORIGIN}/takolio/brand-v2/pwa/icon-512.png`,
        width: 512,
        height: 512,
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${TAKOLIO_MARKETING_ORIGIN}/#website`,
      url: TAKOLIO_MARKETING_ORIGIN,
      name: lSync(
        'Takolio — Bữa ngon, nhẹ đầu. | Trợ lý bếp gia đình thông minh với AI',
        'Takolio — Great meals, zero stress. | Smart AI Family Kitchen Assistant',
        locale,
      ),
      inLanguage,
      publisher: { '@id': `${TAKOLIO_MARKETING_ORIGIN}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${TAKOLIO_MARKETING_ORIGIN}/recipes?q={search_term_string}`,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'WebApplication',
      '@id': `${TAKOLIO_APP_ORIGIN}/#webapp`,
      name: 'Takolio Kitchen Studio',
      url: TAKOLIO_APP_ORIGIN,
      installUrl: TAKOLIO_APP_ORIGIN,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Web, iOS, Android',
      inLanguage,
      description: lSync(
        'Quản lý thực phẩm tủ lạnh theo lô, nhận diện nguyên liệu AI có kiểm duyệt, gợi ý món Việt khớp định lượng, lên thực đơn tuần và đi chợ thông minh.',
        'Track fridge inventory by lot, scan ingredients with reviewable AI, discover fridge-matched recipes, build 7-day meal plans, and shop smarter.',
        locale,
      ),
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: isVi ? 'VND' : 'USD',
        availability: 'https://schema.org/InStock',
      },
    },
  ];
}

export function buildFaqJsonLd(
  items: ReadonlyArray<{ q: string; a: string }>,
  locale: SupportedLocale = getActiveAppLocale(),
): JsonLdNode {
  const inLanguage = locale === 'vi' ? 'vi-VN' : (LOCALE_CATALOG[locale]?.bcp47 ?? 'en');
  return {
    '@type': 'FAQPage',
    inLanguage,
    mainEntity: items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.a,
      },
    })),
  };
}

export function buildPricingJsonLd(
  plans: ReadonlyArray<{ plan: 'monthly' | 'annual'; amountVnd: number }> | null,
  locale: SupportedLocale = getActiveAppLocale(),
): JsonLdNode {
  const offers: JsonLdNode[] = [
    {
      '@type': 'Offer',
      name: lSync('Takolio Miễn phí', 'Takolio Free', locale),
      price: 0,
      priceCurrency: 'VND',
      url: `${TAKOLIO_APP_ORIGIN}/auth?mode=register`,
      availability: 'https://schema.org/InStock',
    },
  ];
  if (plans) {
    for (const p of plans) {
      offers.push({
        '@type': 'Offer',
        name:
          p.plan === 'annual'
            ? lSync('Takolio Pro theo năm', 'Takolio Pro Annual', locale)
            : lSync('Takolio Pro theo tháng', 'Takolio Pro Monthly', locale),
        price: p.amountVnd,
        priceCurrency: 'VND',
        url: `${TAKOLIO_APP_ORIGIN}/plus`,
        availability: 'https://schema.org/InStock',
      });
    }
  }
  return {
    '@type': 'SoftwareApplication',
    name: 'Takolio',
    url: TAKOLIO_APP_ORIGIN,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Web, iOS, Android',
    offers,
  };
}

export function buildStoriesBlogJsonLd(
  stories: ReadonlyArray<{
    id: string;
    title: string;
    excerpt: string;
    coverSrc?: string;
    publishedAt?: string;
  }>,
  locale: SupportedLocale = getActiveAppLocale(),
): JsonLdNode {
  const inLanguage = locale === 'vi' ? 'vi-VN' : (LOCALE_CATALOG[locale]?.bcp47 ?? 'en');
  return {
    '@type': 'Blog',
    name: lSync(
      'Takolio Stories — Cẩm nang căn bếp gia đình',
      'Takolio Stories — Family Kitchen Guide',
      locale,
    ),
    url: `${TAKOLIO_MARKETING_ORIGIN}/stories`,
    inLanguage,
    publisher: {
      '@type': 'Organization',
      name: 'Takolio',
      url: TAKOLIO_MARKETING_ORIGIN,
    },
    blogPost: stories.map((st) => ({
      '@type': 'BlogPosting',
      headline: st.title,
      description: st.excerpt,
      url: `${TAKOLIO_MARKETING_ORIGIN}/stories#${st.id}`,
      datePublished: st.publishedAt ?? '2026-11-01',
      inLanguage,
      ...(st.coverSrc ? { image: `${TAKOLIO_MARKETING_ORIGIN}${st.coverSrc}` } : {}),
      author: {
        '@type': 'Organization',
        name: 'Takolio Culinary Studio',
      },
    })),
  };
}

const CUISINE_SCHEMA_LABELS: Readonly<Record<string, string>> = {
  vietnamese: 'Vietnamese',
  japanese: 'Japanese',
  korean: 'Korean',
  chinese: 'Chinese',
  thai: 'Thai',
  italian: 'Italian',
};

export function buildRecipeJsonLd(recipe: {
  slug: string;
  title: string;
  description: string;
  cuisine?: string | null;
  category?: string | null;
  locale?: string;
  inLanguage?: string;
  canonicalUrl?: string;
  imageUrl?: string | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  servings?: number;
  calories?: number | null;
  proteinG?: number | null;
  fatG?: number | null;
  carbG?: number | null;
  ingredients?: ReadonlyArray<string>;
  steps?: ReadonlyArray<string>;
  keywords?: ReadonlyArray<string>;
}): JsonLdNode {
  const prep =
    typeof recipe.prepMinutes === 'number' && Number.isFinite(recipe.prepMinutes) && recipe.prepMinutes > 0
      ? Math.round(recipe.prepMinutes)
      : null;
  const cook =
    typeof recipe.cookMinutes === 'number' && Number.isFinite(recipe.cookMinutes) && recipe.cookMinutes > 0
      ? Math.round(recipe.cookMinutes)
      : 20;
  const total = (prep ?? 0) + cook;
  const img = recipe.imageUrl
    ? recipe.imageUrl.startsWith('http')
      ? recipe.imageUrl
      : recipe.imageUrl.startsWith('/api/')
        ? `${TAKOLIO_APP_ORIGIN}${recipe.imageUrl}`
        : `${TAKOLIO_MARKETING_ORIGIN}${recipe.imageUrl}`
    : `${TAKOLIO_MARKETING_ORIGIN}/takolio/brand-v2/social/og-1200x630.png`;

  const activeLocale = recipe.locale ?? getActiveAppLocale();
  const lang = recipe.inLanguage ?? (activeLocale === 'vi' ? 'vi-VN' : activeLocale);
  const cuisineKey = (recipe.cuisine ?? 'vietnamese').toLowerCase();
  const recipeCuisine = CUISINE_SCHEMA_LABELS[cuisineKey] ?? 'International';
  const yieldSuffix = lSync('khẩu phần', 'servings', lang.startsWith('vi') ? 'vi' : 'en');
  const defaultCategory = lSync('Món gia đình', 'Home Cooking', lang.startsWith('vi') ? 'vi' : 'en');

  return {
    '@type': 'Recipe',
    name: recipe.title,
    description: recipe.description,
    url: recipe.canonicalUrl ?? `${TAKOLIO_MARKETING_ORIGIN}/recipes/${recipe.slug}`,
    image: [img],
    inLanguage: lang,
    recipeCuisine,
    recipeCategory: recipe.category || defaultCategory,
    ...(prep ? { prepTime: `PT${prep}M` } : {}),
    cookTime: `PT${cook}M`,
    totalTime: `PT${total}M`,
    recipeYield: `${recipe.servings ?? 4} ${yieldSuffix}`,
    ...(recipe.keywords && recipe.keywords.length > 0 ? { keywords: recipe.keywords.join(', ') } : {}),
    author: {
      '@type': 'Organization',
      '@id': `${TAKOLIO_MARKETING_ORIGIN}/#organization`,
      name: 'Takolio',
      url: TAKOLIO_MARKETING_ORIGIN,
    },
    ...(recipe.ingredients && recipe.ingredients.length > 0
      ? { recipeIngredient: [...recipe.ingredients] }
      : {}),
    ...(recipe.steps && recipe.steps.length > 0
      ? {
          recipeInstructions: recipe.steps.map((text, idx) => ({
            '@type': 'HowToStep',
            position: idx + 1,
            text,
          })),
        }
      : {}),
    ...(recipe.calories && recipe.calories > 0
      ? {
          nutrition: {
            '@type': 'NutritionInformation',
            calories: `${Math.round(recipe.calories)} calories`,
            ...(recipe.proteinG ? { proteinContent: `${Math.round(recipe.proteinG)} g` } : {}),
            ...(recipe.fatG ? { fatContent: `${Math.round(recipe.fatG)} g` } : {}),
            ...(recipe.carbG ? { carbohydrateContent: `${Math.round(recipe.carbG)} g` } : {}),
          },
        }
      : {}),
  };
}

/**
 * Updates document title, Vietnamese lang attribute, meta description, robots directive,
 * canonical & hreflang links (`takolio.com` / `takolio.app`), OpenGraph, Twitter Cards,
 * and Schema.org JSON-LD structured data cleanly without third-party scripts.
 */
export function useVNextSeo({
  title,
  description,
  canonicalPath,
  domainSurface,
  ogType = 'website',
  ogImage = '/takolio/brand-v2/social/og-1200x630.png',
  ogImageAlt,
  ogImageWidth = 1200,
  ogImageHeight = 630,
  lang,
  ogLocale,
  hreflangs,
  noindex = false,
  jsonLd = null,
}: VNextSeoOptions) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const activeLocale = getActiveAppLocale();
    const localeMeta = LOCALE_CATALOG[activeLocale] ?? LOCALE_CATALOG.vi;
    const fullTitle = title.includes('Takolio') ? title : `${title} · Takolio`;
    document.title = fullTitle;
    if (lang) {
      document.documentElement.lang = lang;
    } else if (!document.documentElement.lang) {
      document.documentElement.lang = localeMeta.bcp47;
    }

    const inferredSurface: 'marketing' | 'app' =
      domainSurface ??
      (canonicalPath === '/' ||
      canonicalPath === '/landing' ||
      canonicalPath === '/how-it-works' ||
      canonicalPath.startsWith('/features/') ||
      canonicalPath === '/pricing' ||
      canonicalPath === '/faq' ||
      canonicalPath.startsWith('/stories') ||
      canonicalPath === '/about' ||
      canonicalPath === '/contact' ||
      canonicalPath === '/privacy' ||
      canonicalPath === '/terms'
        ? 'marketing'
        : 'app');

    const canonicalOrigin = resolveCanonicalOrigin(inferredSurface);
    const cleanPath = canonicalPath.startsWith('/') ? canonicalPath : `/${canonicalPath}`;
    const canonicalHref = `${canonicalOrigin}${cleanPath}`;
    const absoluteOgImage = ogImage.startsWith('http')
      ? ogImage
      : `${TAKOLIO_MARKETING_ORIGIN}${ogImage.startsWith('/') ? ogImage : `/${ogImage}`}`;
    const imageAltText = ogImageAlt ?? `${fullTitle} — Takolio`;

    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: noindex
        ? 'noindex, nofollow'
        : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    });

    // OpenGraph
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Takolio' });
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: ogLocale ?? localeMeta.ogLocale });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle });
    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: description,
    });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: ogType });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalHref });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: absoluteOgImage });
    upsertMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: imageAltText });
    upsertMeta('meta[property="og:image:width"]', { property: 'og:image:width', content: String(ogImageWidth) });
    upsertMeta('meta[property="og:image:height"]', { property: 'og:image:height', content: String(ogImageHeight) });

    // Twitter / X Card
    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: fullTitle });
    upsertMeta('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: description,
    });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: absoluteOgImage });
    upsertMeta('meta[name="twitter:image:alt"]', {
      name: 'twitter:image:alt',
      content: imageAltText,
    });

    // Canonical & Hreflang (omitted on noindex pages such as 404/auth)
    if (noindex) {
      document.head.querySelector('link[rel="canonical"]')?.remove();
      document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach((el) => el.remove());
    } else {
      upsertLink('link[rel="canonical"]', { rel: 'canonical', href: canonicalHref });
      const alternates = hreflangs ?? [
        { hreflang: localeMeta.hreflang, href: canonicalHref },
        { hreflang: 'x-default', href: canonicalHref },
      ];
      for (const alt of alternates) {
        upsertLink(`link[rel="alternate"][hreflang="${alt.hreflang}"]`, {
          rel: 'alternate',
          hreflang: alt.hreflang,
          href: alt.href,
        });
      }
    }

    // Structured Data (Schema.org JSON-LD)
    upsertJsonLd(jsonLd);

    return () => {
      upsertJsonLd(null);
    };
  }, [
    title,
    description,
    canonicalPath,
    domainSurface,
    ogType,
    ogImage,
    ogImageAlt,
    ogImageWidth,
    ogImageHeight,
    lang,
    ogLocale,
    hreflangs,
    noindex,
    jsonLd,
  ]);
}

/**
 * Consent-respecting conversion hook for G03 marketing CTAs.
 * Strictly a local-only ring buffer when consent === 'granted'; zero network beacons
 * and zero tracking when consent is absent or denied.
 */
export function trackPublicConversion(eventName: string, detail?: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    const consent = localStorage.getItem('takolio_analytics_consent');
    if (consent !== 'granted') return;
    const raw = sessionStorage.getItem('takolio_consent_events');
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    list.push({ event: eventName, detail: detail ?? {}, at: new Date().toISOString() });
    sessionStorage.setItem('takolio_consent_events', JSON.stringify(list.slice(-30)));
  } catch {
    // Ignore storage restrictions.
  }
}
