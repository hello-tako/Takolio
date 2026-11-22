import type { SupportedLocale } from '../../shared/locales';
import type { PublicVndPlanDto, RegionalPriceReference } from '../../shared/global-pricing';
import type { SiteRecipeRecord } from '../../../packages/recipes/src/global-i18n';

export interface SiteRecipeIndexEntry {
  slug: string;
  cuisine: SiteRecipeRecord['cuisine'];
  category: string;
  cookTimeMinutes: number;
  servings: number;
  difficulty: SiteRecipeRecord['difficulty'];
  imageUrl: string;
  titleVi: string;
  titleEn: string;
  descriptionVi: string;
  descriptionEn: string;
  calories?: number;
}

export interface SiteSsrPayload {
  locale: SupportedLocale;
  pricing?: {
    plans: PublicVndPlanDto[];
    regionalCatalog: RegionalPriceReference[];
  };
  recipesTotal?: number;
  cuisineCounts?: Record<string, number>;
  recipesPreview?: SiteRecipeIndexEntry[];
  activeCuisine?: SiteRecipeRecord['cuisine'] | 'all';
  recipe?: SiteRecipeRecord;
  relatedRecipes?: SiteRecipeIndexEntry[];
}

declare global {
  interface Window {
    __TAKOLIO_SSR_DATA__?: SiteSsrPayload;
  }
}

export function readClientSsrPayload(): SiteSsrPayload | null {
  if (typeof window === 'undefined') return null;
  if (window.__TAKOLIO_SSR_DATA__) return window.__TAKOLIO_SSR_DATA__;
  const el = document.getElementById('tk-ssr-data');
  if (!el?.textContent) return null;
  try {
    const parsed = JSON.parse(el.textContent) as SiteSsrPayload;
    window.__TAKOLIO_SSR_DATA__ = parsed;
    return parsed;
  } catch {
    return null;
  }
}
