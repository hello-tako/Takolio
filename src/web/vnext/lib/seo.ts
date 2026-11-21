import { useEffect } from 'react';

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

export function buildPlatformWebAppJsonLd(): JsonLdNode[] {
  return [
    {
      '@type': 'Organization',
      '@id': `${TAKOLIO_MARKETING_ORIGIN}/#organization`,
      name: 'Takolio',
      url: TAKOLIO_MARKETING_ORIGIN,
      sameAs: [TAKOLIO_APP_ORIGIN],
      logo: {
        '@type': 'ImageObject',
        url: `${TAKOLIO_MARKETING_ORIGIN}/takolio/vnext/pwa/pwa-icon-512.png`,
        width: 512,
        height: 512,
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${TAKOLIO_MARKETING_ORIGIN}/#website`,
      url: TAKOLIO_MARKETING_ORIGIN,
      name: 'Takolio — Trợ lý căn bếp thông minh cho gia đình hiện đại',
      inLanguage: 'vi-VN',
      publisher: { '@id': `${TAKOLIO_MARKETING_ORIGIN}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: `${TAKOLIO_APP_ORIGIN}/recipes?q={search_term_string}`,
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
      inLanguage: 'vi-VN',
      description:
        'Quản lý thực phẩm tủ lạnh theo lô, nhận diện nguyên liệu AI có kiểm duyệt, gợi ý món Việt khớp định lượng, lên thực đơn tuần và đi chợ thông minh.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'VND',
        availability: 'https://schema.org/InStock',
      },
    },
  ];
}

export function buildFaqJsonLd(items: ReadonlyArray<{ q: string; a: string }>): JsonLdNode {
  return {
    '@type': 'FAQPage',
    inLanguage: 'vi-VN',
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
): JsonLdNode {
  const offers: JsonLdNode[] = [
    {
      '@type': 'Offer',
      name: 'Takolio Miễn phí',
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
        name: p.plan === 'annual' ? 'Takolio Pro theo năm' : 'Takolio Pro theo tháng',
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
): JsonLdNode {
  return {
    '@type': 'Blog',
    name: 'Takolio Stories — Cẩm nang căn bếp gia đình',
    url: `${TAKOLIO_MARKETING_ORIGIN}/stories`,
    inLanguage: 'vi-VN',
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
      inLanguage: 'vi-VN',
      ...(st.coverSrc ? { image: `${TAKOLIO_MARKETING_ORIGIN}${st.coverSrc}` } : {}),
      author: {
        '@type': 'Organization',
        name: 'Takolio Culinary Studio',
      },
    })),
  };
}

export function buildRecipeJsonLd(recipe: {
  slug: string;
  title: string;
  description: string;
  imageUrl?: string | null;
  prepMinutes?: number;
  cookMinutes?: number;
  servings?: number;
  calories?: number | null;
  ingredients?: ReadonlyArray<string>;
  steps?: ReadonlyArray<string>;
}): JsonLdNode {
  const prep = Math.max(0, Math.round(recipe.prepMinutes ?? 10));
  const cook = Math.max(1, Math.round(recipe.cookMinutes ?? 20));
  const total = prep + cook;
  const img = recipe.imageUrl
    ? recipe.imageUrl.startsWith('http')
      ? recipe.imageUrl
      : `${TAKOLIO_MARKETING_ORIGIN}${recipe.imageUrl}`
    : `${TAKOLIO_MARKETING_ORIGIN}/takolio/vnext/social/og-1200x630.webp`;

  return {
    '@type': 'Recipe',
    name: recipe.title,
    description: recipe.description,
    url: `${TAKOLIO_APP_ORIGIN}/recipes/${recipe.slug}`,
    image: [img],
    inLanguage: 'vi-VN',
    recipeCuisine: 'Vietnamese',
    recipeCategory: 'Món gia đình',
    prepTime: `PT${prep}M`,
    cookTime: `PT${cook}M`,
    totalTime: `PT${total}M`,
    recipeYield: `${recipe.servings ?? 4} khẩu phần`,
    author: {
      '@type': 'Organization',
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
  ogImage = '/takolio/vnext/social/og-1200x630.webp',
  ogImageAlt,
  noindex = false,
  jsonLd = null,
}: VNextSeoOptions) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const fullTitle = title.includes('Takolio') ? title : `${title} · Takolio`;
    document.title = fullTitle;
    document.documentElement.lang = 'vi';

    const inferredSurface: 'marketing' | 'app' =
      domainSurface ??
      (canonicalPath === '/landing' ||
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
    const imageAltText = ogImageAlt ?? `${fullTitle} — Không gian bếp gia đình Takolio`;

    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[name="robots"]', {
      name: 'robots',
      content: noindex
        ? 'noindex, nofollow'
        : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    });

    // OpenGraph
    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: 'Takolio' });
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'vi_VN' });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: fullTitle });
    upsertMeta('meta[property="og:description"]', {
      property: 'og:description',
      content: description,
    });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: ogType });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalHref });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: absoluteOgImage });
    upsertMeta('meta[property="og:image:alt"]', { property: 'og:image:alt', content: imageAltText });
    upsertMeta('meta[property="og:image:width"]', { property: 'og:image:width', content: '1200' });
    upsertMeta('meta[property="og:image:height"]', { property: 'og:image:height', content: '630' });

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

    // Canonical & Hreflang
    upsertLink('link[rel="canonical"]', { rel: 'canonical', href: canonicalHref });
    upsertLink('link[rel="alternate"][hreflang="vi-VN"]', {
      rel: 'alternate',
      hreflang: 'vi-VN',
      href: canonicalHref,
    });
    upsertLink('link[rel="alternate"][hreflang="x-default"]', {
      rel: 'alternate',
      hreflang: 'x-default',
      href: canonicalHref,
    });

    // Structured Data (Schema.org JSON-LD)
    upsertJsonLd(jsonLd);

    return () => {
      upsertJsonLd(null);
    };
  }, [title, description, canonicalPath, domainSurface, ogType, ogImage, ogImageAlt, noindex, jsonLd]);
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
