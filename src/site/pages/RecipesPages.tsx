import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  convertStepTemperatures,
  formatDisplayQuantity,
  type DisplayUnitSystem,
} from '../../../packages/domain/src/unit-conversion';
import {
  buildLocalizedPath,
  LOCALE_CATALOG,
  type SupportedLocale,
} from '../../shared/locales';
import { RECIPE_TITLE_EN_BY_SLUG } from '../../shared/recipe-titles-en';
import { itIngredients, itRecipeTitles } from '../../web/i18n/packs/it-recipes';
import { JA_INGREDIENTS, JA_RECIPE_TITLES } from '../../web/i18n/packs/ja-recipes';
import { koIngredients, koRecipeTitles } from '../../web/i18n/packs/ko-recipes';
import { thIngredients, thRecipeTitles } from '../../web/i18n/packs/th-recipes';
import { ZH_INGREDIENTS, ZH_RECIPE_TITLES } from '../../web/i18n/packs/zh-recipes';
import { getSiteDictionary } from '../i18n/dictionaries';
import type { CuisineKey } from '../i18n/types';
import type { SiteRecipeIndexEntry, SiteSsrPayload } from '../types/ssr-data';
import type { SiteRecipeRecord } from '../../../packages/recipes/src/global-i18n';
import { buildAppHandoffUrl, SatelliteShell } from '../components/SatelliteShell';
import { SatelliteNotFoundPage } from './MarketingPages';

const CUISINE_ORDER: readonly CuisineKey[] = [
  'vietnamese',
  'chinese',
  'japanese',
  'korean',
  'thai',
  'italian',
];

const SITE_TITLES_BY_LOCALE: Readonly<Partial<Record<SupportedLocale, Readonly<Record<string, string>>>>> = {
  en: RECIPE_TITLE_EN_BY_SLUG,
  ja: JA_RECIPE_TITLES,
  ko: koRecipeTitles,
  th: thRecipeTitles,
  zh: ZH_RECIPE_TITLES,
  it: itRecipeTitles,
};

const SITE_INGREDIENTS_BY_LOCALE: Readonly<Partial<Record<SupportedLocale, Readonly<Record<string, string>>>>> = {
  ja: JA_INGREDIENTS,
  ko: koIngredients,
  th: thIngredients,
  zh: ZH_INGREDIENTS,
  it: itIngredients,
};

function recipeTitleForLocale(
  item: Pick<SiteRecipeIndexEntry, 'titleVi' | 'titleEn'> & { slug?: string },
  locale: SupportedLocale,
): string {
  if (locale === 'vi') return item.titleVi;
  const localized = item.slug ? SITE_TITLES_BY_LOCALE[locale]?.[item.slug] : undefined;
  return localized ?? item.titleEn;
}

function recipeIngredientForLocale(
  ing: { ingredientId: string; nameVi: string; nameEn: string },
  locale: SupportedLocale,
): string {
  if (locale === 'vi') return ing.nameVi;
  if (locale === 'en') return ing.nameEn;
  const map = SITE_INGREDIENTS_BY_LOCALE[locale];
  if (!map) return ing.nameEn;
  return map[ing.ingredientId.toUpperCase()] ?? map[ing.nameEn.toLowerCase()] ?? ing.nameEn;
}

function recipeDescForLocale(
  item: Pick<SiteRecipeIndexEntry, 'descriptionVi' | 'descriptionEn'>,
  locale: SupportedLocale,
): string {
  return locale === 'vi' ? item.descriptionVi : item.descriptionEn;
}

export const RecipesHubPage: React.FC<{
  locale: SupportedLocale;
  cuisineOverride?: CuisineKey | 'all';
  ssrData?: SiteSsrPayload | null;
}> = ({ locale, cuisineOverride, ssrData }) => {
  const params = useParams<{ cuisine?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const dict = getSiteDictionary(locale);
  const rc = dict.recipes;
  const lpath = (p: string) => buildLocalizedPath(locale, p);

  const paramCuisine = (cuisineOverride ?? params.cuisine ?? 'all') as CuisineKey | 'all';
  const activeCuisine: CuisineKey | 'all' =
    paramCuisine !== 'all' && (CUISINE_ORDER as readonly string[]).includes(paramCuisine)
      ? paramCuisine
      : 'all';

  const [query, setQuery] = useState<string>(() => searchParams.get('q') ?? '');
  const [allIndex, setAllIndex] = useState<SiteRecipeIndexEntry[] | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(36);

  // Sync URL ?q= parameter (for Google Sitelinks SearchAction compatibility)
  useEffect(() => {
    const qParam = searchParams.get('q') ?? '';
    if (qParam !== query) setQuery(qParam);
  }, [searchParams]);

  // Lazily load full 500-recipe compact index in browser for instant client search across all 500 dishes
  useEffect(() => {
    let active = true;
    fetch('/recipes-index.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((raw) => {
        const data = raw as { recipes?: SiteRecipeIndexEntry[] } | null;
        if (active && Array.isArray(data?.recipes)) {
          setAllIndex(data.recipes);
        }
      })
      .catch(() => {
        // Keep SSR preview gracefully
      });
    return () => {
      active = false;
    };
  }, []);

  const sourceList = allIndex ?? ssrData?.recipesPreview ?? [];
  const totalCount = allIndex?.length ?? ssrData?.recipesTotal ?? 500;
  const cuisineCounts = useMemo(() => {
    if (allIndex) {
      const counts: Record<string, number> = {};
      for (const r of allIndex) counts[r.cuisine] = (counts[r.cuisine] ?? 0) + 1;
      return counts;
    }
    return (
      ssrData?.cuisineCounts ?? {
        vietnamese: 202,
        chinese: 73,
        japanese: 57,
        korean: 57,
        thai: 56,
        italian: 55,
      }
    );
  }, [allIndex, ssrData?.cuisineCounts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sourceList.filter((item) => {
      if (activeCuisine !== 'all' && item.cuisine !== activeCuisine) return false;
      if (!q) return true;
      return (
        item.titleVi.toLowerCase().includes(q) ||
        item.titleEn.toLowerCase().includes(q) ||
        item.descriptionVi.toLowerCase().includes(q) ||
        item.descriptionEn.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q)
      );
    });
  }, [sourceList, activeCuisine, query]);

  const shown = filtered.slice(0, visibleLimit);
  const barePath = activeCuisine === 'all' ? '/recipes' : `/recipes/cuisine/${activeCuisine}`;

  const handleSearchChange = (value: string) => {
    setQuery(value);
    setVisibleLimit(36);
    if (value.trim()) {
      setSearchParams({ q: value }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  return (
    <SatelliteShell locale={locale} barePath={barePath}>
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col gap-8">
        <header className="flex flex-col gap-3 max-w-3xl">
          <div>
            <span className="inline-flex items-center rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] px-3.5 py-1 text-xs font-extrabold text-[var(--tkv-primary)]">
              {rc.eyebrow}
            </span>
          </div>
          <h1 className="tkv-heading text-3xl sm:text-[2.6rem] font-black text-[var(--tkv-ink)] leading-tight">
            {activeCuisine === 'all' ? rc.h1 : `${rc.cuisineLabels[activeCuisine]} (${cuisineCounts[activeCuisine] ?? ''})`}
          </h1>
          <p className="text-base sm:text-lg text-[var(--tkv-ink-secondary)]">
            {activeCuisine === 'all' ? rc.subtitle : rc.cuisineDescriptions[activeCuisine]}
          </p>
        </header>

        <div className="rounded-2xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] p-4 sm:p-5">
          <p className="text-xs uppercase tracking-wider font-extrabold text-[var(--tkv-primary)] mb-1">
            {rc.tldrLabel}
          </p>
          <p className="text-sm text-[var(--tkv-ink)] font-medium leading-relaxed">{rc.tldr}</p>
        </div>

        {/* Search + 6-Cuisine Navigation Chips (Real <Link>s for SEO crawlability!) */}
        <div className="flex flex-col gap-4">
          <input
            type="search"
            aria-label={rc.searchPlaceholder}
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={rc.searchPlaceholder}
            className="tkv-focusable w-full min-h-[50px] px-4 py-3 rounded-2xl bg-white border border-[var(--tkv-border-strong)] text-base text-[var(--tkv-ink)] placeholder:text-[var(--tkv-ink-muted)]"
          />

          <nav aria-label="Cuisines" className="flex flex-wrap gap-2">
            <Link
              to={lpath('/recipes')}
              aria-current={activeCuisine === 'all' ? 'page' : undefined}
              className={`tkv-focusable min-h-[40px] px-4 py-1.5 rounded-full text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 border transition-colors ${
                activeCuisine === 'all'
                  ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)]'
                  : 'bg-white text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)] hover:border-[var(--tkv-primary)]'
              }`}
            >
              <span>{rc.allCuisines}</span>
              <span className="tabular-nums opacity-85">({totalCount})</span>
            </Link>

            {CUISINE_ORDER.map((c) => (
              <Link
                key={c}
                to={lpath(`/recipes/cuisine/${c}`)}
                aria-current={activeCuisine === c ? 'page' : undefined}
                className={`tkv-focusable min-h-[40px] px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 border transition-colors ${
                  activeCuisine === c
                    ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)]'
                    : 'bg-white text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)] hover:border-[var(--tkv-primary)]'
                }`}
              >
                <span>{rc.cuisineLabels[c]}</span>
                <span className="tabular-nums opacity-75">({cuisineCounts[c] ?? 0})</span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Results Grid */}
        {shown.length === 0 ? (
          <div className="rounded-2xl bg-white border border-[var(--tkv-border)] p-8 text-center text-sm font-semibold text-[var(--tkv-ink-secondary)]">
            {rc.emptySearch}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {shown.map((item) => (
              <article key={item.slug} className="tkv-bento-card overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="aspect-[4/3] overflow-hidden bg-[var(--tkv-surface-mint)]">
                    <img
                      src={item.imageUrl}
                      alt={recipeTitleForLocale(item, locale)}
                      width={640}
                      height={480}
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 flex-wrap text-xs font-bold tabular-nums">
                      <span className="px-2.5 py-0.5 rounded-full bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)]">
                        {rc.cuisineLabels[item.cuisine]}
                      </span>
                      <span className="text-[var(--tkv-ink-muted)]">
                        {item.cookTimeMinutes} {rc.minutesUnit}
                      </span>
                      <span className="text-[var(--tkv-ink-muted)]">
                        · {item.servings} {rc.servingsLabel}
                      </span>
                    </div>
                    <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)] leading-snug">
                      <Link to={lpath(`/recipes/${item.slug}`)} className="hover:text-[var(--tkv-primary)]">
                        {recipeTitleForLocale(item, locale)}
                      </Link>
                    </h2>
                    <p className="text-xs sm:text-sm text-[var(--tkv-ink-secondary)] line-clamp-2 leading-relaxed">
                      {recipeDescForLocale(item, locale)}
                    </p>
                  </div>
                </div>
                <div className="px-4 pb-4">
                  <Link
                    to={lpath(`/recipes/${item.slug}`)}
                    className="tkv-focusable w-full min-h-[42px] px-4 py-2 rounded-full bg-[var(--tkv-bg)] hover:bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border)] text-xs font-extrabold text-[var(--tkv-primary)] inline-flex items-center justify-center"
                  >
                    {rc.viewRecipe} →
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        {filtered.length > visibleLimit && (
          <div className="flex justify-center pt-2">
            <button
              type="button"
              onClick={() => setVisibleLimit((n) => n + 48)}
              className="tkv-focusable min-h-[46px] px-6 py-2.5 rounded-full bg-white border border-[var(--tkv-primary)] text-[var(--tkv-primary)] font-extrabold text-sm hover:bg-[var(--tkv-surface-mint)]"
            >
              + {Math.min(48, filtered.length - visibleLimit)} / {filtered.length} {rc.countLabel}
            </button>
          </div>
        )}
      </section>
    </SatelliteShell>
  );
};

export const RecipeDetailPage: React.FC<{
  locale: SupportedLocale;
  ssrData?: SiteSsrPayload | null;
}> = ({ locale, ssrData }) => {
  const params = useParams<{ slug: string }>();
  const slug = params.slug || ssrData?.recipe?.slug || '';
  const dict = getSiteDictionary(locale);
  const rc = dict.recipes;
  const lpath = (p: string) => buildLocalizedPath(locale, p);

  const initialRecipe = ssrData?.recipe?.slug === slug ? ssrData.recipe : null;
  const [recipe, setRecipe] = useState<SiteRecipeRecord | null>(initialRecipe);
  const [related, setRelated] = useState<SiteRecipeIndexEntry[]>(ssrData?.relatedRecipes ?? []);
  const [loading, setLoading] = useState(!initialRecipe);

  const [servings, setServings] = useState<number>(initialRecipe?.servings ?? 4);
  const [unitSystem, setUnitSystem] = useState<DisplayUnitSystem>(
    LOCALE_CATALOG[locale].defaultUnitSystem,
  );

  useEffect(() => {
    if (ssrData?.recipe?.slug === slug) {
      setRecipe(ssrData.recipe);
      setServings(ssrData.recipe.servings);
      setRelated(ssrData.relatedRecipes ?? []);
      setLoading(false);
      return;
    }
    if (!slug) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    fetch(`/recipes-data/${encodeURIComponent(slug)}.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((raw) => {
        const data = raw as { recipe?: SiteRecipeRecord; relatedRecipes?: SiteRecipeIndexEntry[] } | null;
        if (!active) return;
        if (data?.recipe) {
          setRecipe(data.recipe);
          setServings(data.recipe.servings);
          setRelated(data.relatedRecipes ?? []);
        } else {
          setRecipe(null);
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setRecipe(null);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [slug, ssrData]);

  if (!loading && !recipe) {
    return <SatelliteNotFoundPage locale={locale} />;
  }

  if (!recipe) {
    return (
      <SatelliteShell locale={locale} barePath={`/recipes/${slug}`}>
        <div className="max-w-3xl mx-auto px-4 py-16 text-center text-sm font-semibold text-[var(--tkv-ink-muted)]">
          Takolio...
        </div>
      </SatelliteShell>
    );
  }

  const title = recipeTitleForLocale(recipe, locale);
  const description = recipeDescForLocale(recipe, locale);
  const scaleFactor = servings / Math.max(1, recipe.servings);

  return (
    <SatelliteShell locale={locale} barePath={`/recipes/${recipe.slug}`}>
      <article className="max-w-[1040px] mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col gap-9">
        <nav aria-label="Breadcrumb" className="text-xs font-bold text-[var(--tkv-ink-muted)] flex flex-wrap items-center gap-2">
          <Link to={lpath('/')} className="hover:text-[var(--tkv-primary)]">{dict.nav.home}</Link>
          <span aria-hidden="true">/</span>
          <Link to={lpath('/recipes')} className="hover:text-[var(--tkv-primary)]">{dict.nav.recipes}</Link>
          <span aria-hidden="true">/</span>
          <Link to={lpath(`/recipes/cuisine/${recipe.cuisine}`)} className="hover:text-[var(--tkv-primary)]">
            {rc.cuisineLabels[recipe.cuisine]}
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-[var(--tkv-ink)]">{title}</span>
        </nav>

        <header className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs font-extrabold tabular-nums">
              <span className="px-3 py-1 rounded-full bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] border border-[var(--tkv-border-mint)]">
                {rc.cuisineLabels[recipe.cuisine]}
              </span>
              <span className="px-3 py-1 rounded-full bg-[var(--tkv-surface-coral)] text-[var(--tkv-coral-ink)] border border-[var(--tkv-border-coral)]">
                {recipe.cookTimeMinutes} {rc.minutesUnit}
              </span>
              <span className="px-3 py-1 rounded-full bg-white text-[var(--tkv-ink-secondary)] border border-[var(--tkv-border)]">
                {rc.difficultyLabels[recipe.difficulty] ?? recipe.difficulty}
              </span>
            </div>

            <h1 className="tkv-heading text-3xl sm:text-[2.45rem] font-black text-[var(--tkv-ink)] leading-tight">
              {title}
            </h1>
            <p className="text-base text-[var(--tkv-ink-secondary)] leading-relaxed">{description}</p>

            <div className="flex flex-wrap gap-3 pt-1">
              <a
                href={buildAppHandoffUrl(`/recipes/${recipe.slug}`, locale)}
                rel="nofollow"
                className="tkv-focusable min-h-[48px] px-6 py-2.5 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white font-extrabold text-sm inline-flex items-center justify-center"
              >
                {rc.cookInAppCta} →
              </a>
              <a
                href={buildAppHandoffUrl('/auth?mode=guest', locale)}
                rel="nofollow"
                className="tkv-focusable min-h-[48px] px-5 py-2.5 rounded-full bg-white border border-[var(--tkv-primary)] text-[var(--tkv-primary)] font-extrabold text-sm inline-flex items-center justify-center"
              >
                {rc.checkFridgeCta}
              </a>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-3xl overflow-hidden border border-[var(--tkv-border)] bg-white shadow-[var(--tkv-shadow-card)]">
              <img
                src={recipe.imageUrl}
                alt={title}
                width={800}
                height={600}
                loading="eager"
                className="w-full aspect-[4/3] object-cover"
              />
            </div>
          </div>
        </header>

        {/* Interactive Deterministic Scaler (1-20) + Metric/Imperial Toggle */}
        <div className="rounded-2xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-extrabold text-[var(--tkv-ink)]">{rc.servingsLabel}:</span>
            <div className="inline-flex items-center rounded-full bg-white border border-[var(--tkv-border-strong)] p-1 gap-1">
              <button
                type="button"
                aria-label="Decrease servings"
                onClick={() => setServings((s) => Math.max(1, s - 1))}
                className="tkv-focusable w-9 h-9 rounded-full bg-[var(--tkv-bg)] hover:bg-[var(--tkv-surface-mint)] font-black text-base"
              >
                −
              </button>
              <span className="tabular-nums min-w-[3rem] text-center font-black text-base text-[var(--tkv-primary)]">
                {servings}
              </span>
              <button
                type="button"
                aria-label="Increase servings"
                onClick={() => setServings((s) => Math.min(20, s + 1))}
                className="tkv-focusable w-9 h-9 rounded-full bg-[var(--tkv-bg)] hover:bg-[var(--tkv-surface-mint)] font-black text-base"
              >
                +
              </button>
            </div>
          </div>

          <div className="inline-flex rounded-full bg-white border border-[var(--tkv-border-strong)] p-1 gap-1">
            <button
              type="button"
              onClick={() => setUnitSystem('metric')}
              className={`tkv-focusable px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                unitSystem === 'metric'
                  ? 'bg-[var(--tkv-primary)] text-white'
                  : 'text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-ink)]'
              }`}
            >
              {rc.metricLabel}
            </button>
            <button
              type="button"
              onClick={() => setUnitSystem('imperial')}
              className={`tkv-focusable px-3.5 py-1.5 rounded-full text-xs font-extrabold transition-colors ${
                unitSystem === 'imperial'
                  ? 'bg-[var(--tkv-primary)] text-white'
                  : 'text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-ink)]'
              }`}
            >
              {rc.imperialLabel}
            </button>
          </div>
        </div>

        {/* Ingredients & Steps */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <section className="lg:col-span-5 rounded-3xl bg-white border border-[var(--tkv-border)] p-6 flex flex-col gap-4 shadow-[var(--tkv-shadow-card)]">
            <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink)]">{rc.ingredientsHeading}</h2>
            <ul className="flex flex-col gap-2.5 text-sm">
              {recipe.ingredients.map((ing, idx) => {
                const scaled = formatDisplayQuantity(
                  ing.quantity * scaleFactor,
                  ing.unit,
                  unitSystem,
                  locale,
                );
                const ingName = recipeIngredientForLocale(ing, locale);
                return (
                  <li
                    key={`${ing.ingredientId}-${idx}`}
                    className="flex items-baseline justify-between gap-3 border-b border-[var(--tkv-border)]/70 pb-2 last:border-b-0 last:pb-0"
                  >
                    <span className="font-semibold text-[var(--tkv-ink)]">{ingName}</span>
                    <span className="tabular-nums font-extrabold text-[var(--tkv-primary)] shrink-0">
                      {scaled.text}
                    </span>
                  </li>
                );
              })}
            </ul>

            {recipe.nutrition?.calories ? (
              <div className="mt-2 pt-4 border-t border-[var(--tkv-border)] flex flex-col gap-2">
                <h3 className="tkv-heading text-sm font-extrabold text-[var(--tkv-ink)]">{rc.nutritionHeading}</h3>
                <div className="grid grid-cols-2 gap-2 text-xs tabular-nums">
                  <div className="rounded-xl bg-[var(--tkv-bg)] px-3 py-2">
                    <span className="text-[var(--tkv-ink-muted)] block">{rc.caloriesLabel}</span>
                    <strong className="text-sm text-[var(--tkv-ink)]">{Math.round(recipe.nutrition.calories)} kcal</strong>
                  </div>
                  {recipe.nutrition.proteinG !== undefined && (
                    <div className="rounded-xl bg-[var(--tkv-bg)] px-3 py-2">
                      <span className="text-[var(--tkv-ink-muted)] block">{rc.proteinLabel}</span>
                      <strong className="text-sm text-[var(--tkv-ink)]">{Math.round(recipe.nutrition.proteinG)} g</strong>
                    </div>
                  )}
                  {recipe.nutrition.fatG !== undefined && (
                    <div className="rounded-xl bg-[var(--tkv-bg)] px-3 py-2">
                      <span className="text-[var(--tkv-ink-muted)] block">{rc.fatLabel}</span>
                      <strong className="text-sm text-[var(--tkv-ink)]">{Math.round(recipe.nutrition.fatG)} g</strong>
                    </div>
                  )}
                  {recipe.nutrition.carbG !== undefined && (
                    <div className="rounded-xl bg-[var(--tkv-bg)] px-3 py-2">
                      <span className="text-[var(--tkv-ink-muted)] block">{rc.carbLabel}</span>
                      <strong className="text-sm text-[var(--tkv-ink)]">{Math.round(recipe.nutrition.carbG)} g</strong>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </section>

          <section className="lg:col-span-7 rounded-3xl bg-white border border-[var(--tkv-border)] p-6 flex flex-col gap-4 shadow-[var(--tkv-shadow-card)]">
            <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink)]">{rc.stepsHeading}</h2>
            <ol className="flex flex-col gap-4">
              {recipe.steps.map((step, idx) => {
                const rawInstruction = locale === 'vi' ? step.instructionVi : step.instructionEn;
                const displayText = convertStepTemperatures(rawInstruction, unitSystem);
                return (
                  <li key={step.stepNumber || idx} className="flex items-start gap-3.5">
                    <span className="tabular-nums w-8 h-8 rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] text-[var(--tkv-primary)] font-black text-xs inline-flex items-center justify-center shrink-0 mt-0.5">
                      {step.stepNumber || idx + 1}
                    </span>
                    <div className="flex flex-col gap-1 min-w-0">
                      <p className="text-sm sm:text-base text-[var(--tkv-ink)] leading-relaxed">{displayText}</p>
                      {step.timerMinutes ? (
                        <span className="tabular-nums text-xs font-bold text-[var(--tkv-coral-ink)]">
                          ⏱ {step.timerMinutes} {rc.minutesUnit}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </div>

        {/* Related Recipes */}
        {related.length > 0 && (
          <section className="flex flex-col gap-4 pt-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink)]">{rc.relatedHeading}</h2>
              <Link to={lpath('/recipes')} className="text-sm font-extrabold text-[var(--tkv-primary)] hover:underline">
                {rc.backToHub} →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {related.slice(0, 4).map((rel) => (
                <Link
                  key={rel.slug}
                  to={lpath(`/recipes/${rel.slug}`)}
                  className="tkv-focusable tkv-bento-card overflow-hidden flex flex-col"
                >
                  <img
                    src={rel.imageUrl}
                    alt={recipeTitleForLocale(rel, locale)}
                    width={480}
                    height={360}
                    loading="lazy"
                    className="w-full aspect-[4/3] object-cover"
                  />
                  <div className="p-3.5 flex flex-col gap-1">
                    <h3 className="tkv-heading text-sm font-extrabold text-[var(--tkv-ink)] line-clamp-2">
                      {recipeTitleForLocale(rel, locale)}
                    </h3>
                    <p className="text-xs text-[var(--tkv-ink-muted)] tabular-nums">
                      {rel.cookTimeMinutes} {rc.minutesUnit} · {rel.servings} {rc.servingsLabel}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </SatelliteShell>
  );
};
