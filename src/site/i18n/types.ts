import type { SupportedLocale } from '../../shared/locales';

export type FeatureKey =
  | 'ai-scan'
  | 'fridge'
  | 'meal-planning'
  | 'recipes'
  | 'cooking'
  | 'shopping';

export type CuisineKey =
  | 'vietnamese'
  | 'chinese'
  | 'japanese'
  | 'korean'
  | 'thai'
  | 'italian';

export interface SiteFeatureSpec {
  key: FeatureKey;
  slug: string;
  icon: 'scan' | 'fridge' | 'planner' | 'recipes' | 'cooking' | 'shopping';
  title: string;
  h1: string;
  subtitle: string;
  seoDescription: string;
  tldrLabel: string;
  tldr: string;
  questionHeading: string;
  ogImage: string;
  ogWidth: number;
  ogHeight: number;
  heroAlt: string;
  highlights: ReadonlyArray<{ title: string; detail: string }>;
  steps: ReadonlyArray<{ title: string; detail: string }>;
}

export interface SiteStoryGuide {
  slug: string;
  title: string;
  readTime: string;
  category: string;
  excerpt: string;
  tldr: string;
  coverSrc: string;
  coverSrc640: string;
  coverAlt: string;
  publishedAt: string;
  paragraphs: ReadonlyArray<string>;
  steps: ReadonlyArray<string>;
}

export interface SiteFaqItem {
  id: string;
  q: string;
  a: string;
}

export interface SiteDictionary {
  locale: SupportedLocale;
  brand: {
    name: string;
    tagline: string;
    heroLine1: string;
    heroLine2: string;
    slogan: string;
    mascotName: string;
    mascotBadge: string;
    mascotDesc: string;
    siteNameFull: string;
    ogImage: string;
  };
  nav: {
    home: string;
    howItWorks: string;
    features: string;
    recipes: string;
    pricing: string;
    faq: string;
    stories: string;
    about: string;
    contact: string;
    privacy: string;
    terms: string;
    openApp: string;
    startFree: string;
    skipToMain: string;
    languageLabel: string;
    menuLabel: string;
  };
  langBanner: {
    prompt: string;
    switchCta: string;
    dismiss: string;
  };
  landing: {
    seoTitle: string;
    seoDescription: string;
    heroBadge: string;
    heroDesc: string;
    ctaPrimary: string;
    ctaSecondary: string;
    tldrLabel: string;
    tldrBody: string;
    pillars: ReadonlyArray<{
      icon: 'fridge' | 'recipes' | 'planner' | 'shopping' | 'cooking';
      title: string;
      to: string;
    }>;
    featuresEyebrow: string;
    featuresHeading: string;
    featuresSeeAll: string;
    explorePrefix: string;
    coreFeatures: ReadonlyArray<{
      icon: 'fridge' | 'scan' | 'recipes' | 'planner' | 'shopping' | 'cooking';
      title: string;
      subtitle: string;
      description: string;
      to: string;
    }>;
    mascotEyebrow: string;
    mascotHeading: string;
    mascotPoses: ReadonlyArray<{ pose: string; img: string; title: string; subtitle: string }>;
    dishesEyebrow: string;
    dishesHeading: string;
    dishesSeeAll: string;
    showcaseDishes: ReadonlyArray<{
      slug: string;
      title: string;
      summary: string;
      img: string;
      time: string;
      servings: string;
      level: string;
    }>;
    pricingEyebrow: string;
    pricingHeading: string;
    pricingDesc: string;
    pricingCtaPrimary: string;
    pricingCtaSecondary: string;
  };
  howItWorks: {
    seoTitle: string;
    seoDescription: string;
    eyebrow: string;
    h1: string;
    subtitle: string;
    tldrLabel: string;
    tldr: string;
    loopHeading: string;
    steps: ReadonlyArray<{ num: string; title: string; detail: string; to: string }>;
    compareHeading: string;
    compareColFeature: string;
    compareColGeneric: string;
    compareColTakolio: string;
    compareRows: ReadonlyArray<{ criterion: string; generic: string; takolio: string }>;
    ctaTitle: string;
    ctaButton: string;
  };
  features: Readonly<Record<FeatureKey, SiteFeatureSpec>>;
  pricing: {
    seoTitle: string;
    seoDescription: string;
    eyebrow: string;
    h1: string;
    subtitle: string;
    tldrLabel: string;
    tldr: string;
    currencyLabel: string;
    freeBadge: string;
    freeTitle: string;
    freePriceLabel: string;
    freePer: string;
    freeDesc: string;
    freePerks: ReadonlyArray<string>;
    freeCta: string;
    proBadge: string;
    proTitle: string;
    proDesc: string;
    monthlyLabel: string;
    annualLabel: string;
    saveNote: string;
    proPerks: ReadonlyArray<string>;
    proCta: string;
    checkoutVndNote: string;
    checkoutIntlNote: string;
    transparencyTitle: string;
    transparencyBody: string;
  };
  faq: {
    seoTitle: string;
    seoDescription: string;
    eyebrow: string;
    h1: string;
    subtitle: string;
    tldrLabel: string;
    tldr: string;
    searchPlaceholder: string;
    noResults: string;
    resetSearch: string;
    items: ReadonlyArray<SiteFaqItem>;
  };
  stories: {
    seoTitle: string;
    seoDescription: string;
    eyebrow: string;
    h1: string;
    subtitle: string;
    readArticle: string;
    backToStories: string;
    tldrLabel: string;
    checklistHeading: string;
    applyInApp: string;
    guides: ReadonlyArray<SiteStoryGuide>;
  };
  recipes: {
    seoTitle: string;
    seoDescription: string;
    eyebrow: string;
    h1: string;
    subtitle: string;
    tldrLabel: string;
    tldr: string;
    searchPlaceholder: string;
    allCuisines: string;
    cuisineLabels: Readonly<Record<CuisineKey, string>>;
    cuisineDescriptions: Readonly<Record<CuisineKey, string>>;
    servingsLabel: string;
    minutesUnit: string;
    difficultyLabels: Readonly<Record<string, string>>;
    metricLabel: string;
    imperialLabel: string;
    ingredientsHeading: string;
    stepsHeading: string;
    nutritionHeading: string;
    caloriesLabel: string;
    proteinLabel: string;
    fatLabel: string;
    carbLabel: string;
    cookInAppCta: string;
    checkFridgeCta: string;
    relatedHeading: string;
    backToHub: string;
    countLabel: string;
    emptySearch: string;
    viewRecipe: string;
    pageMetaSuffix: string;
  };
  company: {
    tabsLabel: string;
    badge: string;
    supportEyebrow: string;
    supportHeading: string;
    supportDesc: string;
    supportSteps: ReadonlyArray<{ title: string; detail: string }>;
    supportFaqCta: string;
    supportLoginCta: string;
    pages: Readonly<
      Record<
        'about' | 'contact' | 'privacy' | 'terms',
        {
          seoTitle: string;
          seoDescription: string;
          h1: string;
          lead: string;
          heading: string;
          bullets: ReadonlyArray<{ label: string; text: string }>;
          paragraphs: ReadonlyArray<string>;
        }
      >
    >;
  };
  footer: {
    colProduct: string;
    colExplore: string;
    colCompany: string;
    tagline: string;
    appNote: string;
    copyright: string;
    notFoundTitle: string;
    notFoundDesc: string;
    backHome: string;
  };
}
