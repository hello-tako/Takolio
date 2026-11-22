import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom';
import {
  buildHreflangCluster,
  buildLocalizedPath,
  LOCALE_CATALOG,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '../src/shared/locales';
import { buildRegionalPriceReferences } from '../src/shared/global-pricing';
import { getSiteDictionary } from '../src/site/i18n/dictionaries';
import type { CuisineKey, FeatureKey } from '../src/site/i18n/types';
import { SiteApp } from '../src/site/SiteApp';
import type { SiteSsrPayload } from '../src/site/types/ssr-data';
import { loadFull500SiteRecipeCatalog, toRecipeIndexEntry } from './catalog-loader';
import type { SiteRecipeRecord } from '@frigo/recipes';

export {
  buildHreflangCluster,
  buildLocalizedPath,
  LOCALE_CATALOG,
  SUPPORTED_LOCALES,
  getSiteDictionary,
  loadFull500SiteRecipeCatalog,
  toRecipeIndexEntry,
  buildRegionalPriceReferences,
};

const MARKETING_ORIGIN = 'https://takolio.com';
const APP_ORIGIN = 'https://takolio.app';

const CUISINE_SCHEMA_LABELS: Readonly<Record<string, string>> = {
  vietnamese: 'Vietnamese',
  chinese: 'Chinese',
  japanese: 'Japanese',
  korean: 'Korean',
  thai: 'Thai',
  italian: 'Italian',
};

export interface SsrRouteMeta {
  locale: SupportedLocale;
  barePath: string;
  urlPath: string;
  title: string;
  description: string;
  ogType: 'website' | 'article';
  ogImage: string;
  ogImageWidth: number;
  ogImageHeight: number;
  ogImageAlt: string;
  noindex?: boolean;
  hreflangLocales?: readonly SupportedLocale[];
  lcpPreloadHref?: string;
  jsonLd: Record<string, unknown> | null;
}

function orgAndWebsiteNodes(locale: SupportedLocale) {
  const dict = getSiteDictionary(locale);
  const meta = LOCALE_CATALOG[locale];
  const recipesSearchUrl = `${MARKETING_ORIGIN}${buildLocalizedPath(locale, '/recipes')}?q={search_term_string}`;
  return [
    {
      '@type': 'Organization',
      '@id': `${MARKETING_ORIGIN}/#organization`,
      name: 'Takolio',
      url: MARKETING_ORIGIN,
      sameAs: [APP_ORIGIN],
      description: dict.brand.tagline,
      logo: {
        '@type': 'ImageObject',
        url: `${MARKETING_ORIGIN}/takolio/brand-v2/pwa/icon-512.png`,
        width: 512,
        height: 512,
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${MARKETING_ORIGIN}/#website`,
      url: `${MARKETING_ORIGIN}${buildLocalizedPath(locale, '/')}`,
      name: dict.brand.siteNameFull,
      inLanguage: meta.hreflang,
      publisher: { '@id': `${MARKETING_ORIGIN}/#organization` },
      potentialAction: {
        '@type': 'SearchAction',
        target: {
          '@type': 'EntryPoint',
          urlTemplate: recipesSearchUrl,
        },
        'query-input': 'required name=search_term_string',
      },
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${APP_ORIGIN}/#webapp`,
      name: 'Takolio',
      url: APP_ORIGIN,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Web, iOS, Android',
      inLanguage: meta.hreflang,
      description: dict.landing.tldrBody,
      publisher: { '@id': `${MARKETING_ORIGIN}/#organization` },
      offers: [
        {
          '@type': 'Offer',
          name: dict.pricing.freeTitle,
          price: 0,
          priceCurrency: 'VND',
          availability: 'https://schema.org/InStock',
          url: `${APP_ORIGIN}/auth?mode=guest`,
        },
        {
          '@type': 'Offer',
          name: `${dict.pricing.proTitle} (${dict.pricing.monthlyLabel})`,
          price: 49000,
          priceCurrency: 'VND',
          availability: 'https://schema.org/InStock',
          url: `${APP_ORIGIN}/plus`,
        },
        {
          '@type': 'Offer',
          name: `${dict.pricing.proTitle} (${dict.pricing.annualLabel})`,
          price: 499000,
          priceCurrency: 'VND',
          availability: 'https://schema.org/InStock',
          url: `${APP_ORIGIN}/plus`,
        },
      ],
    },
  ];
}

function buildBreadcrumb(locale: SupportedLocale, crumbs: ReadonlyArray<{ name: string; barePath: string }>) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: c.name,
      item: `${MARKETING_ORIGIN}${buildLocalizedPath(locale, c.barePath)}`,
    })),
  };
}

export function resolveRouteMeta(
  locale: SupportedLocale,
  barePath: string,
  recipe?: SiteRecipeRecord | null,
): SsrRouteMeta {
  const dict = getSiteDictionary(locale);
  const locMeta = LOCALE_CATALOG[locale];
  const urlPath = buildLocalizedPath(locale, barePath);
  const canonicalUrl = `${MARKETING_ORIGIN}${urlPath}`;

  if (barePath === '/404') {
    return {
      locale,
      barePath: '/404',
      urlPath: '/404',
      title: `${dict.footer.notFoundTitle} · Takolio`,
      description: dict.footer.notFoundDesc,
      ogType: 'website',
      ogImage: dict.brand.ogImage,
      ogImageWidth: 1200,
      ogImageHeight: 630,
      ogImageAlt: dict.brand.siteNameFull,
      noindex: true,
      jsonLd: null,
    };
  }

  if (barePath === '/') {
    return {
      locale,
      barePath,
      urlPath,
      title: dict.landing.seoTitle,
      description: dict.landing.seoDescription,
      ogType: 'website',
      ogImage: dict.brand.ogImage,
      ogImageWidth: 1200,
      ogImageHeight: 630,
      ogImageAlt: dict.brand.siteNameFull,
      lcpPreloadHref: '/takolio/brand-v2/mascot/bemam-hero-kitchen-640w.webp',
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': orgAndWebsiteNodes(locale),
      },
    };
  }

  if (barePath === '/how-it-works') {
    return {
      locale,
      barePath,
      urlPath,
      title: dict.howItWorks.seoTitle,
      description: dict.howItWorks.seoDescription,
      ogType: 'website',
      ogImage: '/takolio/vnext/marketing/m02-closed-loop-kitchen.webp',
      ogImageWidth: 1280,
      ogImageHeight: 720,
      ogImageAlt: dict.howItWorks.h1,
      lcpPreloadHref: '/takolio/vnext/marketing/m02-closed-loop-kitchen.webp',
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          buildBreadcrumb(locale, [
            { name: dict.nav.home, barePath: '/' },
            { name: dict.nav.howItWorks, barePath: '/how-it-works' },
          ]),
          {
            '@type': 'HowTo',
            name: dict.howItWorks.h1,
            description: dict.howItWorks.tldr,
            inLanguage: locMeta.hreflang,
            step: dict.howItWorks.steps.map((s, idx) => ({
              '@type': 'HowToStep',
              position: idx + 1,
              name: s.title,
              text: s.detail,
            })),
          },
        ],
      },
    };
  }

  if (barePath.startsWith('/features/')) {
    const key = barePath.slice('/features/'.length) as FeatureKey;
    const feat = dict.features[key];
    if (feat) {
      return {
        locale,
        barePath,
        urlPath,
        title: `${feat.title} · Takolio`,
        description: feat.seoDescription,
        ogType: 'website',
        ogImage: feat.ogImage,
        ogImageWidth: feat.ogWidth,
        ogImageHeight: feat.ogHeight,
        ogImageAlt: feat.heroAlt,
        lcpPreloadHref: feat.ogImage,
        jsonLd: {
          '@context': 'https://schema.org',
          '@graph': [
            buildBreadcrumb(locale, [
              { name: dict.nav.home, barePath: '/' },
              { name: dict.nav.features, barePath: '/how-it-works' },
              { name: feat.title, barePath },
            ]),
            {
              '@type': 'HowTo',
              name: feat.h1,
              description: feat.tldr,
              inLanguage: locMeta.hreflang,
              step: feat.steps.map((s, idx) => ({
                '@type': 'HowToStep',
                position: idx + 1,
                name: s.title,
                text: s.detail,
              })),
            },
          ],
        },
      };
    }
  }

  if (barePath === '/pricing') {
    return {
      locale,
      barePath,
      urlPath,
      title: dict.pricing.seoTitle,
      description: dict.pricing.seoDescription,
      ogType: 'website',
      ogImage: dict.brand.ogImage,
      ogImageWidth: 1200,
      ogImageHeight: 630,
      ogImageAlt: dict.pricing.h1,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          buildBreadcrumb(locale, [
            { name: dict.nav.home, barePath: '/' },
            { name: dict.nav.pricing, barePath: '/pricing' },
          ]),
          orgAndWebsiteNodes(locale)[2],
        ],
      },
    };
  }

  if (barePath === '/faq') {
    return {
      locale,
      barePath,
      urlPath,
      title: dict.faq.seoTitle,
      description: dict.faq.seoDescription,
      ogType: 'website',
      ogImage: dict.brand.ogImage,
      ogImageWidth: 1200,
      ogImageHeight: 630,
      ogImageAlt: dict.faq.h1,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          buildBreadcrumb(locale, [
            { name: dict.nav.home, barePath: '/' },
            { name: dict.nav.faq, barePath: '/faq' },
          ]),
          {
            '@type': 'FAQPage',
            inLanguage: locMeta.hreflang,
            mainEntity: dict.faq.items.map((item) => ({
              '@type': 'Question',
              name: item.q,
              acceptedAnswer: { '@type': 'Answer', text: item.a },
            })),
          },
        ],
      },
    };
  }

  if (barePath === '/stories') {
    return {
      locale,
      barePath,
      urlPath,
      title: dict.stories.seoTitle,
      description: dict.stories.seoDescription,
      ogType: 'website',
      ogImage: '/takolio/vnext/food/dau-phu-sot-ca-chua.webp',
      ogImageWidth: 1200,
      ogImageHeight: 900,
      ogImageAlt: dict.stories.h1,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          buildBreadcrumb(locale, [
            { name: dict.nav.home, barePath: '/' },
            { name: dict.nav.stories, barePath: '/stories' },
          ]),
          {
            '@type': 'Blog',
            name: dict.stories.h1,
            url: canonicalUrl,
            inLanguage: locMeta.hreflang,
            publisher: { '@id': `${MARKETING_ORIGIN}/#organization` },
            blogPost: dict.stories.guides.map((g) => ({
              '@type': 'BlogPosting',
              headline: g.title,
              description: g.excerpt,
              url: `${MARKETING_ORIGIN}${buildLocalizedPath(locale, `/stories/${g.slug}`)}`,
              datePublished: g.publishedAt,
              image: `${MARKETING_ORIGIN}${g.coverSrc}`,
              inLanguage: locMeta.hreflang,
              author: { '@type': 'Organization', name: 'Takolio', url: MARKETING_ORIGIN },
            })),
          },
        ],
      },
    };
  }

  if (barePath.startsWith('/stories/')) {
    const slug = barePath.slice('/stories/'.length);
    const guide = dict.stories.guides.find((g) => g.slug === slug);
    if (guide) {
      return {
        locale,
        barePath,
        urlPath,
        title: `${guide.title} · Takolio Stories`,
        description: guide.excerpt,
        ogType: 'article',
        ogImage: guide.coverSrc,
        ogImageWidth: 1200,
        ogImageHeight: 900,
        ogImageAlt: guide.coverAlt,
        lcpPreloadHref: guide.coverSrc,
        jsonLd: {
          '@context': 'https://schema.org',
          '@graph': [
            buildBreadcrumb(locale, [
              { name: dict.nav.home, barePath: '/' },
              { name: dict.nav.stories, barePath: '/stories' },
              { name: guide.title, barePath },
            ]),
            {
              '@type': 'Article',
              headline: guide.title,
              description: guide.excerpt,
              mainEntityOfPage: canonicalUrl,
              image: [`${MARKETING_ORIGIN}${guide.coverSrc}`],
              datePublished: guide.publishedAt,
              dateModified: guide.publishedAt,
              inLanguage: locMeta.hreflang,
              author: { '@type': 'Organization', name: 'Takolio', url: MARKETING_ORIGIN },
              publisher: { '@id': `${MARKETING_ORIGIN}/#organization` },
            },
            {
              '@type': 'HowTo',
              name: guide.title,
              description: guide.tldr,
              inLanguage: locMeta.hreflang,
              step: guide.steps.map((s, idx) => ({
                '@type': 'HowToStep',
                position: idx + 1,
                text: s,
              })),
            },
          ],
        },
      };
    }
  }

  if (barePath === '/recipes' || barePath.startsWith('/recipes/cuisine/')) {
    const cuisine = barePath.startsWith('/recipes/cuisine/')
      ? (barePath.slice('/recipes/cuisine/'.length) as CuisineKey)
      : null;
    const title = cuisine
      ? `${dict.recipes.cuisineLabels[cuisine]} — ${dict.recipes.seoTitle}`
      : dict.recipes.seoTitle;
    const description = cuisine
      ? dict.recipes.cuisineDescriptions[cuisine]
      : dict.recipes.seoDescription;

    return {
      locale,
      barePath,
      urlPath,
      title,
      description,
      ogType: 'website',
      ogImage: '/takolio/vnext/marketing/m06-vietnamese-recipes.webp',
      ogImageWidth: 1200,
      ogImageHeight: 900,
      ogImageAlt: title,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          buildBreadcrumb(
            locale,
            cuisine
              ? [
                  { name: dict.nav.home, barePath: '/' },
                  { name: dict.nav.recipes, barePath: '/recipes' },
                  { name: dict.recipes.cuisineLabels[cuisine], barePath },
                ]
              : [
                  { name: dict.nav.home, barePath: '/' },
                  { name: dict.nav.recipes, barePath: '/recipes' },
                ],
          ),
          {
            '@type': 'CollectionPage',
            name: title,
            description,
            url: canonicalUrl,
            inLanguage: locMeta.hreflang,
          },
        ],
      },
    };
  }

  if (barePath.startsWith('/recipes/') && recipe) {
    const title = locale === 'vi' ? recipe.titleVi : recipe.titleEn;
    const description = locale === 'vi' ? recipe.descriptionVi : recipe.descriptionEn;
    const cuisineLabel = CUISINE_SCHEMA_LABELS[recipe.cuisine] ?? 'International';
    const imgUrl = `${MARKETING_ORIGIN}${recipe.imageUrl}`;

    return {
      locale,
      barePath,
      urlPath,
      title: `${title} · ${dict.recipes.pageMetaSuffix}`,
      description,
      ogType: 'article',
      ogImage: recipe.imageUrl,
      ogImageWidth: 1200,
      ogImageHeight: 900,
      ogImageAlt: title,
      lcpPreloadHref: recipe.imageUrl,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          buildBreadcrumb(locale, [
            { name: dict.nav.home, barePath: '/' },
            { name: dict.nav.recipes, barePath: '/recipes' },
            { name: dict.recipes.cuisineLabels[recipe.cuisine], barePath: `/recipes/cuisine/${recipe.cuisine}` },
            { name: title, barePath },
          ]),
          {
            '@type': 'Recipe',
            name: title,
            description,
            url: canonicalUrl,
            image: [imgUrl],
            inLanguage: locMeta.hreflang,
            recipeCuisine: cuisineLabel,
            recipeCategory: dict.recipes.cuisineLabels[recipe.cuisine],
            cookTime: `PT${recipe.cookTimeMinutes}M`,
            totalTime: `PT${recipe.cookTimeMinutes}M`,
            recipeYield: `${recipe.servings} ${dict.recipes.servingsLabel}`,
            keywords: recipe.tags.join(', '),
            author: {
              '@type': 'Organization',
              '@id': `${MARKETING_ORIGIN}/#organization`,
              name: 'Takolio',
              url: MARKETING_ORIGIN,
            },
            recipeIngredient: recipe.ingredients.map(
              (ing) => `${ing.quantity} ${ing.unit} ${locale === 'vi' ? ing.nameVi : ing.nameEn}`,
            ),
            recipeInstructions: recipe.steps.map((st, idx) => ({
              '@type': 'HowToStep',
              position: idx + 1,
              text: locale === 'vi' ? st.instructionVi : st.instructionEn,
            })),
            ...(recipe.nutrition?.calories
              ? {
                  nutrition: {
                    '@type': 'NutritionInformation',
                    calories: `${Math.round(recipe.nutrition.calories)} calories`,
                    ...(recipe.nutrition.proteinG ? { proteinContent: `${Math.round(recipe.nutrition.proteinG)} g` } : {}),
                    ...(recipe.nutrition.fatG ? { fatContent: `${Math.round(recipe.nutrition.fatG)} g` } : {}),
                    ...(recipe.nutrition.carbG ? { carbohydrateContent: `${Math.round(recipe.nutrition.carbG)} g` } : {}),
                  },
                }
              : {}),
          },
        ],
      },
    };
  }

  // Company & Legal (`/about`, `/contact`, `/privacy`, `/terms`)
  const companySection = barePath.slice(1) as 'about' | 'contact' | 'privacy' | 'terms';
  const companyPage = dict.company.pages[companySection] ?? dict.company.pages.about;
  return {
    locale,
    barePath,
    urlPath,
    title: companyPage.seoTitle,
    description: companyPage.seoDescription,
    ogType: 'website',
    ogImage: dict.brand.ogImage,
    ogImageWidth: 1200,
    ogImageHeight: 630,
    ogImageAlt: companyPage.h1,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        buildBreadcrumb(locale, [
          { name: dict.nav.home, barePath: '/' },
          { name: companyPage.h1, barePath },
        ]),
        {
          '@type': companySection === 'about' ? 'AboutPage' : companySection === 'contact' ? 'ContactPage' : 'WebPage',
          name: companyPage.h1,
          description: companyPage.seoDescription,
          url: canonicalUrl,
          inLanguage: locMeta.hreflang,
        },
      ],
    },
  };
}

export function renderSiteRoute(urlPath: string, ssrData: SiteSsrPayload): string {
  return renderToString(
    <StaticRouter location={urlPath}>
      <SiteApp ssrData={ssrData} />
    </StaticRouter>,
  );
}
