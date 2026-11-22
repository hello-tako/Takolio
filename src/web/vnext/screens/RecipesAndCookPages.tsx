import React, { useEffect, useRef, useState } from 'react';
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

const QUICK_CATEGORIES: Array<{ id: string; label: string }> = [
  { id: 'mon_kho', label: 'Món kho' },
  { id: 'mon_canh', label: 'Món canh' },
  { id: 'mon_xao', label: 'Món xào' },
  { id: 'mon_bun_pho', label: 'Bún · Phở' },
  { id: 'mon_cuon_nom', label: 'Gỏi · Nộm' },
  { id: 'mon_chay', label: 'Món chay' },
];

/**
 * C15 / C16 / C17 — Khám phá món ăn · Kết quả tìm kiếm · Món đã lưu (`/recipes`).
 * Matches C15.png 1:1 on mobile (2-col dish card grid) and desktop (3-col studio grid),
 * preserving URL-driven filters, cursor pagination, and registered vs guest FavoritesCollection.
 */
export const C15RecipesDiscoveryVNext: React.FC = () => {
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const savedView = params.get('view') === 'saved';
  const filters = readDiscoveryFilters(params);
  const isGuest = useAuthStore((s) => s.isGuest);
  const familyPrefs = useFamilyPreferences(!isGuest);
  const effectiveServings = filters.servings ?? familyPrefs.data?.preferences.householdSize ?? 2;

  const screenId = savedView ? 'C17' : filters.q.trim() ? 'C16' : 'C15';

  useVNextSeo({
    title: savedView
      ? 'Món ăn đã lưu'
      : filters.q.trim()
        ? `Tìm món: ${filters.q.trim()}`
        : 'Khám phá món ăn',
    description: 'Tìm món ăn theo nguyên liệu sẵn có trong tủ lạnh, thời gian nấu và khẩu vị gia đình.',
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
                Kho công thức gia đình · Khẩu phần {effectiveServings} người
              </p>
              <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#152E2C)] mt-0.5 tabular-nums">
                {savedView
                  ? 'Món đã lưu'
                  : filters.q.trim()
                    ? `Kết quả tìm kiếm (${pageData?.total ?? items.length})`
                    : 'Khám phá món ăn'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-pressed={!savedView}
              onClick={() => toggleSavedView(false)}
              className={clsx(
                'tkv-focusable min-h-[42px] px-4 py-2 rounded-full text-sm font-semibold border transition-colors',
                !savedView
                  ? 'bg-[var(--tkv-primary,#196149)] text-white border-[var(--tkv-primary,#196149)] shadow-xs'
                  : 'bg-white text-[var(--tkv-ink,#152E2C)] border-[var(--tkv-border,#DCE6DE)] hover:border-[var(--tkv-border-strong,#B8CABE)]',
              )}
            >
              Khám phá
            </button>
            <button
              type="button"
              aria-pressed={savedView}
              onClick={() => toggleSavedView(true)}
              className={clsx(
                'tkv-focusable min-h-[42px] px-4 py-2 rounded-full text-sm font-semibold border transition-colors',
                savedView
                  ? 'bg-[var(--tkv-primary,#196149)] text-white border-[var(--tkv-primary,#196149)] shadow-xs'
                  : 'bg-white text-[var(--tkv-ink,#152E2C)] border-[var(--tkv-border,#DCE6DE)] hover:border-[var(--tkv-border-strong,#B8CABE)]',
              )}
            >
              Đã lưu
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
              placeholder="Tìm món, nguyên liệu, cách nấu…"
              label="Tìm công thức món ăn"
            />

            {/* Sunlit Ceramic & Herb Filter Pills */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1" aria-label="Bộ lọc món ăn">
              <button
                type="button"
                aria-pressed={filters.cuisine === 'vietnamese'}
                onClick={() =>
                  applyFilterPatch({
                    cuisine: filters.cuisine === 'vietnamese' ? null : 'vietnamese',
                  })
                }
                className={clsx(
                  'tkv-focusable min-h-[40px] px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap border transition-colors',
                  filters.cuisine === 'vietnamese'
                    ? 'bg-[var(--tkv-primary,#196149)] text-white border-[var(--tkv-primary,#196149)] shadow-xs'
                    : 'bg-white text-[var(--tkv-ink,#152E2C)] border-[var(--tkv-border,#DCE6DE)] hover:border-[var(--tkv-border-strong,#B8CABE)]',
                )}
              >
                Món Việt
              </button>

              <button
                type="button"
                aria-pressed={filters.fast}
                onClick={() => applyFilterPatch({ fast: !filters.fast })}
                className={clsx(
                  'tkv-focusable min-h-[40px] px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap border transition-colors tabular-nums',
                  filters.fast
                    ? 'bg-[var(--tkv-primary,#196149)] text-white border-[var(--tkv-primary,#196149)] shadow-xs'
                    : 'bg-white text-[var(--tkv-ink,#152E2C)] border-[var(--tkv-border,#DCE6DE)] hover:border-[var(--tkv-border-strong,#B8CABE)]',
                )}
              >
                Nấu nhanh (≤ 20p)
              </button>

              <button
                type="button"
                aria-pressed={filters.noBuy}
                onClick={() => applyFilterPatch({ noBuy: !filters.noBuy })}
                className={clsx(
                  'tkv-focusable min-h-[40px] px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap border transition-colors',
                  filters.noBuy
                    ? 'bg-[var(--tkv-sage,#196149)] text-white border-[var(--tkv-sage,#196149)] shadow-xs'
                    : 'bg-white text-[var(--tkv-ink,#152E2C)] border-[var(--tkv-border,#DCE6DE)] hover:border-[var(--tkv-border-strong,#B8CABE)]',
                )}
              >
                Đủ nguyên liệu
              </button>

              {QUICK_CATEGORIES.map((cat) => {
                const active = filters.category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      applyFilterPatch({
                        category: (active ? null : cat.id) as typeof filters.category,
                      })
                    }
                    className={clsx(
                      'tkv-focusable min-h-[40px] px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold whitespace-nowrap border transition-colors',
                      active
                        ? 'bg-[var(--tkv-primary,#196149)] text-white border-[var(--tkv-primary,#196149)] shadow-xs'
                        : 'bg-white text-[var(--tkv-ink-soft,#3C5954)] border-[var(--tkv-border,#DCE6DE)] hover:border-[var(--tkv-border-strong,#B8CABE)]',
                    )}
                  >
                    {cat.label}
                  </button>
                );
              })}

              {hasActiveFilter && (
                <button
                  type="button"
                  onClick={clearDiscoveryFilters}
                  className="tkv-focusable min-h-[40px] px-3.5 py-1.5 rounded-full text-xs font-bold text-[var(--tkv-accent-ink,#B33A22)] hover:text-[var(--tkv-primary,#196149)] underline underline-offset-4 whitespace-nowrap"
                >
                  Xóa bộ lọc
                </button>
              )}
            </div>

            {discoveryQuery.isPending ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }, (_, i) => (
                  <TkvSkeleton key={i} className="h-56" label="Đang tải danh sách công thức…" />
                ))}
              </div>
            ) : discoveryQuery.isError ? (
              <TkvErrorState
                title="Chưa tải được kho công thức"
                message="Không thể đọc dữ liệu gợi ý món ăn lúc này. Vui lòng thử lại."
                onRetry={() => void discoveryQuery.refetch()}
              />
            ) : items.length === 0 ? (
              <TkvSurface className="p-6 text-center space-y-3 bg-[var(--tkv-surface-muted,#E7F4EC)] border-[var(--tkv-border,#DCE6DE)]">
                <p className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink,#152E2C)]">
                  Không có món ăn khớp điều kiện lọc hiện tại
                </p>
                <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)]">
                  Thử mở rộng thời gian nấu, tắt chế độ “Đủ nguyên liệu” hoặc xóa từ khóa tìm kiếm.
                </p>
                <TkvButton variant="secondary" onClick={clearDiscoveryFilters}>
                  Xóa toàn bộ bộ lọc
                </TkvButton>
              </TkvSurface>
            ) : (
              <>
                <ul className="grid grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5" aria-label="Danh sách món ăn">
                  {items.map(({ recipe, canCookWithoutBuying, missingRequiredIngredientCount }) => (
                    <li key={recipe.id} className="min-w-0">
                      <Link
                        to={vnextHref(
                          `/recipes/${recipe.slug || recipe.id}?returnTo=${encodeURIComponent(returnCurrentUrl)}`,
                        )}
                        className="tkv-focusable h-full flex flex-col justify-between rounded-[var(--tkv-radius-card)] bg-white border border-[var(--tkv-border,#DCE6DE)] overflow-hidden hover:border-[var(--tkv-border-strong,#B8CABE)] transition-colors"
                      >
                        <div>
                          <div className="p-2 sm:p-2.5 bg-[var(--tkv-surface-muted,#E7F4EC)]">
                            <VerifiedDishImage
                              slug={recipe.slug}
                              title={recipe.title}
                              canonicalFallbackSrc={resolveRecipeImage(recipe)}
                              aspectClass="aspect-[4/3]"
                              className="rounded-xl"
                            />
                          </div>
                          <div className="p-3 sm:p-4 space-y-1.5">
                            <h2 className="tkv-heading text-sm sm:text-base font-bold text-[var(--tkv-ink,#152E2C)] line-clamp-2">
                              {recipe.title}
                            </h2>
                            <p className="text-xs text-[var(--tkv-ink-soft,#3C5954)] tabular-nums">
                              {recipe.cookTimeMinutes} phút · {recipe.servings} người
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
                                ? 'Đủ nguyên liệu'
                                : `Thiếu ${missingRequiredIngredientCount} mục`}
                            </span>
                          </TkvBadge>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>

                {pageData && pageData.pages > 1 && (
                  <nav
                    aria-label="Phân trang danh sách món ăn"
                    className="pt-2 flex items-center justify-between gap-3 tabular-nums"
                  >
                    <TkvButton
                      variant="secondary"
                      size="sm"
                      disabled={!pageData.previousCursor && pageData.page <= 1}
                      onClick={() =>
                        applyFilterPatch({
                          page: Math.max(1, pageData.page - 1),
                          cursor: pageData.previousCursor ?? undefined,
                        })
                      }
                    >
                      Trang trước
                    </TkvButton>
                    <span className="text-xs font-bold text-[var(--tkv-ink-soft,#3C5954)]">
                      Trang {pageData.page} / {pageData.pages}
                    </span>
                    <TkvButton
                      variant="secondary"
                      size="sm"
                      disabled={!pageData.nextCursor && pageData.page >= pageData.pages}
                      onClick={() =>
                        applyFilterPatch({
                          page: pageData.page + 1,
                          cursor: pageData.nextCursor ?? undefined,
                        })
                      }
                    >
                      Trang tiếp
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

  useVNextSeo({
    title: isPrepStage ? 'Chuẩn bị nấu' : 'Chế độ nấu từng bước',
    description: 'Không gian đứng bếp tập trung với hẹn giờ từng công đoạn và hướng dẫn rõ ràng.',
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
      <ConsumerStudioShell screenId="C20" title="Kiểm tra lần nấu trước" backTo={vnextHref('/recipes')}>
        <TkvSurface tone="saffron" className="max-w-xl mx-auto p-6 space-y-4">
          <TkvBadge tone="warning" icon="info">
            Chống trừ kho trùng lặp
          </TkvBadge>
          <h1 className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink)]">
            Cần kiểm tra lần nấu trước
          </h1>
          <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">
            Bạn còn một yêu cầu hoàn tất đang chờ kiểm tra cho món <strong>{activeRecipe?.title}</strong>. Hãy hoàn tất hoặc đóng yêu cầu đó trước khi bắt đầu món mới.
          </p>
          <TkvButton variant="coral" onClick={() => navigate(vnextHref('/cooking/complete'))}>
            Mở màn hình kiểm tra lượng dùng (C22)
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
              message="Chưa tải được dữ liệu công thức để bắt đầu chế độ nấu."
              onRetry={() => {
                void recipeQuery.refetch();
                void inventoryQuery.refetch();
              }}
            />
          ) : (
            <TkvSurface className="p-6 space-y-4">
              <h1 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink)]">
                Đang chuẩn bị không gian bếp…
              </h1>
              <TkvSkeleton className="h-36" />
              <TkvSkeleton className="h-24" />
            </TkvSurface>
          )}
        </div>
      </div>
    );
  }

  const totalSteps = activeRecipe.steps.length;
  const step = activeRecipe.steps[currentStepIndex] ?? activeRecipe.steps[0];
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
    const ok = voiceChef.speakInstruction(step.instruction, () => setSpeaking(false));
    setSpeaking(ok);
    if (!ok) {
      setVoiceMessage('Trình duyệt hiện tại không hỗ trợ đọc giọng nói tiếng Việt; bạn vẫn dùng đầy đủ nút bấm và hẹn giờ bên dưới.');
    }
  };

  return (
    <div
      className={clsx(
        'tkv-root tkv-immersive-cook-frame relative overflow-hidden flex flex-col min-h-dvh transition-colors text-[var(--tkv-ink,#152E2C)]',
        isPrepStage
          ? 'bg-[var(--tkv-bg,#FFF9F1)]'
          : 'bg-gradient-to-b from-[var(--tkv-cook-from,#FFFFFF)] to-[var(--tkv-cook-to,#F8F1E9)]',
      )}
      data-tkv-screen={isPrepStage ? 'C20' : 'C21'}
    >
      {/* Distraction-Free Countertop Studio Top Bar */}
      <header className="sticky top-0 z-20 backdrop-blur-md bg-white/95 border-b border-[var(--tkv-border,#DCE6DE)] text-[var(--tkv-ink,#152E2C)] px-3 sm:px-6 h-16 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setConfirmExit(true)}
          className="tkv-focusable min-h-[44px] inline-flex items-center gap-1.5 px-2.5 sm:px-3 rounded-xl text-sm font-semibold whitespace-nowrap shrink-0 text-[var(--tkv-ink-soft,#3C5954)] hover:bg-[var(--tkv-surface-muted,#E7F4EC)] hover:text-[var(--tkv-ink,#152E2C)] transition-colors"
        >
          <VNextIcon name="arrow-left" size={18} />
          <span>Thoát bếp</span>
        </button>

        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 tabular-nums bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-[var(--tkv-accent-ink,#B33A22)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary,#196149)]" aria-hidden="true" />
            <span>{isPrepStage ? 'Chuẩn bị nấu' : `Bước ${currentStepIndex + 1} / ${totalSteps}`}</span>
          </span>
          {!isPrepStage && (
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--tkv-sage-soft,#E7F4EC)] border border-[var(--tkv-sage-border,#BDE0CC)] text-[var(--tkv-sage-ink,#134C39)]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-sage,#196149)]" aria-hidden="true" />
              <span>Giữ sáng màn hình</span>
            </span>
          )}
          <span className="hidden sm:inline text-sm font-bold truncate max-w-[260px] text-[var(--tkv-ink,#152E2C)]">
            {activeRecipe.title}
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
            className="tkv-focusable min-h-[40px] px-3 rounded-xl text-xs font-bold whitespace-nowrap border border-[var(--tkv-border-strong,#B8CABE)] bg-white text-[var(--tkv-ink,#152E2C)] hover:bg-[var(--tkv-surface-muted,#E7F4EC)] transition-colors"
          >
            {isPrepStage ? 'Vào bước nấu' : 'Xem sơ chế'}
          </button>
        </div>
      </header>

      {confirmExit && (
        <div className="border-b border-[var(--tkv-honey-border,#F5DE93)] bg-[var(--tkv-honey-soft,#FFF5D6)] text-[var(--tkv-honey-ink,#8A5205)] px-4 py-3">
          <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs sm:text-sm font-medium">
              Thoát chế độ nấu ngay bây giờ sẽ <strong>không trừ bất kỳ nguyên liệu nào</strong> trong tủ lạnh của bạn.
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmExit(false)}
                className="tkv-focusable min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold bg-white border border-[var(--tkv-border-strong,#B8CABE)] text-[var(--tkv-ink,#152E2C)] hover:bg-[var(--tkv-surface-muted,#E7F4EC)] transition-colors"
              >
                Tiếp tục nấu
              </button>
              <button
                type="button"
                onClick={() => {
                  voiceChef.stopSpeaking();
                  state.clearTimer();
                  navigate(vnextHref(`/recipes/${activeRecipe.slug || activeRecipe.id}`));
                }}
                className="tkv-focusable min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[var(--tkv-primary,#196149)] hover:bg-[var(--tkv-primary-hover,#134C39)] text-white transition-colors"
              >
                Rời khỏi bếp
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10 flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {isPrepStage ? (
          /* C20 — Chuẩn bị nấu (Sunlit Ceramic Mise-en-place checklist) */
          <div className="space-y-6">
            <TkvSurface className="p-5 sm:p-6 bg-white border-[var(--tkv-border,#DCE6DE)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <MascotIllustration pose="cooking" size={72} className="border border-[var(--tkv-border,#DCE6DE)] bg-[var(--tkv-bg,#FFF9F1)] shrink-0" />
                <div className="space-y-1">
                  <p className="tkv-eyebrow text-xs font-semibold uppercase tracking-widest text-[var(--tkv-ink-muted,#52706A)] tabular-nums">
                    Sẵn sàng nguyên liệu · {activeRecipe.servings} khẩu phần
                  </p>
                  <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#152E2C)]">
                    {activeRecipe.title}
                  </h1>
                  <p className="text-xs sm:text-sm text-[var(--tkv-ink-soft,#3C5954)] tabular-nums">
                    Tổng thời gian khoảng {activeRecipe.cookTimeMinutes} phút · {totalSteps} bước thực hiện.
                  </p>
                </div>
              </div>
            </TkvSurface>

            <TkvSurface className="p-5 sm:p-6 space-y-4 bg-white border-[var(--tkv-border,#DCE6DE)]">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink,#152E2C)] tabular-nums">
                  Kiểm điểm nguyên liệu trên bàn sơ chế ({activeRecipe.ingredients.length})
                </h2>
                <TkvBadge tone="success" icon="shield">
                  Chưa trừ kho ở bước chuẩn bị
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
                          {ing.name}
                        </span>
                      </label>
                      <span className="text-sm font-bold tabular-nums text-[var(--tkv-ink,#152E2C)] shrink-0">
                        {cookingQuantityText(ing.requiredQuantity, ing.unit)}
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
              Bắt đầu nấu từng bước ({totalSteps} bước)
            </TkvButton>
          </div>
        ) : (
          /* C21 — Bright, Airy Sunlit Countertop Studio */
          <div className="space-y-6">
            {/* Step Progress Bar with smooth width transition */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-[var(--tkv-ink-soft,#3C5954)] tabular-nums">
                <span className="truncate pr-2">{activeRecipe.title}</span>
                <span className="shrink-0">Hoàn thành {progressPct}%</span>
              </div>
              <div
                className="h-2 w-full rounded-full bg-[var(--tkv-ring-track,#F7E6DD)] overflow-hidden"
                role="progressbar"
                aria-label={`Tiến độ nấu: bước ${currentStepIndex + 1} trên ${totalSteps}`}
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
                      Công đoạn {currentStepIndex + 1} / {totalSteps}
                    </p>
                    <h1 className="tkv-heading text-xl sm:text-2xl font-extrabold text-[var(--tkv-ink,#152E2C)] tabular-nums">
                      Bước {currentStepIndex + 1}
                    </h1>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex md:hidden items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--tkv-sage-soft,#E7F4EC)] border border-[var(--tkv-sage-border,#BDE0CC)] text-[var(--tkv-sage-ink,#134C39)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-sage,#196149)]" aria-hidden="true" />
                    <span>Giữ sáng</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleSpeech}
                    className="tkv-focusable min-h-[40px] px-3.5 py-2 rounded-xl border border-[var(--tkv-border-strong,#B8CABE)] bg-[var(--tkv-bg,#FFF9F1)] hover:bg-[var(--tkv-surface-muted,#E7F4EC)] text-xs font-bold text-[var(--tkv-ink,#152E2C)] inline-flex items-center gap-2 transition-colors"
                  >
                    <VNextIcon name="volume" size={16} className="text-[var(--tkv-primary,#196149)]" />
                    <span>{speaking ? 'Dừng đọc' : 'Đọc bước này'}</span>
                  </button>
                </div>
              </div>

              <p className="tkv-heading text-xl sm:text-[1.75rem] leading-relaxed font-semibold text-[var(--tkv-ink,#152E2C)]">
                {step?.instruction}
              </p>

              {step?.tip && (
                <p className="text-xs sm:text-sm text-[var(--tkv-honey-ink,#8A5205)] bg-[var(--tkv-honey-soft,#FFF5D6)] border-l-3 border-[var(--tkv-honey,#F6C453)] rounded-r-xl px-3.5 py-2">
                  Mẹo bếp: {step.tip}
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
                          ? 'Đã hết giờ công đoạn'
                          : isTimerRunning
                            ? 'Đang đếm ngược'
                            : 'Bộ hẹn giờ công đoạn'}
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
                      className="tkv-focusable min-h-[42px] px-4 py-2 rounded-xl bg-[var(--tkv-primary,#196149)] text-white hover:bg-[var(--tkv-primary-hover,#134C39)] text-sm font-bold shadow-xs transition-colors"
                    >
                      Bắt đầu hẹn giờ
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => state.toggleTimer()}
                        className="tkv-focusable min-h-[42px] px-4 py-2 rounded-xl bg-[var(--tkv-primary,#196149)] text-white hover:bg-[var(--tkv-primary-hover,#134C39)] text-sm font-bold shadow-xs transition-colors"
                      >
                        {isTimerRunning ? 'Tạm dừng' : 'Tiếp tục'}
                      </button>
                      <button
                        type="button"
                        onClick={() => state.setTimer((timerSecondsRemaining ?? 0) + 60)}
                        className="tkv-focusable min-h-[42px] px-3.5 py-2 rounded-xl border border-[var(--tkv-border-strong,#B8CABE)] bg-white hover:bg-[var(--tkv-surface-muted,#E7F4EC)] text-sm font-semibold text-[var(--tkv-ink,#152E2C)] tabular-nums transition-colors"
                      >
                        +1 phút
                      </button>
                      <button
                        type="button"
                        onClick={() => state.clearTimer()}
                        className="tkv-focusable min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold text-[var(--tkv-ink-soft,#3C5954)] hover:text-[var(--tkv-ink,#152E2C)] transition-colors"
                      >
                        Đặt lại
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Ingredient Reference Drawer */}
            <details className="rounded-2xl bg-white border border-[var(--tkv-border,#DCE6DE)] px-5 py-3.5 text-[var(--tkv-ink,#152E2C)]">
              <summary className="cursor-pointer min-h-[36px] flex items-center justify-between font-bold text-sm tabular-nums">
                <span>Nguyên liệu của món ({activeRecipe.ingredients.length} mục · {activeRecipe.servings} người)</span>
                <VNextIcon name="chevron-right" size={18} className="text-[var(--tkv-ink-muted,#52706A)]" />
              </summary>
              <ul className="pt-3 mt-2 border-t border-[var(--tkv-border,#DCE6DE)] space-y-2 text-sm">
                {activeRecipe.ingredients.map((ing) => (
                  <li key={`${ing.ingredientId}-${ing.name}`} className="flex items-center justify-between gap-2">
                    <span className="text-[var(--tkv-ink-soft,#3C5954)] font-medium">{ing.name}</span>
                    <span className="font-bold tabular-nums text-[var(--tkv-ink,#152E2C)]">
                      {cookingQuantityText(ing.requiredQuantity, ing.unit)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>

            {/* Primary Step Navigation Controls */}
            <div className="pt-2 grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={currentStepIndex <= 0}
                onClick={() => state.prevStep()}
                className="tkv-focusable min-h-[52px] px-5 py-3 rounded-[var(--tkv-radius-btn)] border border-[var(--tkv-border-strong,#B8CABE)] bg-white hover:bg-[var(--tkv-surface-muted,#E7F4EC)] disabled:opacity-40 text-sm sm:text-base font-bold text-[var(--tkv-ink,#152E2C)] inline-flex items-center justify-center gap-2 transition-colors"
              >
                <VNextIcon name="arrow-left" size={18} />
                <span>Bước trước</span>
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
                  className="tkv-focusable min-h-[52px] px-5 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#196149)] hover:bg-[var(--tkv-primary-hover,#134C39)] text-white shadow-xs text-sm sm:text-base font-extrabold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Hoàn thành món</span>
                  <VNextIcon name="check" size={18} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => state.nextStep()}
                  data-testid="c21-next-step-cta"
                  className="tkv-focusable min-h-[52px] px-5 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#196149)] hover:bg-[var(--tkv-primary-hover,#134C39)] text-white shadow-xs text-sm sm:text-base font-extrabold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <span>Bước tiếp theo</span>
                  <VNextIcon name="arrow-right" size={18} />
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
  const navigate = useNavigate();
  const state = useCookingStore();
  const { runId, activeRecipe: recipe, deductions, deductionInputs, deductionErrors, attempt } = state;
  const [refreshMessage, setRefreshMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useVNextSeo({
    title: 'Hoàn thành bữa ăn',
    description: 'Kiểm tra lượng nguyên liệu thực tế đã dùng trước khi cập nhật tủ lạnh.',
    canonicalPath: '/cooking/complete',
    domainSurface: 'app',
    noindex: true,
  });

  if (!runId || !recipe) {
    return (
      <ConsumerStudioShell screenId="C22" title="Hoàn thành bữa ăn" backTo={vnextHref('/recipes')} showContextualScan={false}>
        <div className="max-w-2xl mx-auto space-y-4">
          <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
            Hoàn thành bữa ăn
          </h1>
          <TkvEmptyState
            pose="cooking"
            eyebrow="Takolio · Bếp nhà"
            title="Chưa có món ăn đang chờ hoàn tất"
            description="Chọn một công thức và bắt đầu chế độ nấu từng bước để kiểm tra lượng nguyên liệu thực tế đã sử dụng ở cuối bữa."
            primaryAction={
              <TkvButton variant="coral" onClick={() => navigate(vnextHref('/recipes'))}>
                Khám phá kho công thức
              </TkvButton>
            }
          />
        </div>
      </ConsumerStudioShell>
    );
  }

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
    setRefreshMessage('Đang tải lại tồn kho chính thức từ máy chủ…');
    const isCurrent = capturePrivateSession();
    const activeRun = state.runId;
    try {
      const res = await fetchJson<{ items: RecipeScoringContext['inventory'] }>('/inventory');
      if (isCurrent() && useCookingStore.getState().runId === activeRun && Array.isArray(res.items)) {
        state.refreshStock(res.items);
        setRefreshMessage('Đã tải lại tồn kho mới nhất. Vui lòng kiểm tra lại lượng dùng trước khi xác nhận.');
      }
    } catch {
      if (isCurrent()) {
        setRefreshMessage('Chưa tải lại được tồn kho. Hãy kiểm tra kết nối mạng rồi thử lại.');
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
      title="Hoàn thành bữa ăn"
      backTo={locked ? undefined : vnextHref(`/cook/${recipe.slug || recipe.id}?servings=${recipe.servings}`)}
      showContextualScan={false}
    >
      <form onSubmit={handleSubmit} noValidate className="max-w-3xl mx-auto space-y-6">
        <TkvSurface className="p-5 sm:p-6 bg-gradient-to-br from-[var(--tkv-linen-from,#FFFFFF)] to-[var(--tkv-surface-muted,#E7F4EC)] border-[var(--tkv-border,#DCE6DE)] flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <MascotIllustration
            pose={done ? 'achievement' : 'cooking'}
            size={84}
            className="w-20 h-20 shrink-0"
          />
          <div className="space-y-2 min-w-0">
            <TkvBadge tone={done ? 'success' : 'coral'} icon={done ? 'check' : 'recipes'}>
              {done ? 'Đã ghi nhận bữa nấu' : 'Kiểm tra lượng thực dùng'}
            </TkvBadge>
            <h1 className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink,#152E2C)]">
              {done
                ? attempt?.status === 'queued'
                  ? 'Đã lưu yêu cầu chờ đồng bộ'
                  : 'Đã cập nhật tủ lạnh thành công!'
                : 'Hoàn thành bữa ăn'}
            </h1>
            <p className="text-sm font-bold text-[var(--tkv-ink,#152E2C)]">{recipe.title}</p>
            <p className="text-xs sm:text-sm text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
              {done
                ? attempt?.status === 'queued'
                  ? 'Thiết bị đang ngoại tuyến; yêu cầu sẽ gửi lên máy chủ ngay khi có mạng với khóa chống trừ trùng.'
                  : 'Máy chủ đã xác nhận trừ đúng lượng nguyên liệu bạn đã dùng cho bữa ăn này.'
                : 'Điều chỉnh lượng nguyên liệu thực tế bạn đã dùng bên dưới. Tủ lạnh chỉ trừ kho một lần duy nhất sau khi bạn bấm xác nhận.'}
            </p>
          </div>
        </TkvSurface>

        {attempt?.error && (
          <div
            role="alert"
            className="p-4 rounded-2xl bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-sm text-[var(--tkv-accent-ink,#B33A22)] font-semibold space-y-2"
          >
            <p className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[var(--tkv-primary,#196149)] shrink-0" aria-hidden="true" />
              <span>{attempt.error}</span>
            </p>
            {attempt.status === 'rejected' && (
              <TkvButton
                type="button"
                size="sm"
                variant="secondary"
                isLoading={isRefreshing}
                onClick={() => void handleRefreshStock()}
              >
                Tải lại lượng trong tủ để kiểm tra
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
              Lượng thực tế đã dùng ({deductions.length} mục)
            </h2>
            <span className="text-xs font-semibold text-[var(--tkv-ink-muted,#52706A)]">
              Nhập 0 nếu không dùng nguyên liệu đó
            </span>
          </div>

          <div className="divide-y divide-[var(--tkv-border,#DCE6DE)]">
            {deductions.map((line, index) => (
              <div
                key={`${line.ingredientId}-${index}`}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="min-w-0 space-y-0.5">
                  <label
                    htmlFor={`cooking-use-${index}`}
                    className="tkv-heading text-sm sm:text-base font-bold text-[var(--tkv-ink,#152E2C)] block"
                  >
                    {line.name}
                  </label>
                  <p className="text-xs text-[var(--tkv-ink-soft,#3C5954)] tabular-nums">
                    Trong tủ: <strong>{cookingQuantityText(line.currentQuantity, line.unit)}</strong> · Còn dự kiến:{' '}
                    <strong>
                      {deductionErrors[index]
                        ? 'Chưa hợp lệ'
                        : cookingQuantityText(line.remainingQuantity, line.unit)}
                    </strong>
                  </p>
                  {deductionErrors[index] && (
                    <p className="text-xs font-bold text-[var(--tkv-accent-ink,#B33A22)] flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary,#196149)]" aria-hidden="true" />
                      <span>{deductionErrors[index]}</span>
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    aria-label={`Giảm lượng ${line.name}`}
                    disabled={locked}
                    onClick={() => adjustLine(index, -1)}
                    className="tkv-focusable w-11 h-11 rounded-xl border border-[var(--tkv-border,#DCE6DE)] bg-[var(--tkv-bg,#FFF9F1)] hover:bg-[var(--tkv-surface-muted,#E7F4EC)] text-[var(--tkv-ink,#152E2C)] font-extrabold disabled:opacity-45 transition-colors"
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
                      className="tkv-focusable w-20 min-h-[44px] px-2.5 text-center rounded-xl border border-[var(--tkv-border-strong,#B8CABE)] focus:border-[var(--tkv-primary,#196149)] bg-white font-bold tabular-nums text-sm text-[var(--tkv-ink,#152E2C)]"
                    />
                    <span className="text-xs font-bold text-[var(--tkv-ink-soft,#3C5954)] min-w-[28px]">
                      {line.unit}
                    </span>
                  </div>
                  <button
                    type="button"
                    aria-label={`Tăng lượng ${line.name}`}
                    disabled={locked}
                    onClick={() => adjustLine(index, 1)}
                    className="tkv-focusable w-11 h-11 rounded-xl border border-[var(--tkv-border,#DCE6DE)] bg-[var(--tkv-bg,#FFF9F1)] hover:bg-[var(--tkv-surface-muted,#E7F4EC)] text-[var(--tkv-ink,#152E2C)] font-extrabold disabled:opacity-45 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
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
                Chọn món khác
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
                Xem Tủ lạnh đã cập nhật
              </TkvButton>
            </>
          ) : attempt?.status === 'uncertain' ? (
            <TkvButton type="submit" variant="primary" size="lg">
              Thử lại cùng yêu cầu (chống trừ kép)
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
              Xác nhận hoàn thành & cập nhật tủ lạnh
            </TkvButton>
          )}
        </div>
      </form>
    </ConsumerStudioShell>
  );
};
