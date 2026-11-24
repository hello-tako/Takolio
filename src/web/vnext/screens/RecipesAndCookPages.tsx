import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { scaleRecipeServings, type RecipeScoringContext } from '@frigo/recipes';
import '../styles/tokens.css';
import '../styles/vnext-adapted.css';
import { useAuthStore } from '../../stores/useAuthStore';
import { useCookingStore } from '../../stores/useCookingStore';
import { api } from '../../services/api';
import { fetchJson } from '../../services/http';
import { queryKeys } from '../../lib/queryKeys';
import {
  discoveryRequest,
  readDiscoveryFilters,
  resetDiscoveryFilters,
  updateDiscoveryFilters,
} from '../../lib/recipe-discovery';
import { resolveRecipeImage } from '../../lib/recipe-media';
import { cookingQuantityText } from '../../lib/cooking-review';
import { submitCookingCompletion } from '../../lib/cooking-completion';
import { capturePrivateSession } from '../../lib/private-session';
import { voiceChef } from '../../lib/voice-chef';
import { audioEffects } from '../../lib/audio-effects';
import { useFamilyPreferences } from '../../features/family/useFamilyPreferences';
import { FavoritesCollection } from '../../features/favorites/FavoritesCollection';
import { vnextHref } from '../feature';
import { useVNextSeo } from '../lib/seo';
import { ConsumerStudioShell } from '../components/Shells';
import {
  TkvBadge,
  TkvButton,
  TkvEmptyState,
  TkvErrorState,
  TkvSearchField,
  TkvSkeleton,
  TkvSurface,
} from '../components/Primitives';
import { BrandFeatureIcon, BrandLockup, MascotIllustration, VerifiedDishImage } from '../components/VNextMedia';
import { VNextIcon } from '../components/VNextIcons';
import { TkvConfettiBurst } from '../components/LivingMotion';
import {
  containsVietnameseDiacritics,
  formatLocalizedMeasure,
  localizeCuisine,
  localizeErrorText,
  localizeIngredientName,
  localizeRecipeCategory,
  localizeRecipeSteps,
  localizeRecipeTitle,
  localizeUnit,
  useLocaleText,
} from '../../i18n/app-i18n';

const QUICK_CATEGORY_IDS = [
  'mon_kho',
  'mon_canh',
  'mon_xao',
  'mon_bun_pho',
  'mon_cuon_nom',
  'mon_chay',
] as const;

/**
 * C15 / C16 / C17 — Khám phá món ăn · Kết quả tìm kiếm · Món đã lưu (`/recipes`).
 * Matches C15.png 1:1 on mobile (2-col dish card grid) and desktop (3-col studio grid),
 * preserving URL-driven filters, cursor pagination, and registered vs guest FavoritesCollection.
 */
export const C15RecipesDiscoveryVNext: React.FC = () => {
  const { l, locale } = useLocaleText();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const savedView = params.get('view') === 'saved';
  const filters = readDiscoveryFilters(params);
  const isGuest = useAuthStore((s) => s.isGuest);
  const householdSize = useAuthStore((s) => s.householdSize);
  const familyPrefs = useFamilyPreferences(!isGuest);
  const effectiveServings =
    filters.servings ??
    familyPrefs.data?.preferences.householdSize ??
    (Number.isInteger(householdSize) && householdSize >= 1 ? householdSize : 2);

  const screenId = savedView ? 'C17' : filters.q.trim() ? 'C16' : 'C15';

  const quickCategoryLabel = (id: (typeof QUICK_CATEGORY_IDS)[number]) => {
    if (locale !== 'vi') return localizeRecipeCategory(id, locale);
    if (id === 'mon_bun_pho') return l('Bún · Phở', 'Noodles');
    if (id === 'mon_cuon_nom') return l('Gỏi · Nộm', 'Salads & Rolls');
    return localizeRecipeCategory(id, locale);
  };

  useVNextSeo({
    title: savedView
      ? l('Món ăn đã lưu', 'Saved recipes')
      : filters.q.trim()
        ? l(`Tìm món: ${filters.q.trim()}`, `Search recipes: ${filters.q.trim()}`)
        : l('Khám phá món ăn', 'Explore recipes'),
    description: l(
      'Tìm món ăn theo nguyên liệu sẵn có trong tủ lạnh, thời gian nấu và khẩu vị gia đình.',
      'Find recipes matched to your fridge ingredients, cook time, and family preferences.',
    ),
    canonicalPath: '/recipes',
    domainSurface: 'app',
    noindex: savedView,
  });

  const req = discoveryRequest({ ...filters, servings: effectiveServings });
  const discoveryQuery = useQuery({
    queryKey: queryKeys.recipeDiscovery(req),
    queryFn: () => api.getRecipeDiscovery(req),
    enabled: !savedView,
  });

  const pageData = discoveryQuery.data;
  const items = pageData?.items ?? [];
  const hasActiveFilter = Boolean(
    filters.q.trim() ||
      filters.cuisine ||
      filters.category ||
      filters.region ||
      filters.noBuy ||
      filters.fast,
  );

  const applyFilterPatch = (patch: Parameters<typeof updateDiscoveryFilters>[1]) => {
    const next = updateDiscoveryFilters(params, patch);
    next.delete('view');
    setParams(next);
  };

  const toggleSavedView = (enable: boolean) => {
    const next = new URLSearchParams(params);
    if (enable) next.set('view', 'saved');
    else next.delete('view');
    setParams(next);
  };

  const clearDiscoveryFilters = () => {
    const next = resetDiscoveryFilters(params);
    const vnextVal = params.get('vnext');
    if (vnextVal) next.set('vnext', vnextVal);
    setParams(next, { replace: true });
  };

  const returnCurrentUrl = `${location.pathname}${location.search}`;

  return (
    <ConsumerStudioShell screenId={screenId}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <BrandFeatureIcon name="recipes" size={48} />
            <div>
              <p className="tkv-eyebrow text-xs font-semibold uppercase tracking-widest text-[var(--tkv-ink-muted,#52706A)] tabular-nums">
                {l(
                  `Kho công thức gia đình · Khẩu phần ${effectiveServings} người`,
                  `Family recipe catalog · ${effectiveServings} ${effectiveServings === 1 ? 'serving' : 'servings'}`,
                )}
              </p>
              <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#152E2C)] mt-0.5 tabular-nums">
                {savedView
                  ? l('Món đã lưu', 'Saved recipes')
                  : filters.q.trim()
                    ? l(
                        `Kết quả tìm kiếm (${pageData?.total ?? items.length})`,
                        `Search results (${pageData?.total ?? items.length})`,
                      )
                    : l('Khám phá món ăn', 'Explore recipes')}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={!savedView}
              onClick={() => toggleSavedView(false)}
              className={clsx(
                'tkv-focusable min-h-[44px] px-4 py-2 rounded-full text-sm font-semibold border transition-colors',
                !savedView
                  ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] shadow-xs'
                  : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink)] border-[var(--tkv-border)] hover:border-[var(--tkv-border-strong)]',
              )}
            >
              {l('Khám phá', 'Explore')}
            </button>
            <button
              type="button"
              aria-pressed={savedView}
              onClick={() => toggleSavedView(true)}
              className={clsx(
                'tkv-focusable min-h-[44px] px-4 py-2 rounded-full text-sm font-semibold border transition-colors',
                savedView
                  ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] shadow-xs'
                  : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink)] border-[var(--tkv-border)] hover:border-[var(--tkv-border-strong)]',
              )}
            >
              {l('Đã lưu', 'Saved')}
            </button>
          </div>
        </div>

        {savedView ? (
          <div className="tkv-adapted-surface" data-tkv-surface-adapt="1">
            <FavoritesCollection servings={effectiveServings} />
          </div>
        ) : (
          <>
            <TkvSearchField
              value={filters.q}
              onChange={(val) => applyFilterPatch({ q: val })}
              placeholder={l(
                'Tìm món, nguyên liệu, cách nấu…',
                'Search dishes, ingredients, or techniques…',
              )}
              label={l('Tìm công thức món ăn', 'Search recipes')}
            />

            {/* Brand Board Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1" aria-label={l('Bộ lọc món ăn', 'Recipe filters')}>
              <button
                type="button"
                aria-pressed={filters.cuisine === 'vietnamese'}
                onClick={() =>
                  applyFilterPatch({
                    cuisine: filters.cuisine === 'vietnamese' ? null : 'vietnamese',
                  })
                }
                className={clsx(
                  'tkv-focusable min-h-[44px] shrink-0 px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap border transition-colors',
                  filters.cuisine === 'vietnamese'
                    ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] shadow-xs'
                    : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink)] border-[var(--tkv-border)] hover:border-[var(--tkv-border-strong)]',
                )}
              >
                {localizeCuisine('vietnamese', locale)}
              </button>

              <button
                type="button"
                aria-pressed={filters.fast}
                onClick={() => applyFilterPatch({ fast: !filters.fast })}
                className={clsx(
                  'tkv-focusable min-h-[44px] shrink-0 px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap border transition-colors tabular-nums',
                  filters.fast
                    ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] shadow-xs'
                    : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink)] border-[var(--tkv-border)] hover:border-[var(--tkv-border-strong)]',
                )}
              >
                {l('Nấu nhanh (≤ 20p)', 'Quick (≤ 20m)')}
              </button>

              <button
                type="button"
                aria-pressed={filters.noBuy}
                onClick={() => applyFilterPatch({ noBuy: !filters.noBuy })}
                className={clsx(
                  'tkv-focusable min-h-[44px] shrink-0 px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap border transition-colors',
                  filters.noBuy
                    ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] shadow-xs'
                    : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink)] border-[var(--tkv-border)] hover:border-[var(--tkv-border-strong)]',
                )}
              >
                {l('Đủ nguyên liệu', 'Ready to cook')}
              </button>

              {QUICK_CATEGORY_IDS.map((catId) => {
                const active = filters.category === catId;
                return (
                  <button
                    key={catId}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      applyFilterPatch({
                        category: (active ? null : catId) as typeof filters.category,
                      })
                    }
                    className={clsx(
                      'tkv-focusable min-h-[44px] shrink-0 px-3.5 py-2 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap border transition-colors',
                      active
                        ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] shadow-xs'
                        : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)] hover:border-[var(--tkv-border-strong)]',
                    )}
                  >
                    {quickCategoryLabel(catId)}
                  </button>
                );
              })}

              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={clearDiscoveryFilters}
                  className="tkv-focusable min-h-[44px] shrink-0 px-3.5 py-2 rounded-full text-xs font-bold text-[var(--tkv-coral-ink)] hover:text-[var(--tkv-primary)] underline underline-offset-4 whitespace-nowrap"
                >
                  {l('Xóa bộ lọc', 'Clear filters')}
                </button>
              )}
            </div>

            {discoveryQuery.isPending ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }, (_, i) => (
                  <TkvSkeleton
                    key={i}
                    className="h-56"
                    label={l('Đang tải danh sách công thức…', 'Loading recipes…')}
                  />
                ))}
              </div>
            ) : discoveryQuery.isError ? (
              <TkvErrorState
                title={l('Chưa tải được kho công thức', 'Could not load recipes')}
                message={l(
                  'Không thể đọc dữ liệu gợi ý món ăn lúc này. Vui lòng thử lại.',
                  'Unable to load recipe recommendations right now. Please try again.',
                )}
                onRetry={() => void discoveryQuery.refetch()}
              />
            ) : items.length === 0 ? (
              <TkvSurface className="p-6 text-center space-y-3 bg-[var(--tkv-surface-muted,#E7F4EC)] border-[var(--tkv-border,#DCE6DE)]">
                <p className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink,#152E2C)]">
                  {l('Không có món ăn khớp điều kiện lọc hiện tại', 'No recipes match your current filters')}
                </p>
                <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)]">
                  {l(
                    'Thử mở rộng thời gian nấu, tắt chế độ “Đủ nguyên liệu” hoặc xóa từ khóa tìm kiếm.',
                    'Try expanding cook time, turning off “Ready to cook”, or clearing your search.',
                  )}
                </p>
                <TkvButton variant="secondary" onClick={clearDiscoveryFilters}>
                  {l('Xóa toàn bộ bộ lọc', 'Clear all filters')}
                </TkvButton>
              </TkvSurface>
            ) : (
              <>
                <ul className="grid grid-cols-1 min-[420px]:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5" aria-label={l('Danh sách món ăn', 'Recipe list')}>
                  {items.map(({ recipe, canCookWithoutBuying, missingRequiredIngredientCount }) => {
                    const displayTitle = localizeRecipeTitle(recipe, locale);
                    return (
                      <li key={recipe.id} className="min-w-0">
                        <Link
                          to={vnextHref(
                            `/recipes/${recipe.slug || recipe.id}?returnTo=${encodeURIComponent(returnCurrentUrl)}`,
                          )}
                          className="tkv-focusable h-full flex flex-col justify-between rounded-[var(--tkv-radius-card)] bg-[var(--tkv-surface)] border border-[var(--tkv-border)] overflow-hidden hover:border-[var(--tkv-border-strong)] transition-colors"
                        >
                          <div>
                            <div className="p-2 sm:p-2.5 bg-[var(--tkv-surface-mint)]">
                              <VerifiedDishImage
                                slug={recipe.slug}
                                title={displayTitle}
                                canonicalFallbackSrc={resolveRecipeImage(recipe)}
                                aspectClass="aspect-[4/3]"
                                className="rounded-xl"
                              />
                            </div>
                            <div className="p-3 sm:p-4 space-y-1.5">
                              <h2 className="tkv-heading text-sm sm:text-base font-bold text-[var(--tkv-ink)] line-clamp-2">
                                {displayTitle}
                              </h2>
                              <p className="text-xs text-[var(--tkv-ink-secondary)] tabular-nums">
                                {l(
                                  `${recipe.cookTimeMinutes} phút · ${recipe.servings} người`,
                                  `${recipe.cookTimeMinutes} min · ${recipe.servings} ${recipe.servings === 1 ? 'serving' : 'servings'}`,
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="px-3 sm:px-4 pb-3 sm:pb-4">
                            <TkvBadge
                              tone={canCookWithoutBuying ? 'success' : 'coral'}
                              icon={canCookWithoutBuying ? 'check' : 'shopping'}
                            >
                              <span className="tabular-nums">
                                {canCookWithoutBuying
                                  ? l('Đủ nguyên liệu', 'Ready to cook')
                                  : l(
                                      `Thiếu ${missingRequiredIngredientCount} mục`,
                                      `Missing ${missingRequiredIngredientCount}`,
                                    )}
                              </span>
                            </TkvBadge>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                {pageData && pageData.pages > 1 && (
                  <nav
                    aria-label={l('Phân trang danh sách món ăn', 'Recipe pagination')}
                    className="pt-2 flex items-center justify-between gap-2 tabular-nums"
                  >
                    <TkvButton
                      variant="secondary"
                      size="sm"
                      className="px-3 whitespace-nowrap shrink-0"
                      disabled={!pageData.previousCursor && pageData.page <= 1}
                      onClick={() =>
                        applyFilterPatch({
                          page: Math.max(1, pageData.page - 1),
                          cursor: pageData.previousCursor ?? undefined,
                        })
                      }
                    >
                      {l('Trang trước', 'Previous')}
                    </TkvButton>
                    <span className="text-xs font-bold text-[var(--tkv-ink-secondary)] whitespace-nowrap shrink-0">
                      {l(`Trang ${pageData.page} / ${pageData.pages}`, `Page ${pageData.page} / ${pageData.pages}`)}
                    </span>
                    <TkvButton
                      variant="secondary"
                      size="sm"
                      className="px-3 whitespace-nowrap shrink-0"
                      disabled={!pageData.nextCursor && pageData.page >= pageData.pages}
                      onClick={() =>
                        applyFilterPatch({
                          page: pageData.page + 1,
                          cursor: pageData.nextCursor ?? undefined,
                        })
                      }
                    >
                      {l('Trang tiếp', 'Next')}
                    </TkvButton>
                  </nav>
                )}
              </>
            )}
          </>
        )}
      </div>
    </ConsumerStudioShell>
  );
};

function formatTimerClock(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * C20 / C21 — Chuẩn bị nấu (`?stage=prep`) & Chế độ nấu từng bước (`/cook/:slug`, `/cooking/:id`).
 * First-class Direction A Kitchen Studio Cooking Sanctuary with Bé Mầm Bếp (`cooking` pose),
 * real `useCookingStore` timer lifecycle, Web Speech TTS, keyboard navigation, and zero stock deduction
 * during prep or cooking (stock is only deducted after explicit C22 confirmation).
 */
export const C20C21CookingStudioVNext: React.FC = () => {
  const { l, locale, unitSystem } = useLocaleText();
  const { slug, id } = useParams<{ slug?: string; id?: string }>();
  const recipeKey = slug || id || '';
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const isPrepStage = params.get('stage') === 'prep';
  const rawServings = params.get('servings') ?? '';
  const requestedServings =
    /^[1-9][0-9]?$/.test(rawServings) && Number(rawServings) <= 20 ? Number(rawServings) : undefined;
  const contentFingerprint = params.get('contentFingerprint') ?? undefined;

  const state = useCookingStore();
  const {
    activeRecipe,
    runId,
    startCooking,
    attempt,
    contentFingerprint: activeFingerprint,
    currentStepIndex,
    timerSecondsRemaining,
    isTimerRunning,
    timerGeneration,
  } = state;

  const [checkedPrep, setCheckedPrep] = useState<Record<string, boolean>>({});
  const [speaking, setSpeaking] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [confirmExit, setConfirmExit] = useState(false);
  const alertedGeneration = useRef(-1);

  const matchesActive = Boolean(
    activeRecipe &&
      (activeRecipe.slug === recipeKey || activeRecipe.id === recipeKey) &&
      (requestedServings === undefined || activeRecipe.servings === requestedServings) &&
      (contentFingerprint === undefined || activeFingerprint === contentFingerprint),
  );
  const blockedOtherRun = Boolean(attempt && !['saved', 'queued'].includes(attempt.status) && !matchesActive);

  const activeRecipeTitle = activeRecipe ? localizeRecipeTitle(activeRecipe, locale) : '';
  const localizedSteps = useMemo(
    () => (activeRecipe ? localizeRecipeSteps(activeRecipe, locale, unitSystem) : []),
    [activeRecipe, locale, unitSystem],
  );

  useVNextSeo({
    title: isPrepStage
      ? l('Chuẩn bị nấu', 'Cooking prep')
      : l('Chế độ nấu từng bước', 'Step-by-step cooking'),
    description: l(
      'Không gian đứng bếp tập trung với hẹn giờ từng công đoạn và hướng dẫn rõ ràng.',
      'Focused countertop cooking studio with per-step timers and clear instructions.',
    ),
    canonicalPath: recipeKey ? `/cook/${recipeKey}` : '/recipes',
    domainSurface: 'app',
    noindex: true,
  });

  const recipeQuery = useQuery({
    queryKey: queryKeys.recipe(recipeKey, contentFingerprint),
    queryFn: () => api.getRecipeById(recipeKey, contentFingerprint),
    enabled: Boolean(recipeKey) && !matchesActive && !blockedOtherRun,
  });

  const inventoryQuery = useQuery({
    queryKey: queryKeys.inventory(),
    queryFn: () => api.getInventory(),
    enabled: Boolean(recipeKey) && !matchesActive && !blockedOtherRun,
  });

  useEffect(() => {
    if (!matchesActive && !blockedOtherRun && recipeQuery.data?.recipe && inventoryQuery.data) {
      const scaled =
        requestedServings === undefined
          ? recipeQuery.data.recipe
          : scaleRecipeServings(recipeQuery.data.recipe, requestedServings);
      startCooking(scaled, inventoryQuery.data, recipeQuery.data.contentFingerprint);
    }
  }, [
    matchesActive,
    blockedOtherRun,
    recipeQuery.data,
    inventoryQuery.data,
    requestedServings,
    startCooking,
  ]);

  useEffect(() => {
    if (!isTimerRunning) return;
    const tick = () => useCookingStore.getState().tickTimer();
    const interval = setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [isTimerRunning]);

  useEffect(() => {
    if (timerSecondsRemaining !== 0 || alertedGeneration.current === timerGeneration) return;
    alertedGeneration.current = timerGeneration;
    audioEffects.playTimerAlertSound();
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate([180, 80, 180]);
      }
    } catch {
      // Ignore vibration API restrictions on unsupported browsers.
    }
  }, [timerSecondsRemaining, timerGeneration]);

  useEffect(() => {
    voiceChef.stopSpeaking();
    setSpeaking(false);
    setVoiceMessage('');
  }, [currentStepIndex]);

  useEffect(() => {
    return () => {
      voiceChef.stopSpeaking();
    };
  }, []);

  useEffect(() => {
    if (isPrepStage || !matchesActive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight') {
        useCookingStore.getState().nextStep();
      } else if (e.key === 'ArrowLeft') {
        useCookingStore.getState().prevStep();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPrepStage, matchesActive]);

  if (blockedOtherRun) {
    return (
      <ConsumerStudioShell
        screenId="C20"
        title={l('Kiểm tra lần nấu trước', 'Review previous cook')}
        backTo={vnextHref('/recipes')}
      >
        <TkvSurface tone="saffron" className="max-w-xl mx-auto p-6 space-y-4">
          <TkvBadge tone="warning" icon="info">
            {l('Chống trừ kho trùng lặp', 'Duplicate deduction protection')}
          </TkvBadge>
          <h1 className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink)]">
            {l('Cần kiểm tra lần nấu trước', 'Review your previous cooking session')}
          </h1>
          <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">
            {l(
              `Bạn còn một yêu cầu hoàn tất đang chờ kiểm tra cho món ${activeRecipeTitle}. Hãy hoàn tất hoặc đóng yêu cầu đó trước khi bắt đầu món mới.`,
              `You still have a pending completion review for ${activeRecipeTitle}. Finish or dismiss it before starting a new dish.`,
            )}
          </p>
          <TkvButton variant="coral" onClick={() => navigate(vnextHref('/cooking/complete'))}>
            {l('Mở màn hình kiểm tra lượng dùng (C22)', 'Open ingredient review (C22)')}
          </TkvButton>
        </TkvSurface>
      </ConsumerStudioShell>
    );
  }

  if (!matchesActive || !runId || !activeRecipe) {
    const err = recipeQuery.error || inventoryQuery.error;
    return (
      <div className="tkv-root tkv-immersive-cook-frame p-4 sm:p-8" data-tkv-screen={isPrepStage ? 'C20' : 'C21'}>
        <div className="max-w-2xl mx-auto space-y-6">
          <BrandLockup />
          {err ? (
            <TkvErrorState
              title={l('Chưa tải được dữ liệu máy chủ', 'Could not load server data')}
              message={l(
                'Chưa tải được dữ liệu công thức để bắt đầu chế độ nấu.',
                'Could not load recipe data to start cooking mode.',
              )}
              onRetry={() => {
                void recipeQuery.refetch();
                void inventoryQuery.refetch();
              }}
            />
          ) : (
            <TkvSurface className="p-6 space-y-4">
              <h1 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink)]">
                {l('Đang chuẩn bị không gian bếp…', 'Preparing your kitchen studio…')}
              </h1>
              <TkvSkeleton className="h-36" label={l('Đang tải dữ liệu…', 'Loading…')} />
              <TkvSkeleton className="h-24" label={l('Đang tải dữ liệu…', 'Loading…')} />
            </TkvSurface>
          )}
        </div>
      </div>
    );
  }

  const totalSteps = localizedSteps.length;
  const step = localizedSteps[currentStepIndex] ?? localizedSteps[0];
  const rawStep = activeRecipe.steps[currentStepIndex] ?? activeRecipe.steps[0];
  const visibleStepTip =
    rawStep?.tip && (locale === 'vi' || !containsVietnameseDiacritics(rawStep.tip))
      ? rawStep.tip
      : null;
  const isLastStep = currentStepIndex >= totalSteps - 1;
  const progressPct = totalSteps > 0 ? Math.round(((currentStepIndex + 1) / totalSteps) * 100) : 100;
  const defaultStepSeconds = Math.max(60, (step?.timerMinutes ?? 3) * 60);
  const timerRatio =
    timerSecondsRemaining !== null
      ? Math.max(0, Math.min(1, timerSecondsRemaining / Math.max(defaultStepSeconds, timerSecondsRemaining)))
      : 1;
  const ringCircumference = 2 * Math.PI * 36;
  const ringDashOffset = ringCircumference * (1 - timerRatio);

  const handleToggleSpeech = () => {
    if (!step) return;
    if (speaking) {
      voiceChef.stopSpeaking();
      setSpeaking(false);
      return;
    }
    const ok = voiceChef.speakInstruction(step.instruction, () => setSpeaking(false), locale);
    setSpeaking(ok);
    if (!ok) {
      setVoiceMessage(
        l(
          'Trình duyệt hiện tại không hỗ trợ đọc giọng nói tiếng Việt; bạn vẫn dùng đầy đủ nút bấm và hẹn giờ bên dưới.',
          'Your browser does not support voice readout; you can still use all step controls and timers below.',
        ),
      );
    }
  };

  return (
    <div
      className={clsx(
        'tkv-root tkv-immersive-cook-frame relative overflow-x-clip flex flex-col min-h-dvh transition-colors text-[var(--tkv-ink)]',
        isPrepStage
          ? 'bg-[var(--tkv-bg)]'
          : 'bg-gradient-to-b from-[var(--tkv-surface)] to-[var(--tkv-bg)]',
      )}
      data-tkv-screen={isPrepStage ? 'C20' : 'C21'}
    >
      {/* Distraction-Free Countertop Studio Top Bar */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/95 border-b border-[var(--tkv-border)] text-[var(--tkv-ink)] pt-[env(safe-area-inset-top,0px)]">
        <div className="px-3 sm:px-6 min-h-16 py-2 flex items-center justify-between gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setConfirmExit(true)}
            aria-label={l('Thoát bếp', 'Exit kitchen')}
            className="tkv-focusable min-h-[44px] inline-flex items-center gap-1.5 px-2.5 sm:px-3 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 text-[var(--tkv-ink-secondary)] hover:bg-[var(--tkv-surface-mint)] hover:text-[var(--tkv-ink)] transition-colors"
          >
            <VNextIcon name="arrow-left" size={18} className="shrink-0" />
            <span className="hidden min-[400px]:inline">{l('Thoát bếp', 'Exit kitchen')}</span>
            <span className="min-[400px]:hidden">{l('Thoát', 'Exit')}</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 tabular-nums bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] text-[var(--tkv-coral-ink)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary)] shrink-0" aria-hidden="true" />
              <span>
                {isPrepStage
                  ? l('Chuẩn bị nấu', 'Prep')
                  : l(`Bước ${currentStepIndex + 1} / ${totalSteps}`, `Step ${currentStepIndex + 1} / ${totalSteps}`)}
              </span>
            </span>
            {!isPrepStage && (
              <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] text-[var(--tkv-success-ink)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary)] shrink-0" aria-hidden="true" />
                <span>{l('Giữ sáng màn hình', 'Keep screen awake')}</span>
              </span>
            )}
            <span className="hidden sm:inline text-sm font-bold truncate max-w-[260px] text-[var(--tkv-ink)]">
              {activeRecipeTitle}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                const next = new URLSearchParams(params);
                if (isPrepStage) next.delete('stage');
                else next.set('stage', 'prep');
                setParams(next, { replace: true });
              }}
              className="tkv-focusable min-h-[44px] px-2.5 sm:px-3 rounded-xl text-xs font-bold whitespace-nowrap border border-[var(--tkv-border-strong)] bg-[var(--tkv-surface)] text-[var(--tkv-ink)] hover:bg-[var(--tkv-surface-mint)] transition-colors"
            >
              {isPrepStage ? l('Vào bước nấu', 'Start steps') : l('Xem sơ chế', 'View prep')}
            </button>
          </div>
        </div>
      </header>

      {confirmExit && (
        <div className="border-b border-[var(--tkv-border-saffron)] bg-[var(--tkv-surface-saffron)] text-[var(--tkv-warning-ink)] px-4 py-3">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs sm:text-sm font-medium">
              {l(
                'Thoát chế độ nấu ngay bây giờ sẽ không trừ bất kỳ nguyên liệu nào trong tủ lạnh của bạn.',
                'Exiting cooking mode now will not deduct any ingredients from your fridge.',
              )}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmExit(false)}
                className="tkv-focusable min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--tkv-surface)] border border-[var(--tkv-border-strong)] text-[var(--tkv-ink)] hover:bg-[var(--tkv-surface-mint)] transition-colors"
              >
                {l('Tiếp tục nấu', 'Keep cooking')}
              </button>
              <button
                type="button"
                onClick={() => {
                  voiceChef.stopSpeaking();
                  state.clearTimer();
                  navigate(vnextHref(`/recipes/${activeRecipe.slug || activeRecipe.id}`));
                }}
                className="tkv-focusable min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white transition-colors"
              >
                {l('Rời khỏi bếp', 'Leave kitchen')}
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10 flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 pt-5 pb-[calc(1.75rem+env(safe-area-inset-bottom,0px))] sm:py-8 space-y-6">
        {isPrepStage ? (
          /* C20 — Chuẩn bị nấu */
          <div className="space-y-6">
            <TkvSurface className="p-4 sm:p-6 bg-[var(--tkv-surface)] border-[var(--tkv-border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                <MascotIllustration pose="cooking" size={72} className="w-14 h-14 sm:w-[72px] sm:h-[72px] border border-[var(--tkv-border)] bg-[var(--tkv-bg)] shrink-0" />
                <div className="space-y-1 min-w-0 flex-1">
                  <p className="tkv-eyebrow text-xs font-semibold uppercase tracking-widest text-[var(--tkv-ink-muted,#52706A)] tabular-nums">
                    {l(
                      `Sẵn sàng nguyên liệu · ${activeRecipe.servings} khẩu phần`,
                      `Prep ingredients · ${activeRecipe.servings} ${activeRecipe.servings === 1 ? 'serving' : 'servings'}`,
                    )}
                  </p>
                  <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#152E2C)]">
                    {activeRecipeTitle}
                  </h1>
                  <p className="text-xs sm:text-sm text-[var(--tkv-ink-soft,#3C5954)] tabular-nums">
                    {l(
                      `Tổng thời gian khoảng ${activeRecipe.cookTimeMinutes} phút · ${totalSteps} bước thực hiện.`,
                      `About ${activeRecipe.cookTimeMinutes} min total · ${totalSteps} ${totalSteps === 1 ? 'step' : 'steps'}.`,
                    )}
                  </p>
                </div>
              </div>
            </TkvSurface>

            <TkvSurface className="p-5 sm:p-6 space-y-4 bg-white border-[var(--tkv-border,#DCE6DE)]">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink,#152E2C)] tabular-nums">
                  {l(
                    `Kiểm điểm nguyên liệu trên bàn sơ chế (${activeRecipe.ingredients.length})`,
                    `Check off prep ingredients (${activeRecipe.ingredients.length})`,
                  )}
                </h2>
                <TkvBadge tone="success" icon="shield">
                  {l('Chưa trừ kho ở bước chuẩn bị', 'No stock deducted during prep')}
                </TkvBadge>
              </div>
              <ul className="divide-y divide-[var(--tkv-border,#DCE6DE)]">
                {activeRecipe.ingredients.map((ing) => {
                  const key = `${ing.ingredientId}-${ing.name}`;
                  const checked = Boolean(checkedPrep[key]);
                  return (
                    <li key={key} className="py-3 flex items-center justify-between gap-3">
                      <label className="flex items-center gap-3 cursor-pointer min-h-[44px] flex-1">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setCheckedPrep((prev) => ({ ...prev, [key]: !checked }))}
                          className="w-5 h-5 rounded accent-[var(--tkv-primary,#196149)]"
                        />
                        <span
                          className={clsx(
                            'text-sm sm:text-base font-bold',
                            checked ? 'line-through text-[var(--tkv-ink-muted,#52706A)]' : 'text-[var(--tkv-ink,#152E2C)]',
                          )}
                        >
                          {localizeIngredientName(ing.ingredientId, ing.name, locale)}
                        </span>
                      </label>
                      <span className="text-sm font-bold tabular-nums text-[var(--tkv-ink,#152E2C)] shrink-0">
                        {locale === 'vi'
                          ? cookingQuantityText(ing.requiredQuantity, ing.unit, locale)
                          : formatLocalizedMeasure(ing.requiredQuantity, ing.unit, locale, unitSystem)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </TkvSurface>

            <TkvButton
              variant="primary"
              size="lg"
              fullWidth
              iconRight="arrow-right"
              onClick={() => {
                const next = new URLSearchParams(params);
                next.delete('stage');
                setParams(next, { replace: true });
              }}
              data-testid="c20-start-steps-cta"
            >
              {l(
                `Bắt đầu nấu từng bước (${totalSteps} bước)`,
                `Start step-by-step cooking (${totalSteps} ${totalSteps === 1 ? 'step' : 'steps'})`,
              )}
            </TkvButton>
          </div>
        ) : (
          /* C21 — Bright, Airy Sunlit Countertop Studio */
          <div className="space-y-6">
            {/* Step Progress Bar with smooth width transition */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--tkv-ink-soft,#3C5954)] tabular-nums">
                <span className="truncate pr-2">{activeRecipeTitle}</span>
                <span className="shrink-0">{l(`Hoàn thành ${progressPct}%`, `${progressPct}% complete`)}</span>
              </div>
              <div
                className="h-2 w-full rounded-full bg-[var(--tkv-ring-track,#F7E6DD)] overflow-hidden"
                role="progressbar"
                aria-label={l(
                  `Tiến độ nấu: bước ${currentStepIndex + 1} trên ${totalSteps}`,
                  `Cooking progress: step ${currentStepIndex + 1} of ${totalSteps}`,
                )}
                aria-valuenow={currentStepIndex + 1}
                aria-valuemin={1}
                aria-valuemax={totalSteps}
              >
                <div
                  className="h-full bg-[var(--tkv-primary,#196149)] transition-[width] duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Active Step Instruction Card — Crisp #FFFFFF Ceramic Countertop Card */}
            <div className="rounded-[24px] bg-white border border-[var(--tkv-border,#DCE6DE)] shadow-soft p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <MascotIllustration pose="cooking" size={52} className="border border-[var(--tkv-border,#DCE6DE)] bg-[var(--tkv-bg,#FFF9F1)] shrink-0" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-[var(--tkv-ink-muted,#52706A)] tabular-nums">
                      {l(`Công đoạn ${currentStepIndex + 1} / ${totalSteps}`, `Stage ${currentStepIndex + 1} / ${totalSteps}`)}
                    </p>
                    <h1 className="tkv-heading text-xl sm:text-2xl font-extrabold text-[var(--tkv-ink,#152E2C)] tabular-nums">
                      {l(`Bước ${currentStepIndex + 1}`, `Step ${currentStepIndex + 1}`)}
                    </h1>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex md:hidden items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--tkv-sage-soft,#E7F4EC)] border border-[var(--tkv-sage-border,#BDE0CC)] text-[var(--tkv-sage-ink,#134C39)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-sage,#196149)]" aria-hidden="true" />
                    <span>{l('Giữ sáng', 'Awake')}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleSpeech}
                    className="tkv-focusable min-h-[44px] px-3.5 py-2 rounded-xl border border-[var(--tkv-border-strong)] bg-[var(--tkv-bg)] hover:bg-[var(--tkv-surface-mint)] text-xs font-bold text-[var(--tkv-ink)] inline-flex items-center gap-2 transition-colors"
                  >
                    <VNextIcon name="volume" size={16} className="text-[var(--tkv-primary)] shrink-0" />
                    <span>{speaking ? l('Dừng đọc', 'Stop reading') : l('Đọc bước này', 'Read step')}</span>
                  </button>
                </div>
              </div>

              <p className="tkv-heading text-xl sm:text-[1.75rem] leading-relaxed font-semibold text-[var(--tkv-ink,#152E2C)]">
                {step?.instruction}
              </p>

              {visibleStepTip && (
                <p className="text-xs sm:text-sm text-[var(--tkv-honey-ink,#8A5205)] bg-[var(--tkv-honey-soft,#FFF5D6)] border-l-3 border-[var(--tkv-honey,#F6C453)] rounded-r-xl px-3.5 py-2">
                  {l(`Mẹo bếp: ${visibleStepTip}`, `Chef's tip: ${visibleStepTip}`)}
                </p>
              )}

              {voiceMessage && (
                <p role="status" className="text-xs text-[var(--tkv-ink-soft,#3C5954)] bg-[var(--tkv-surface-muted,#E7F4EC)] border border-[var(--tkv-border,#DCE6DE)] p-3 rounded-xl">
                  {voiceMessage}
                </p>
              )}

              {/* Circular Tabular Countdown Timer Panel — Warm Terracotta Ring on Blush Track */}
              <div className="rounded-2xl bg-[var(--tkv-bg,#FFF9F1)] border border-[var(--tkv-border,#DCE6DE)] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 88 88" className="w-16 h-16 -rotate-90" aria-hidden="true">
                      <circle
                        cx="44"
                        cy="44"
                        r="36"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="5"
                        className="text-[var(--tkv-ring-track,#F7E6DD)]"
                      />
                      <circle
                        cx="44"
                        cy="44"
                        r="36"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={ringCircumference}
                        strokeDashoffset={ringDashOffset}
                        className="text-[var(--tkv-primary,#196149)] transition-colors"
                      />
                    </svg>
                    <VNextIcon name="timer" size={20} className="absolute text-[var(--tkv-primary,#196149)]" />
                  </div>
                  <div>
                    <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--tkv-ink-muted,#52706A)]">
                      {(isTimerRunning || timerSecondsRemaining === 0) && (
                        <span className="w-2 h-2 rounded-full bg-[var(--tkv-primary,#196149)]" aria-hidden="true" />
                      )}
                      <span>
                        {timerSecondsRemaining === 0
                          ? l('Đã hết giờ công đoạn', 'Step timer finished')
                          : isTimerRunning
                            ? l('Đang đếm ngược', 'Counting down')
                            : l('Bộ hẹn giờ công đoạn', 'Step timer')}
                      </span>
                    </p>
                    <p
                      data-testid="c21-timer-readout"
                      className="tkv-heading text-3xl font-extrabold text-[var(--tkv-ink,#152E2C)] tabular-nums mt-0.5"
                    >
                      {timerSecondsRemaining !== null
                        ? formatTimerClock(timerSecondsRemaining)
                        : formatTimerClock(defaultStepSeconds)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {timerSecondsRemaining === null ? (
                    <button
                      type="button"
                      onClick={() => state.setTimer((step?.timerMinutes ?? 3) * 60)}
                      className="tkv-focusable min-h-[46px] px-4 py-2 rounded-xl bg-[var(--tkv-primary)] text-white hover:bg-[var(--tkv-primary-hover)] text-sm font-bold shadow-xs transition-colors"
                    >
                      {l('Bắt đầu hẹn giờ', 'Start timer')}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => state.toggleTimer()}
                        className="tkv-focusable min-h-[46px] px-4 py-2 rounded-xl bg-[var(--tkv-primary)] text-white hover:bg-[var(--tkv-primary-hover)] text-sm font-bold shadow-xs transition-colors"
                      >
                        {isTimerRunning ? l('Tạm dừng', 'Pause') : l('Tiếp tục', 'Resume')}
                      </button>
                      <button
                        type="button"
                        onClick={() => state.setTimer((timerSecondsRemaining ?? 0) + 60)}
                        className="tkv-focusable min-h-[46px] px-3.5 py-2 rounded-xl border border-[var(--tkv-border-strong)] bg-[var(--tkv-surface)] hover:bg-[var(--tkv-surface-mint)] text-sm font-semibold text-[var(--tkv-ink)] tabular-nums transition-colors"
                      >
                        {l('+1 phút', '+1 min')}
                      </button>
                      <button
                        type="button"
                        onClick={() => state.clearTimer()}
                        className="tkv-focusable min-h-[46px] px-3 py-2 rounded-xl text-xs font-semibold text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-ink)] transition-colors"
                      >
                        {l('Đặt lại', 'Reset')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Ingredient Reference Drawer */}
            <details className="rounded-2xl bg-[var(--tkv-surface)] border border-[var(--tkv-border)] px-4 sm:px-5 py-3 text-[var(--tkv-ink)]">
              <summary className="cursor-pointer min-h-[44px] flex items-center justify-between gap-2 font-bold text-sm tabular-nums">
                <span className="min-w-0">
                  {l(
                    `Nguyên liệu của món (${activeRecipe.ingredients.length} mục · ${activeRecipe.servings} người)`,
                    `Recipe ingredients (${activeRecipe.ingredients.length} items · ${activeRecipe.servings} ${activeRecipe.servings === 1 ? 'serving' : 'servings'})`,
                  )}
                </span>
                <VNextIcon name="chevron-right" size={18} className="text-[var(--tkv-ink-muted)] shrink-0" />
              </summary>
              <ul className="pt-3 mt-2 border-t border-[var(--tkv-border)] space-y-2 text-sm">
                {activeRecipe.ingredients.map((ing) => (
                  <li key={`${ing.ingredientId}-${ing.name}`} className="flex items-center justify-between gap-2">
                    <span className="text-[var(--tkv-ink-secondary)] font-medium min-w-0">
                      {localizeIngredientName(ing.ingredientId, ing.name, locale)}
                    </span>
                    <span className="font-bold tabular-nums text-[var(--tkv-ink)] shrink-0">
                      {locale === 'vi'
                        ? cookingQuantityText(ing.requiredQuantity, ing.unit, locale)
                        : formatLocalizedMeasure(ing.requiredQuantity, ing.unit, locale, unitSystem)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>

            {/* Primary Step Navigation Controls */}
            <div className="pt-2 grid grid-cols-2 gap-2.5 sm:gap-3">
              <button
                type="button"
                disabled={currentStepIndex <= 0}
                onClick={() => state.prevStep()}
                className="tkv-focusable min-h-[52px] px-3 sm:px-5 py-3 rounded-[var(--tkv-radius-btn)] border border-[var(--tkv-border-strong)] bg-[var(--tkv-surface)] hover:bg-[var(--tkv-surface-mint)] disabled:opacity-40 text-sm sm:text-base font-bold text-[var(--tkv-ink)] inline-flex items-center justify-center gap-1.5 sm:gap-2 transition-colors"
              >
                <VNextIcon name="arrow-left" size={18} className="shrink-0" />
                <span>{l('Bước trước', 'Previous step')}</span>
              </button>

              {isLastStep ? (
                <button
                  type="button"
                  onClick={() => {
                    voiceChef.stopSpeaking();
                    state.clearTimer();
                    navigate(vnextHref('/cooking/complete'));
                  }}
                  data-testid="c21-finish-cook-cta"
                  className="tkv-focusable min-h-[52px] px-3 sm:px-5 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white shadow-xs text-sm sm:text-base font-extrabold inline-flex items-center justify-center gap-1.5 sm:gap-2 transition-colors"
                >
                  <span>{l('Hoàn thành món', 'Finish dish')}</span>
                  <VNextIcon name="check" size={18} className="shrink-0" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => state.nextStep()}
                  data-testid="c21-next-step-cta"
                  className="tkv-focusable min-h-[52px] px-3 sm:px-5 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white shadow-xs text-sm sm:text-base font-extrabold inline-flex items-center justify-center gap-1.5 sm:gap-2 transition-colors"
                >
                  <span>{l('Bước tiếp theo', 'Next step')}</span>
                  <VNextIcon name="arrow-right" size={18} className="shrink-0" />
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

/**
 * C22 — Hoàn thành bữa ăn (`/cooking/complete`).
 * Pure Direction A Kitchen Studio actual-use ingredient review powered directly by `useCookingStore`
 * and `submitCookingCompletion` (preserves idempotent `commandId`, authoritative server stock check,
 * and zero phantom stock deduction).
 */
export const C22CookingCompleteVNext: React.FC = () => {
  const { l, locale } = useLocaleText();
  const navigate = useNavigate();
  const state = useCookingStore();
  const { runId, activeRecipe: recipe, deductions, deductionInputs, deductionErrors, attempt } = state;
  const [refreshMessage, setRefreshMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useVNextSeo({
    title: l('Hoàn thành bữa ăn', 'Complete meal'),
    description: l(
      'Kiểm tra lượng nguyên liệu thực tế đã dùng trước khi cập nhật tủ lạnh.',
      'Review actual ingredient quantities used before updating your fridge.',
    ),
    canonicalPath: '/cooking/complete',
    domainSurface: 'app',
    noindex: true,
  });

  if (!runId || !recipe) {
    return (
      <ConsumerStudioShell
        screenId="C22"
        title={l('Hoàn thành bữa ăn', 'Complete meal')}
        backTo={vnextHref('/recipes')}
        showContextualScan={false}
      >
        <div className="max-w-2xl mx-auto space-y-4">
          <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
            {l('Hoàn thành bữa ăn', 'Complete meal')}
          </h1>
          <TkvEmptyState
            pose="cooking"
            eyebrow={l('Takolio · Bếp nhà', 'Takolio · Home Kitchen')}
            title={l('Chưa có món ăn đang chờ hoàn tất', 'No dish waiting to be completed')}
            description={l(
              'Chọn một công thức và bắt đầu chế độ nấu từng bước để kiểm tra lượng nguyên liệu thực tế đã sử dụng ở cuối bữa.',
              'Choose a recipe and start step-by-step cooking to review actual ingredient usage when you finish.',
            )}
            primaryAction={
              <TkvButton variant="coral" onClick={() => navigate(vnextHref('/recipes'))}>
                {l('Khám phá kho công thức', 'Explore recipes')}
              </TkvButton>
            }
          />
        </div>
      </ConsumerStudioShell>
    );
  }

  const displayRecipeTitle = localizeRecipeTitle(recipe, locale);
  const locked = Boolean(attempt);
  const done = attempt?.status === 'saved' || attempt?.status === 'queued';

  const adjustLine = (index: number, deltaDir: number) => {
    const line = deductions[index];
    if (!line) return;
    const step = ['kg', 'l'].includes(line.unit) ? 0.1 : ['g', 'ml'].includes(line.unit) ? 10 : 1;
    const raw = deductionInputs[index] ?? '0';
    if (raw.trim() === '' || !Number.isFinite(Number(raw))) return;
    const nextVal = Math.max(0, Number((Number(raw) + deltaDir * step).toFixed(4)));
    state.editDeduction(index, String(nextVal));
  };

  const handleRefreshStock = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setRefreshMessage(
      l(
        'Đang tải lại tồn kho chính thức từ máy chủ…',
        'Reloading authoritative fridge stock from server…',
      ),
    );
    const isCurrent = capturePrivateSession();
    const activeRun = state.runId;
    try {
      const res = await fetchJson<{ items: RecipeScoringContext['inventory'] }>('/inventory');
      if (isCurrent() && useCookingStore.getState().runId === activeRun && Array.isArray(res.items)) {
        state.refreshStock(res.items);
        setRefreshMessage(
          l(
            'Đã tải lại tồn kho mới nhất. Vui lòng kiểm tra lại lượng dùng trước khi xác nhận.',
            'Latest fridge stock reloaded. Please review amounts used before confirming.',
          ),
        );
      }
    } catch {
      if (isCurrent()) {
        setRefreshMessage(
          l(
            'Chưa tải lại được tồn kho. Hãy kiểm tra kết nối mạng rồi thử lại.',
            'Could not reload fridge stock. Check your internet connection and try again.',
          ),
        );
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const invalidIdx = deductionErrors.findIndex(Boolean);
    if (invalidIdx >= 0) {
      document.getElementById(`cooking-use-${invalidIdx}`)?.focus();
      return;
    }
    void submitCookingCompletion();
  };

  return (
    <ConsumerStudioShell
      screenId="C22"
      title={l('Hoàn thành bữa ăn', 'Complete meal')}
      backTo={locked ? undefined : vnextHref(`/cook/${recipe.slug || recipe.id}?servings=${recipe.servings}`)}
      showContextualScan={false}
    >
      <form onSubmit={handleSubmit} noValidate className="max-w-3xl mx-auto space-y-6">
        <TkvSurface className="relative p-4 sm:p-6 bg-gradient-to-br from-[var(--tkv-surface)] to-[var(--tkv-surface-mint)] border-[var(--tkv-border-mint)] flex flex-col sm:flex-row items-start sm:items-center gap-4 overflow-visible tkv-enter-fade-up">
          <div className="relative shrink-0">
            {done && <TkvConfettiBurst />}
            <MascotIllustration
              pose={done ? 'achievement' : 'cooking'}
              size={84}
              motion={done ? 'cheer' : 'idle'}
              className="w-20 h-20 shrink-0"
            />
          </div>
          <div className="space-y-2 min-w-0">
            <TkvBadge tone={done ? 'success' : 'coral'} icon={done ? 'check' : 'recipes'}>
              {done
                ? l('Đã ghi nhận bữa nấu', 'Meal recorded')
                : l('Kiểm tra lượng thực dùng', 'Review actual usage')}
            </TkvBadge>
            <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#152E2C)]">
              {done
                ? attempt?.status === 'queued'
                  ? l('Đã lưu yêu cầu chờ đồng bộ', 'Saved offline — queued to sync')
                  : l('Đã cập nhật tủ lạnh thành công!', 'Fridge inventory updated!')
                : l('Hoàn thành bữa ăn', 'Complete meal')}
            </h1>
            <p className="text-sm font-bold text-[var(--tkv-ink,#152E2C)]">{displayRecipeTitle}</p>
            <p className="text-xs sm:text-sm text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
              {done
                ? attempt?.status === 'queued'
                  ? l(
                      'Thiết bị đang ngoại tuyến; yêu cầu sẽ gửi lên máy chủ ngay khi có mạng với khóa chống trừ trùng.',
                      'You are offline; this update will sync automatically once reconnected with duplicate-deduction protection.',
                    )
                  : l(
                      'Máy chủ đã xác nhận trừ đúng lượng nguyên liệu bạn đã dùng cho bữa ăn này.',
                      'The server has confirmed deducting the exact ingredient amounts you used for this meal.',
                    )
                : l(
                    'Điều chỉnh lượng nguyên liệu thực tế bạn đã dùng bên dưới. Tủ lạnh chỉ trừ kho một lần duy nhất sau khi bạn bấm xác nhận.',
                    'Adjust the actual ingredient quantities you used below. Your fridge stock is deducted once only after you confirm.',
                  )}
            </p>
          </div>
        </TkvSurface>

        {attempt?.error && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-sm text-[var(--tkv-accent-ink,#B33A22)] font-semibold space-y-2"
          >
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--tkv-danger)] shrink-0" aria-hidden="true" />
              <span>
                {localizeErrorText(
                  attempt.error,
                  'Could not confirm the cooking update. Please check your fridge stock and try again.',
                  attempt.error,
                  locale,
                )}
              </span>
            </p>
            {attempt.status === 'rejected' && (
              <TkvButton
                type="button"
                size="sm"
                variant="secondary"
                isLoading={isRefreshing}
                onClick={() => void handleRefreshStock()}
              >
                {l('Tải lại lượng trong tủ để kiểm tra', 'Reload fridge quantities to review')}
              </TkvButton>
            )}
          </div>
        )}

        {refreshMessage && (
          <p role="status" className="text-xs sm:text-sm font-semibold text-[var(--tkv-ink,#152E2C)]">
            {refreshMessage}
          </p>
        )}

        <TkvSurface className="p-5 sm:p-6 space-y-4 bg-white border-[var(--tkv-border,#DCE6DE)]">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink,#152E2C)] tabular-nums">
              {l(
                `Lượng thực tế đã dùng (${deductions.length} mục)`,
                `Actual amounts used (${deductions.length} items)`,
              )}
            </h2>
            <span className="text-xs font-semibold text-[var(--tkv-ink-muted,#52706A)]">
              {l('Nhập 0 nếu không dùng nguyên liệu đó', 'Enter 0 if you did not use an ingredient')}
            </span>
          </div>

          <div className="divide-y divide-[var(--tkv-border,#DCE6DE)]">
            {deductions.map((line, index) => {
              const displayLineName = localizeIngredientName(line.ingredientId, line.name, locale);
              const displayUnit = locale === 'vi' ? line.unit : localizeUnit(line.unit, locale);
              const rawErr = deductionErrors[index];
              const displayErr = rawErr
                ? localizeErrorText(
                    rawErr,
                    'Please enter a valid quantity within available stock.',
                    rawErr,
                    locale,
                  )
                : null;
              return (
                <div
                  key={`${line.ingredientId}-${index}`}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="min-w-0 space-y-0.5">
                    <label
                      htmlFor={`cooking-use-${index}`}
                      className="tkv-heading text-sm sm:text-base font-bold text-[var(--tkv-ink,#152E2C)] block"
                    >
                      {displayLineName}
                    </label>
                    <p className="text-xs text-[var(--tkv-ink-soft,#3C5954)] tabular-nums">
                      {l('Trong tủ:', 'In fridge:')}{' '}
                      <strong>{cookingQuantityText(line.currentQuantity, line.unit, locale)}</strong> ·{' '}
                      {l('Còn dự kiến:', 'Projected left:')}{' '}
                      <strong>
                        {displayErr
                          ? l('Chưa hợp lệ', 'Invalid')
                          : cookingQuantityText(line.remainingQuantity, line.unit, locale)}
                      </strong>
                    </p>
                    {displayErr && (
                      <p className="text-xs font-bold text-[var(--tkv-danger-ink)] flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-danger)] shrink-0" aria-hidden="true" />
                        <span>{displayErr}</span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      aria-label={l(
                        `Giảm lượng ${displayLineName}`,
                        `Decrease ${displayLineName} quantity`,
                      )}
                      disabled={locked}
                      onClick={() => adjustLine(index, -1)}
                      className="tkv-focusable w-11 h-11 rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] hover:bg-[var(--tkv-surface-mint)] text-[var(--tkv-ink)] font-extrabold disabled:opacity-45 transition-colors"
                    >
                      −
                    </button>
                    <div className="flex items-center gap-1.5">
                      <input
                        id={`cooking-use-${index}`}
                        type="text"
                        inputMode="decimal"
                        disabled={locked}
                        value={deductionInputs[index] ?? '0'}
                        onChange={(e) => state.editDeduction(index, e.target.value)}
                        className="tkv-focusable w-20 min-h-[44px] px-2.5 text-center rounded-xl border border-[var(--tkv-border-strong)] focus:border-[var(--tkv-primary)] bg-[var(--tkv-surface)] font-bold tabular-nums text-base text-[var(--tkv-ink)]"
                      />
                      <span className="text-xs font-bold text-[var(--tkv-ink-soft,#3C5954)] min-w-[28px]">
                        {displayUnit}
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-label={l(
                        `Tăng lượng ${displayLineName}`,
                        `Increase ${displayLineName} quantity`,
                      )}
                      disabled={locked}
                      onClick={() => adjustLine(index, 1)}
                      className="tkv-focusable w-11 h-11 rounded-xl border border-[var(--tkv-border,#DCE6DE)] bg-[var(--tkv-bg,#FFF9F1)] hover:bg-[var(--tkv-surface-muted,#E7F4EC)] text-[var(--tkv-ink,#152E2C)] font-extrabold disabled:opacity-45 transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </TkvSurface>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
          {done ? (
            <>
              <TkvButton
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => {
                  state.resetCooking();
                  navigate(vnextHref('/recipes'));
                }}
              >
                {l('Chọn món khác', 'Browse other recipes')}
              </TkvButton>
              <TkvButton
                type="button"
                variant="primary"
                size="lg"
                iconRight="fridge"
                onClick={() => {
                  state.resetCooking();
                  navigate(vnextHref('/fridge'));
                }}
              >
                {l('Xem Tủ lạnh đã cập nhật', 'View updated Fridge')}
              </TkvButton>
            </>
          ) : attempt?.status === 'uncertain' ? (
            <TkvButton type="submit" variant="primary" size="lg">
              {l('Thử lại cùng yêu cầu (chống trừ kép)', 'Retry same request (no double deduction)')}
            </TkvButton>
          ) : (
            <TkvButton
              type="submit"
              variant="primary"
              size="lg"
              isLoading={attempt?.status === 'sending'}
              disabled={locked}
              iconLeft="check"
              data-testid="c22-confirm-deduction-cta"
            >
              {l('Xác nhận hoàn thành & cập nhật tủ lạnh', 'Confirm completion & update fridge')}
            </TkvButton>
          )}
        </div>
      </form>
    </ConsumerStudioShell>
  );
};
