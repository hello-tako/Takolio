import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { CatalogIdSchema } from '@frigo/domain';
import { scaleRecipeServings, type RecipeIngredient, type RecipeStep } from '@frigo/recipes';
import type {
  MealRole,
  PickerItemDto,
} from '../../../../packages/domain/src/meal-composition-api';
import type { MealPlanningIntent } from '../../../../packages/domain/src/meal-planning-api';
import '../styles/tokens.css';
import '../styles/vnext-adapted.css';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../services/api';
import { mealCompositionApi } from '../../services/meal-composition';
import {
  DEFAULT_FAMILY_PREFERENCES,
  FamilyPreferencesSchema,
  familyPreferencesApi,
  type FamilyPreferences,
} from '../../services/family-preferences';
import { ApiError } from '../../services/http';
import { getIngredientImage } from '../../lib/ingredient-images';
import { queryKeys } from '../../lib/queryKeys';
import {
  familyPreferencesKey,
  useFamilyPreferences,
} from '../../features/family/useFamilyPreferences';
import {
  AVOIDANCE_GROUPS,
  isAvoidanceGroupActive,
  sanitizeFamilyPreferencesForGeneration,
  toggleAvoidanceGroup,
} from '../../features/family/preference-sync';
import {
  compositionUnavailable,
  isMealCompositionEnabled,
  roleLabel,
  usePlanCompositions,
} from '../../features/planner/composition';
import { localDate } from '../../features/planner/intent';
import { ingredientLabel, plannerErrorMessage } from '../../features/planner/presentation';
import { plannerSlot } from '../../features/planner/schedule';
import { usePlanner } from '../../features/planner/usePlanner';
import { vnextHref } from '../feature';
import { ConsumerStudioShell } from '../components/Shells';
import { TkvButton, TkvErrorState, TkvSurface } from '../components/Primitives';
import { showTkvToast } from '../components/LivingMotion';
import {
  BrandFeatureIcon,
  MascotIllustration,
  resolveCanonicalDishSlug,
  VerifiedDishImage,
} from '../components/VNextMedia';
import { VNextDishPickerSheet } from '../components/VNextDishPickerSheet';
import { VNextIcon } from '../components/VNextIcons';
import {
  PlannerGeneratingStage,
  ShoppingListSkeleton,
  WeeklyPlannerSkeleton,
} from '../components/Skeletons';
import {
  acceptSlotCompositionMutation,
  formatKitchenAmount,
  isSlotEditableTodayOrFuture,
  resolvePlanShoppingWindow,
  syncPlanToShoppingList,
} from '../lib/planner-workbench';

const LazyShoppingStudio = lazy(() =>
  import('./C27ShoppingStudio').then((m) => ({ default: m.C27ShoppingStudio })),
);

type MealTypeKey = 'breakfast' | 'lunch' | 'dinner';

const MEAL_ORDER: readonly MealTypeKey[] = ['breakfast', 'lunch', 'dinner'];
const MEAL_CHIP_LABELS: Record<MealTypeKey, string> = {
  breakfast: 'Bữa sáng',
  lunch: 'Bữa trưa',
  dinner: 'Bữa tối',
};

function addDaysIso(baseIso: string, deltaDays: number): string {
  const dt = new Date(`${baseIso}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function formatMinutesHHMM(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 50, Math.ceil(totalMinutes / 5) * 5));
  const hh = String(Math.floor(clamped / 60)).padStart(2, '0');
  const mm = String(clamped % 60).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Builds a guaranteed-valid `MealPlanningIntent` that:
 * 1. Never emits past-instant slots when starting "Today" (preventing 422 INVALID_PLANNING_HORIZON).
 * 2. Never emits empty `slots: []` if `cookingDays` accidentally excludes a short horizon.
 * 3. Uses soft `preferredTimeMinutes` rather than `hardMaxTimeMinutes` so unmeasured prep times
 *    never disqualify the recipe catalog (`COOKING_TIME_UNKNOWN`).
 */
export function buildSmartPlanningIntent(input: {
  startDate: string;
  days: number;
  servings: number;
  meals: readonly MealTypeKey[];
  mode: 'shopping_allowed' | 'cook_now';
  cookingDays?: readonly number[];
  preferredTimeMinutes?: number;
  now?: Date;
}): MealPlanningIntent {
  const now = input.now ?? new Date();
  const todayIso = localDate(now);
  const tomorrowIso = addDaysIso(todayIso, 1);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const orderedMeals = MEAL_ORDER.filter((m) => input.meals.includes(m));
  const activeMeals: MealTypeKey[] = orderedMeals.length > 0 ? orderedMeals : ['dinner'];

  const mealCutoffs: Record<MealTypeKey, { defaultMins: number; latestMins: number }> = {
    breakfast: { defaultMins: 8 * 60, latestMins: 10 * 60 + 30 },
    lunch: { defaultMins: 12 * 60, latestMins: 14 * 60 + 30 },
    dinner: { defaultMins: 18 * 60, latestMins: 22 * 60 + 45 },
  };

  let effectiveStartDate = input.startDate < todayIso ? todayIso : input.startDate;
  if (effectiveStartDate === todayIso) {
    const anyTodayMealOpen = activeMeals.some((m) => nowMinutes <= mealCutoffs[m].latestMins);
    if (!anyTodayMealOpen) {
      effectiveStartDate = tomorrowIso;
    }
  }

  const horizonDays = Math.min(14, Math.max(1, input.days));
  const buildSlots = (respectCookingDays: boolean) => {
    const out: MealPlanningIntent['slots'] = [];
    for (let index = 0; index < horizonDays; index += 1) {
      const slotDate = addDaysIso(effectiveStartDate, index);
      const weekday = new Date(`${slotDate}T12:00:00Z`).getUTCDay();
      if (
        respectCookingDays &&
        input.cookingDays &&
        input.cookingDays.length > 0 &&
        !input.cookingDays.includes(weekday)
      ) {
        continue;
      }

      for (const mealType of activeMeals) {
        let overrideTime: string | undefined;
        if (slotDate === todayIso) {
          const bounds = mealCutoffs[mealType];
          if (nowMinutes > bounds.latestMins) continue;
          if (nowMinutes >= bounds.defaultMins - 10) {
            overrideTime = formatMinutesHHMM(nowMinutes + 15);
          }
        }
        out.push({
          date: slotDate,
          mealType,
          sequence: 0,
          ...(overrideTime ? { time: overrideTime } : {}),
          ...(input.preferredTimeMinutes
            ? { preferredTimeMinutes: input.preferredTimeMinutes }
            : {}),
        });
      }
    }
    return out;
  };

  let slots = buildSlots(true);
  if (slots.length === 0) {
    slots = buildSlots(false);
  }
  if (slots.length === 0) {
    effectiveStartDate = tomorrowIso;
    slots = [
      {
        date: tomorrowIso,
        mealType: activeMeals[0] ?? 'dinner',
        sequence: 0,
        ...(input.preferredTimeMinutes ? { preferredTimeMinutes: input.preferredTimeMinutes } : {}),
      },
    ];
  }

  return {
    startDate: effectiveStartDate,
    horizonDays,
    defaultServings: Math.min(20, Math.max(1, Math.round(input.servings || 2))),
    utcOffsetMinutes: -now.getTimezoneOffset(),
    mode: input.mode,
    slots: slots.slice(0, 42),
  };
}

/**
 * C24 — Lập thực đơn mới (`/planner/new`).
 * Streamlined single-screen Brand Board v2 setup with zero nested lazy-chunk waterfall,
 * deterministic ingredient avoidance mapping (preventing SAFETY_UNKNOWN 0-meal blackholes),
 * smart same-day/tomorrow slot horizon normalization, and inline error feedback right above CTA.
 */
export const C24PlannerSetupVNext: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const queryClient = useQueryClient();
  const isGuest = useAuthStore((s) => s.isGuest);
  const returnTo = `${location.pathname}${location.search}`;

  const recipeParsed = CatalogIdSchema.safeParse(params.get('recipe'));
  const recipeId = recipeParsed.success ? recipeParsed.data : null;
  const requestedServings = params.get('servings') ?? '';
  const handoffServings =
    recipeId && /^[1-9][0-9]?$/.test(requestedServings) && Number(requestedServings) <= 20
      ? Number(requestedServings)
      : undefined;

  const model = usePlanner(undefined, false);
  const preferences = useFamilyPreferences(!isGuest);
  const compositionEnabled = isMealCompositionEnabled();

  const todayIso = useMemo(() => localDate(new Date()), []);
  const tomorrowIso = useMemo(() => addDaysIso(todayIso, 1), [todayIso]);

  const [startPreset, setStartPreset] = useState<'today' | 'tomorrow' | 'custom'>('tomorrow');
  const [customStartDate, setCustomStartDate] = useState(tomorrowIso);
  const [days, setDays] = useState<number>(7);
  const [selectionMode, setSelectionMode] = useState<'auto' | 'manual'>(
    recipeId && compositionEnabled ? 'manual' : 'auto',
  );
  const [mode, setMode] = useState<'shopping_allowed' | 'cook_now'>('shopping_allowed');
  const [draft, setDraft] = useState<FamilyPreferences | null>(null);
  const [draftRevision, setDraftRevision] = useState<number | null>(null);
  const [migratedAllergens, setMigratedAllergens] = useState<string[]>([]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [profileConflict, setProfileConflict] = useState(false);

  useEffect(() => {
    if (preferences.data && !draft) {
      const { sanitized, migratedAllergens: healed } = sanitizeFamilyPreferencesForGeneration(
        preferences.data.preferences,
      );
      setDraft({
        ...sanitized,
        householdSize: handoffServings ?? sanitized.householdSize,
      });
      setDraftRevision(preferences.data.revision);
      setMigratedAllergens(healed);
    }
  }, [preferences.data, draft, handoffServings]);

  const effectiveStartDate =
    startPreset === 'today' ? todayIso : startPreset === 'tomorrow' ? tomorrowIso : customStartDate;

  const activeDraft: FamilyPreferences = draft ?? {
    ...DEFAULT_FAMILY_PREFERENCES,
    householdSize: handoffServings ?? DEFAULT_FAMILY_PREFERENCES.householdSize,
  };

  const updateDraft = (patch: Partial<FamilyPreferences>) => {
    setLocalError(null);
    setDraft((prev) => ({
      ...(prev ?? activeDraft),
      ...patch,
    }));
  };

  const toggleMealType = (meal: MealTypeKey) => {
    const current = activeDraft.cookingMealTypes;
    if (current.includes(meal)) {
      if (current.length <= 1) return; // Keep at least 1 meal selected
      updateDraft({ cookingMealTypes: current.filter((m) => m !== meal) });
    } else {
      const next = MEAL_ORDER.filter((m) => m === meal || current.includes(m));
      updateDraft({ cookingMealTypes: next });
    }
  };

  const reloadLatestPreferences = async () => {
    setLocalError(null);
    const fresh = await preferences.refetch();
    if (fresh.data) {
      const { sanitized, migratedAllergens: healed } = sanitizeFamilyPreferencesForGeneration(
        fresh.data.preferences,
      );
      setDraft({
        ...sanitized,
        householdSize: handoffServings ?? sanitized.householdSize,
      });
      setDraftRevision(fresh.data.revision);
      setMigratedAllergens(healed);
      setProfileConflict(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    if (isGuest) return;
    if (preferences.isError) {
      setLocalError('Chưa tải được hồ sơ thói quen bếp. Vui lòng bấm Thử lại.');
      return;
    }

    const workingPrefs = sanitizeFamilyPreferencesForGeneration(activeDraft).sanitized;
    const parsedPrefs = FamilyPreferencesSchema.safeParse(workingPrefs);
    if (!parsedPrefs.success) {
      setLocalError('Vui lòng kiểm tra lại khẩu phần và các bữa ăn đã chọn.');
      return;
    }

    let intent: MealPlanningIntent;
    try {
      intent = buildSmartPlanningIntent({
        startDate: effectiveStartDate,
        days,
        servings: parsedPrefs.data.householdSize,
        meals: parsedPrefs.data.cookingMealTypes,
        mode,
        cookingDays: parsedPrefs.data.cookingDays,
        preferredTimeMinutes: parsedPrefs.data.preferredTimeMinutes,
      });
    } catch {
      setLocalError('Khoảng ngày lập thực đơn chưa hợp lệ. Hãy chọn lại ngày bắt đầu.');
      return;
    }

    const effectiveSelectionMode = compositionEnabled ? selectionMode : 'auto';
    const requestFingerprint = {
      selectionMode: effectiveSelectionMode,
      intent,
      familyPreferences: parsedPrefs.data,
    };

    const createdPlan = await model.perform(
      effectiveSelectionMode === 'manual' ? 'manual-draft' : 'generate',
      async () => {
        if (compositionEnabled) {
          const currentServer = preferences.data ?? (await familyPreferencesApi.get());
          const expectedRevision = draftRevision ?? currentServer.revision;
          if (JSON.stringify(parsedPrefs.data) !== JSON.stringify(currentServer.preferences)) {
            try {
              const saved = await familyPreferencesApi.save(expectedRevision, parsedPrefs.data);
              queryClient.setQueryData(familyPreferencesKey(), saved);
              setDraftRevision(saved.revision);
              setMigratedAllergens([]);
            } catch (saveErr) {
              if (saveErr instanceof ApiError && saveErr.status === 409) {
                setProfileConflict(true);
              }
              throw saveErr;
            }
          }
        }
        const reqKey = model.requestKey(requestFingerprint);
        return effectiveSelectionMode === 'manual'
          ? model.createManual(intent, reqKey)
          : model.generate(intent, reqKey);
      },
      (plan) => {
        model.replacePlan(plan);
        model.retireRequestKey(requestFingerprint);
      },
    );

    if (createdPlan) {
      const firstSlot = createdPlan.intent.slots[0];
      const destination =
        recipeId && firstSlot
          ? `/planner/${createdPlan.id}/meal/${encodeURIComponent(`${firstSlot.date}:${firstSlot.mealType}:${firstSlot.sequence ?? 0}`)}?recipe=${encodeURIComponent(recipeId)}`
          : `/planner/${createdPlan.id}`;
      navigate(destination, { replace: true });
    }
  };

  const activeAvoidanceLabels = AVOIDANCE_GROUPS.filter((g) =>
    isAvoidanceGroupActive(activeDraft.forbiddenIngredientIds, g.id),
  ).map((g) => g.labelVi);

  const customExcludedLabels = (activeDraft.forbiddenIngredientIds ?? [])
    .filter((id) => !AVOIDANCE_GROUPS.some((g) => g.ingredientIds.includes(id)))
    .map((id) => ingredientLabel(id, 'vi'));

  const summaryParts = [
    activeDraft.mealStyle === 'quick'
      ? 'Bữa nhanh gọn'
      : activeDraft.mealStyle === 'one_pot'
        ? 'Một món trọn bữa'
        : 'Mâm cơm gia đình',
    `~${activeDraft.preferredTimeMinutes} phút/bữa`,
    mode === 'cook_now' ? 'Chỉ dùng đồ sẵn có' : 'Có thể đi chợ thêm',
    activeAvoidanceLabels.length + customExcludedLabels.length > 0
      ? `Tránh: ${[...activeAvoidanceLabels, ...customExcludedLabels].slice(0, 3).join(', ')}`
      : 'Không kiêng nguyên liệu',
  ];

  const isSubmitting = Boolean(model.busy);
  const errorMessage =
    localError ?? (model.error ? plannerErrorMessage(model.error, 'vi') : null);

  return (
    <ConsumerStudioShell screenId="C24" title="Lập thực đơn mới" backTo={vnextHref('/planner')}>
      {isGuest ? (
        <TkvSurface className="p-5 sm:p-6 space-y-4 bg-[var(--tkv-surface)] max-w-xl mx-auto">
          <div className="flex items-center gap-3.5">
            <MascotIllustration pose="shopping" size={72} className="w-16 h-16 shrink-0" />
            <div>
              <h1 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink)]">
                Đăng nhập để tạo thực đơn tuần
              </h1>
              <p className="text-sm text-[var(--tkv-ink-secondary)] mt-1">
                Thực đơn được lưu theo hộ gia đình để đối chiếu tủ lạnh và danh sách mua sắm.
              </p>
            </div>
          </div>
          <Link
            data-testid="planner-login-cta"
            to={`/auth?mode=login&returnTo=${encodeURIComponent(returnTo)}`}
            className="tkv-focusable w-full min-h-[48px] px-5 py-3 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white shadow-[var(--tkv-shadow-cta)] font-extrabold text-sm inline-flex items-center justify-center gap-2 transition-colors"
          >
            <span>Đăng nhập để tiếp tục</span>
            <VNextIcon name="chevron-right" size={16} />
          </Link>
        </TkvSurface>
      ) : isSubmitting ? (
        <div className="max-w-xl mx-auto py-4">
          <PlannerGeneratingStage
            subtitle={
              selectionMode === 'manual'
                ? 'Đang khởi tạo khung lịch bữa ăn…'
                : 'Đang cân đối thực đơn và đối chiếu tủ lạnh…'
            }
          />
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          data-testid="c24-setup-form"
          className="max-w-2xl mx-auto flex flex-col gap-4"
        >
          {/* Compact Single Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <BrandFeatureIcon name="planner" size={40} className="shrink-0" />
              <div className="min-w-0">
                <h1 className="tkv-heading text-xl sm:text-2xl font-extrabold text-[var(--tkv-ink)]">
                  Tạo thực đơn mới
                </h1>
                <p className="text-xs sm:text-sm text-[var(--tkv-ink-secondary)]">
                  Chọn nhanh lịch nấu — đổi từng món bất cứ lúc nào sau khi tạo.
                </p>
              </div>
            </div>
          </div>

          {recipeId && (
            <div className="rounded-2xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] px-4 py-3 text-sm text-[var(--tkv-primary)] font-semibold flex items-center gap-2.5">
              <VNextIcon name="sparkles" size={18} className="shrink-0" />
              <span>
                Đang tạo lịch để xếp món bạn vừa chọn vào bữa đầu tiên ({activeDraft.householdSize}{' '}
                người).
              </span>
            </div>
          )}

          {migratedAllergens.length > 0 && (
            <div className="rounded-2xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] px-4 py-2.5 text-xs font-semibold text-[var(--tkv-primary)]">
              Đã đồng bộ nhóm kiêng khem đã lưu sang bộ lọc nguyên liệu chi tiết để không khóa trống thực đơn.
            </div>
          )}

          {/* Core 4 Controls Card — Fits cleanly above the fold on 390x844 */}
          <TkvSurface className="p-4 sm:p-5 space-y-4 bg-[var(--tkv-surface)]">
            {/* 1. Start Date & Horizon Days */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink-secondary)]">
                  Bắt đầu từ
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ['today', 'Hôm nay'],
                      ['tomorrow', 'Ngày mai'],
                      ['custom', 'Chọn ngày'],
                    ] as const
                  ).map(([key, label]) => {
                    const active = startPreset === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setStartPreset(key)}
                        className={clsx(
                          'tkv-focusable min-h-[42px] px-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-colors',
                          active
                            ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] shadow-xs'
                            : 'bg-[var(--tkv-bg)] text-[var(--tkv-ink)] border-[var(--tkv-border)] hover:border-[var(--tkv-border-mint)]',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {startPreset === 'custom' && (
                  <input
                    type="date"
                    min={todayIso}
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value || tomorrowIso)}
                    aria-label="Ngày bắt đầu"
                    className="mt-1.5 w-full min-h-[42px] rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] px-3 text-sm font-semibold text-[var(--tkv-ink)]"
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink-secondary)]">
                  Số ngày lên lịch
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {[3, 5, 7].map((count) => {
                    const active = days === count;
                    return (
                      <button
                        key={count}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setDays(count)}
                        className={clsx(
                          'tkv-focusable min-h-[42px] px-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-colors tabular-nums',
                          active
                            ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] shadow-xs'
                            : 'bg-[var(--tkv-bg)] text-[var(--tkv-ink)] border-[var(--tkv-border)] hover:border-[var(--tkv-border-mint)]',
                        )}
                      >
                        {count} ngày
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 2. Meals to Cook + Household Servings Stepper */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-4 items-end">
              <div className="space-y-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink-secondary)]">
                  Bữa nấu tại nhà
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  {MEAL_ORDER.map((meal) => {
                    const selected = activeDraft.cookingMealTypes.includes(meal);
                    return (
                      <button
                        key={meal}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleMealType(meal)}
                        className={clsx(
                          'tkv-focusable min-h-[42px] px-2.5 rounded-xl text-xs sm:text-sm font-bold border transition-colors',
                          selected
                            ? 'bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] border-[var(--tkv-primary)]'
                            : 'bg-[var(--tkv-bg)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)]',
                        )}
                      >
                        {MEAL_CHIP_LABELS[meal]}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink-secondary)] block">
                  Khẩu phần
                </span>
                <div className="inline-flex items-center rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] p-0.5 min-h-[42px]">
                  <button
                    type="button"
                    aria-label="Giảm số người ăn"
                    disabled={activeDraft.householdSize <= 1}
                    onClick={() =>
                      updateDraft({ householdSize: Math.max(1, activeDraft.householdSize - 1) })
                    }
                    className="tkv-focusable w-10 h-9 rounded-lg font-extrabold text-base text-[var(--tkv-ink)] disabled:opacity-40"
                  >
                    −
                  </button>
                  <span
                    data-testid="c24-servings-value"
                    className="px-3 text-sm font-extrabold text-[var(--tkv-ink)] tabular-nums min-w-[76px] text-center"
                  >
                    {activeDraft.householdSize} người
                  </span>
                  <button
                    type="button"
                    aria-label="Tăng số người ăn"
                    disabled={activeDraft.householdSize >= 20}
                    onClick={() =>
                      updateDraft({ householdSize: Math.min(20, activeDraft.householdSize + 1) })
                    }
                    className="tkv-focusable w-10 h-9 rounded-lg font-extrabold text-base text-[var(--tkv-ink)] disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Planning Mode (Auto vs Manual) */}
            {compositionEnabled && (
              <div className="space-y-1.5 pt-1 border-t border-[var(--tkv-border)]">
                <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink-secondary)]">
                  Cách lên món
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    aria-pressed={selectionMode === 'auto'}
                    onClick={() => setSelectionMode('auto')}
                    className={clsx(
                      'tkv-focusable p-3 rounded-xl border text-left transition-colors',
                      selectionMode === 'auto'
                        ? 'bg-[var(--tkv-surface-mint)] border-[var(--tkv-primary)]'
                        : 'bg-[var(--tkv-bg)] border-[var(--tkv-border)]',
                    )}
                  >
                    <p className="text-xs sm:text-sm font-extrabold text-[var(--tkv-ink)]">
                      Gợi ý trọn mâm cơm
                    </p>
                    <p className="text-[11px] text-[var(--tkv-ink-secondary)] mt-0.5">
                      Tự phối món chính, canh, rau, cơm
                    </p>
                  </button>

                  <button
                    type="button"
                    aria-pressed={selectionMode === 'manual'}
                    onClick={() => setSelectionMode('manual')}
                    className={clsx(
                      'tkv-focusable p-3 rounded-xl border text-left transition-colors',
                      selectionMode === 'manual'
                        ? 'bg-[var(--tkv-surface-mint)] border-[var(--tkv-primary)]'
                        : 'bg-[var(--tkv-bg)] border-[var(--tkv-border)]',
                    )}
                  >
                    <p className="text-xs sm:text-sm font-extrabold text-[var(--tkv-ink)]">
                      Tự chọn từng món
                    </p>
                    <p className="text-[11px] text-[var(--tkv-ink-secondary)] mt-0.5">
                      Tạo khung lịch trống để tự thêm
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* 4. Compact Expandable Preferences Summary */}
            <div className="rounded-xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-extrabold text-[var(--tkv-ink)]">
                    Tuỳ chọn bếp & kiêng nguyên liệu
                  </p>
                  <p className="text-xs text-[var(--tkv-ink-secondary)] truncate mt-0.5">
                    {summaryParts.join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  aria-expanded={advancedOpen}
                  onClick={() => setAdvancedOpen((v) => !v)}
                  className="tkv-focusable shrink-0 px-3 py-1.5 rounded-full text-xs font-extrabold text-[var(--tkv-primary)] bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)]"
                >
                  {advancedOpen ? 'Thu gọn' : 'Tuỳ chỉnh'}
                </button>
              </div>

              {advancedOpen && (
                <div className="mt-3 pt-3 border-t border-[var(--tkv-border)] space-y-3.5">
                  {/* Meal Style & Time Preference */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-bold text-[var(--tkv-ink)]">Kiểu bữa ăn</span>
                      <select
                        value={activeDraft.mealStyle}
                        onChange={(e) =>
                          updateDraft({
                            mealStyle: e.target.value as FamilyPreferences['mealStyle'],
                          })
                        }
                        className="w-full min-h-[40px] rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-surface)] px-3 text-xs sm:text-sm font-semibold text-[var(--tkv-ink)]"
                      >
                        <option value="family">Mâm cơm gia đình (mặn · canh · rau · cơm)</option>
                        <option value="quick">Nhanh gọn (ít món hơn)</option>
                        <option value="one_pot">Một món trọn bữa (bún, phở, mì, cơm trộn)</option>
                      </select>
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs font-bold text-[var(--tkv-ink)]">
                        Thời gian nấu mong muốn
                      </span>
                      <select
                        value={activeDraft.preferredTimeMinutes}
                        onChange={(e) =>
                          updateDraft({ preferredTimeMinutes: Number(e.target.value) })
                        }
                        className="w-full min-h-[40px] rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-surface)] px-3 text-xs sm:text-sm font-semibold text-[var(--tkv-ink)]"
                      >
                        {[15, 30, 45, 60, 90].map((mins) => (
                          <option key={mins} value={mins}>
                            Khoảng {mins} phút / bữa
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Inventory Scope & Regional Taste */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="block space-y-1">
                      <span className="text-xs font-bold text-[var(--tkv-ink)]">
                        Nguồn nguyên liệu
                      </span>
                      <select
                        value={mode}
                        onChange={(e) =>
                          setMode(e.target.value as 'shopping_allowed' | 'cook_now')
                        }
                        className="w-full min-h-[40px] rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-surface)] px-3 text-xs sm:text-sm font-semibold text-[var(--tkv-ink)]"
                      >
                        <option value="shopping_allowed">
                          Ưu tiên đồ sẵn có + mua thêm phần thiếu
                        </option>
                        <option value="cook_now">Chỉ dùng nguyên liệu đang có đủ trong tủ</option>
                      </select>
                    </label>

                    <div className="space-y-1">
                      <span className="text-xs font-bold text-[var(--tkv-ink)] block">
                        Khẩu vị vùng miền
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {(
                          [
                            ['bac', 'Miền Bắc'],
                            ['trung', 'Miền Trung'],
                            ['nam', 'Miền Nam'],
                          ] as const
                        ).map(([regionId, regionLabel]) => {
                          const checked = activeDraft.preferredRegions.includes(regionId);
                          return (
                            <button
                              key={regionId}
                              type="button"
                              aria-pressed={checked}
                              onClick={() =>
                                updateDraft({
                                  preferredRegions: checked
                                    ? activeDraft.preferredRegions.filter((r) => r !== regionId)
                                    : [...activeDraft.preferredRegions, regionId],
                                })
                              }
                              className={clsx(
                                'tkv-focusable min-h-[36px] px-3 rounded-full text-xs font-bold border transition-colors',
                                checked
                                  ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)]'
                                  : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)]',
                              )}
                            >
                              {regionLabel}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Safe Ingredient Avoidance Chips */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-[var(--tkv-ink)] block">
                      Không dùng các nhóm nguyên liệu này
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {AVOIDANCE_GROUPS.map((group) => {
                        const checked = isAvoidanceGroupActive(
                          activeDraft.forbiddenIngredientIds,
                          group.id,
                        );
                        return (
                          <button
                            key={group.id}
                            type="button"
                            aria-pressed={checked}
                            onClick={() =>
                              updateDraft({
                                forbiddenIngredientIds: toggleAvoidanceGroup(
                                  activeDraft.forbiddenIngredientIds,
                                  group.id,
                                  !checked,
                                ),
                              })
                            }
                            className={clsx(
                              'tkv-focusable min-h-[36px] px-3 rounded-full text-xs font-bold border transition-colors',
                              checked
                                ? 'bg-[var(--tkv-surface-coral)] text-[var(--tkv-coral-ink)] border-[var(--tkv-border-coral)]'
                                : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)]',
                            )}
                          >
                            {checked ? `✕ ${group.labelVi}` : group.labelVi}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </TkvSurface>

          {/* Inline Error / Conflict Banner Directly Above Submit Button */}
          {errorMessage && (
            <div
              role="alert"
              className="rounded-2xl bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] p-3.5 text-sm text-[var(--tkv-coral-ink)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
            >
              <span className="font-semibold">{errorMessage}</span>
              {(profileConflict || preferences.isError) && (
                <button
                  type="button"
                  onClick={() => void reloadLatestPreferences()}
                  className="tkv-focusable shrink-0 px-3.5 py-1.5 rounded-full bg-white border border-[var(--tkv-border-coral)] text-xs font-extrabold text-[var(--tkv-coral-ink)]"
                >
                  Tải lại dữ liệu mới nhất
                </button>
              )}
            </div>
          )}

          {/* Primary Submit CTA */}
          <div className="flex items-center gap-3">
            <TkvButton
              type="submit"
              data-testid="c24-submit-btn"
              disabled={preferences.isPending && !draft}
              iconRight="arrow-right"
              className="w-full min-h-[52px] text-base"
            >
              {preferences.isPending && !draft
                ? 'Đang tải cấu hình bếp…'
                : selectionMode === 'manual'
                  ? `Tạo khung lịch ${days} ngày`
                  : `Tạo thực đơn ${days} ngày (${days * activeDraft.cookingMealTypes.length} bữa)`}
            </TkvButton>
          </div>
        </form>
      )}
    </ConsumerStudioShell>
  );
};

function formatMealDateVi(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(parsed);
}

/**
 * C25 / C26 — Chi tiết mâm cơm, nguyên liệu tổng hợp, hướng dẫn nấu & đổi món (`/planner/:planId/meal/:slotId`).
 * Pure Brand Board v2 screen (zero legacy `PlannerShell`, zero duplicate headers, zero AI filler copy).
 */
export const C25C26PlannerMealVNext: React.FC = () => {
  const { planId, slotId: rawSlotId } = useParams<{ planId: string; slotId: string }>();
  const slotId = rawSlotId ? decodeURIComponent(rawSlotId) : '';
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isGuest = useAuthStore((s) => s.isGuest);
  const returnTo = `${location.pathname}${location.search}`;

  const handoffParsed = CatalogIdSchema.safeParse(params.get('recipe'));
  const handoffRecipeId = handoffParsed.success ? handoffParsed.data : null;

  const model = usePlanner(planId, !isGuest && Boolean(planId));
  const plan = model.plan;
  const compositionsQuery = usePlanCompositions(plan ?? undefined, !isGuest && Boolean(plan));
  const v2Active =
    isMealCompositionEnabled() && !compositionUnavailable(compositionsQuery.error);

  const effectiveCompositions = useMemo(() => {
    if (!plan || !v2Active) return null;
    if (compositionsQuery.data?.planRevision === plan.revision) {
      return compositionsQuery.data;
    }
    if (
      model.familyPlan &&
      model.familyPlan.plan.id === plan.id &&
      model.familyPlan.plan.revision === plan.revision
    ) {
      return model.familyPlan.compositions;
    }
    return null;
  }, [plan, v2Active, compositionsQuery.data, model.familyPlan]);

  const slotComposition = useMemo(
    () => effectiveCompositions?.compositions.find((c) => c.slotId === slotId) ?? null,
    [effectiveCompositions, slotId],
  );
  const v1Meal = useMemo(
    () => plan?.result.meals.find((m) => m.slotId === slotId) ?? null,
    [plan, slotId],
  );
  const intentSlot = useMemo(
    () => (plan ? plannerSlot(plan, slotId) ?? null : null),
    [plan, slotId],
  );

  const slotDate = slotComposition?.date ?? v1Meal?.date ?? intentSlot?.date ?? '';
  const slotMealType =
    slotComposition?.mealType ?? v1Meal?.mealType ?? intentSlot?.mealType ?? 'dinner';
  const slotServings =
    slotComposition?.servings ??
    v1Meal?.servings ??
    intentSlot?.servings ??
    plan?.intent.defaultServings ??
    2;

  const sortedComponents = useMemo(
    () =>
      slotComposition
        ? [...slotComposition.components].sort((a, b) => a.ordinal - b.ordinal)
        : [],
    [slotComposition],
  );

  // Fetch full recipe details in parallel so V2 meals ALWAYS show complete ingredients & cooking steps!
  const recipeTargets = useMemo(() => {
    if (sortedComponents.length > 0) {
      return sortedComponents
        .filter((c) => c.kind === 'recipe' && Boolean(c.recipeId))
        .map((c) => ({
          recipeId: c.recipeId!,
          fingerprint: c.contentFingerprint ?? undefined,
          title: c.title,
        }));
    }
    if (v1Meal && v1Meal.source.kind === 'recipe') {
      return [
        {
          recipeId: v1Meal.source.id,
          fingerprint: v1Meal.contentFingerprint ?? undefined,
          title: v1Meal.title,
        },
      ];
    }
    return [];
  }, [sortedComponents, v1Meal]);

  const recipeQueries = useQueries({
    queries: recipeTargets.map((target) => ({
      queryKey: queryKeys.recipe(target.recipeId, target.fingerprint),
      queryFn: () => api.getRecipeById(target.recipeId, target.fingerprint),
      staleTime: 60_000,
    })),
  });

  const resolvedRecipes = useMemo(() => {
    const out: Array<{
      recipeId: string;
      slug: string;
      title: string;
      cookTimeMinutes: number;
      ingredients: RecipeIngredient[];
      steps: RecipeStep[];
    }> = [];
    recipeQueries.forEach((q, idx) => {
      const raw = q.data?.recipe;
      if (!raw) return;
      const scaled = scaleRecipeServings(raw, slotServings);
      out.push({
        recipeId: scaled.id,
        slug: scaled.slug || resolveCanonicalDishSlug(scaled.id, null, scaled.title),
        title: scaled.title || recipeTargets[idx]?.title || '',
        cookTimeMinutes: scaled.cookTimeMinutes,
        ingredients: scaled.ingredients,
        steps: scaled.steps,
      });
    });
    return out;
  }, [recipeQueries, recipeTargets, slotServings]);

  // Unified Ingredient Checklist across the entire meal tray
  const aggregatedIngredients = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        ingredientId: string;
        name: string;
        unit: string;
        requiredQty: number | null;
        missingQty: number | null;
        status: 'satisfied' | 'missing';
      }
    >();

    let usedAssessment = false;
    for (const comp of sortedComponents) {
      if (!comp.assessment) continue;
      usedAssessment = true;
      for (const req of comp.assessment.requirements) {
        const key = `${req.ingredientId}:${req.unit}`;
        const prev = map.get(key);
        const isMissing = !req.isOptional && req.status !== 'satisfied';
        const canonicalVi = ingredientLabel(req.ingredientId, 'vi');
        const resolvedIngName =
          req.name && !/^[A-Za-z\s/-]+$/.test(req.name) ? req.name : canonicalVi || req.name;
        map.set(key, {
          key,
          ingredientId: req.ingredientId,
          name: resolvedIngName,
          unit: req.unit,
          requiredQty:
            req.requiredQuantity !== null
              ? (prev?.requiredQty ?? 0) + req.requiredQuantity
              : prev?.requiredQty ?? null,
          missingQty: isMissing
            ? req.missingQuantity !== null
              ? (prev?.missingQty ?? 0) + req.missingQuantity
              : prev?.missingQty ?? null
            : prev?.missingQty ?? null,
          status: isMissing || prev?.status === 'missing' ? 'missing' : 'satisfied',
        });
      }
    }

    if (!usedAssessment && resolvedRecipes.length > 0) {
      for (const rec of resolvedRecipes) {
        for (const ing of rec.ingredients) {
          const key = `${ing.ingredientId}:${ing.unit}`;
          const prev = map.get(key);
          map.set(key, {
            key,
            ingredientId: ing.ingredientId,
            name: ing.name || ingredientLabel(ing.ingredientId, 'vi'),
            unit: ing.unit,
            requiredQty: (prev?.requiredQty ?? 0) + ing.requiredQuantity,
            missingQty: null,
            status: 'satisfied',
          });
        }
      }
    }

    if (
      map.size === 0 &&
      slotComposition?.source !== 'v2' &&
      v1Meal &&
      v1Meal.requirements.length > 0
    ) {
      for (const req of v1Meal.requirements) {
        const key = `${req.ingredientId}:${req.required.unit}`;
        const isMissing = !req.optional && req.status !== 'satisfied';
        map.set(key, {
          key,
          ingredientId: req.ingredientId,
          name: ingredientLabel(req.ingredientId, 'vi'),
          unit: req.required.unit,
          requiredQty: Number(req.required.value),
          missingQty: req.missing ? Number(req.missing.value) : null,
          status: isMissing ? 'missing' : 'satisfied',
        });
      }
    }

    return [...map.values()].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'missing' ? -1 : 1;
      return a.name.localeCompare(b.name, 'vi');
    });
  }, [sortedComponents, slotComposition, v1Meal, resolvedRecipes]);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const [pickerState, setPickerState] = useState<{
    intent: 'add' | 'swap';
    role: MealRole;
    componentId?: string;
    replacingTitle?: string;
    initialRecipeId?: string | null;
  } | null>(null);

  const editable = Boolean(
    plan && v2Active && slotDate && isSlotEditableTodayOrFuture(plan, slotDate),
  );

  // Auto-open picker when arriving via `?recipe=...` handoff
  useEffect(() => {
    if (handoffRecipeId && editable && !pickerState) {
      setPickerState({
        intent: 'add',
        role: 'main',
        initialRecipeId: handoffRecipeId,
      });
    }
  }, [handoffRecipeId, editable, pickerState]);

  const clearHandoffParam = () => {
    if (!params.has('recipe')) return;
    const next = new URLSearchParams(params);
    next.delete('recipe');
    setParams(next, { replace: true });
  };

  const handleChooseDish = async (item: PickerItemDto, chosenRole: MealRole) => {
    if (!plan || !pickerState || busyKey) return;
    setFeedback(null);
    setBusyKey('picker');
    const target =
      item.kind === 'recipe'
        ? ({ kind: 'recipe', recipeId: item.id } as const)
        : ({ kind: 'simple_food', simpleFoodId: item.id } as const);

    try {
      const dto =
        pickerState.intent === 'swap' && pickerState.componentId
          ? await mealCompositionApi.swap(plan.id, slotId, pickerState.componentId, {
              revision: plan.revision,
              target,
              role: chosenRole,
              locked: true,
            })
          : await mealCompositionApi.add(plan.id, slotId, {
              revision: plan.revision,
              target,
              role: chosenRole,
              locked: true,
            });
      acceptSlotCompositionMutation(queryClient, plan, effectiveCompositions, dto);
      clearHandoffParam();
      setPickerState(null);
    } catch (failure) {
      setFeedback({ tone: 'error', text: plannerErrorMessage(failure, 'vi') });
    } finally {
      setBusyKey(null);
    }
  };

  const handleToggleLock = async (componentId: string, nextLocked: boolean) => {
    if (!plan || busyKey) return;
    setFeedback(null);
    setBusyKey(`lock:${componentId}`);
    try {
      const dto = await mealCompositionApi.update(plan.id, slotId, componentId, {
        revision: plan.revision,
        locked: nextLocked,
      });
      acceptSlotCompositionMutation(queryClient, plan, effectiveCompositions, dto);
    } catch (failure) {
      setFeedback({ tone: 'error', text: plannerErrorMessage(failure, 'vi') });
    } finally {
      setBusyKey(null);
    }
  };

  const handleRemove = async (componentId: string) => {
    if (!plan || busyKey) return;
    setFeedback(null);
    setBusyKey(`rm:${componentId}`);
    try {
      const dto = await mealCompositionApi.remove(plan.id, slotId, componentId, plan.revision);
      acceptSlotCompositionMutation(queryClient, plan, effectiveCompositions, dto);
    } catch (failure) {
      setFeedback({ tone: 'error', text: plannerErrorMessage(failure, 'vi') });
    } finally {
      setBusyKey(null);
    }
  };

  const handleRefreshMeal = async () => {
    if (!plan || busyKey) return;
    setFeedback(null);
    setBusyKey('refresh');
    try {
      const action = sortedComponents.length === 0 ? 'complete' : 'regenerate_unlocked';
      const proposal = await mealCompositionApi.assist(plan.id, slotId, {
        revision: plan.revision,
        action,
        variant: 0,
      });
      if (!proposal.proposal) {
        setFeedback({ tone: 'info', text: 'Chưa có phương án thay thế khác cho bữa này.' });
        return;
      }
      const applied = await mealCompositionApi.assistApply(plan.id, slotId, {
        revision: plan.revision,
        action,
        variant: 0,
        proposalId: proposal.proposal.optionId,
      });
      acceptSlotCompositionMutation(queryClient, plan, effectiveCompositions, applied);
    } catch (failure) {
      setFeedback({ tone: 'error', text: plannerErrorMessage(failure, 'vi') });
    } finally {
      setBusyKey(null);
    }
  };

  const handleSyncShopping = async () => {
    if (!plan || busyKey) return;
    setFeedback(null);
    setBusyKey('shopping');
    try {
      await syncPlanToShoppingList(queryClient, plan);
      showTkvToast({
        message: 'Đã đồng bộ nguyên liệu sang danh sách đi chợ',
        tone: 'success',
      });
      navigate('/shopping');
    } catch (failure) {
      setFeedback({ tone: 'error', text: plannerErrorMessage(failure, 'vi') });
    } finally {
      setBusyKey(null);
    }
  };

  const slotFound = Boolean(slotComposition || v1Meal || intentSlot);
  const missingIngCount = aggregatedIngredients.filter((i) => i.status === 'missing').length;

  return (
    <ConsumerStudioShell
      screenId="C25"
      title={MEAL_CHIP_LABELS[slotMealType]}
      backTo={vnextHref(planId ? `/planner/${planId}` : '/planner')}
    >
      {isGuest ? (
        <TkvSurface className="p-5 space-y-4 bg-[var(--tkv-surface)] max-w-xl mx-auto">
          <h1 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink)]">
            Đăng nhập để xem chi tiết bữa ăn
          </h1>
          <Link
            data-testid="planner-login-cta"
            to={`/auth?mode=login&returnTo=${encodeURIComponent(returnTo)}`}
            className="tkv-focusable w-full min-h-[48px] px-5 py-3 rounded-full bg-[var(--tkv-primary)] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2"
          >
            <span>Đăng nhập để tiếp tục</span>
            <VNextIcon name="chevron-right" size={16} />
          </Link>
        </TkvSurface>
      ) : model.query.isPending ? (
        <WeeklyPlannerSkeleton label="Đang tải mâm cơm…" />
      ) : model.query.isError || !plan ? (
        <TkvErrorState
          title="Không tải được bữa ăn"
          message="Kế hoạch này không tồn tại hoặc kết nối tạm gián đoạn."
          onRetry={() => void model.query.refetch()}
        />
      ) : !slotFound ? (
        <TkvErrorState
          title="Bữa ăn không nằm trong lịch hiện tại"
          message="Lịch thực đơn có thể vừa được cập nhật. Hãy quay lại thực đơn tuần để chọn bữa."
          onRetry={() => navigate(`/planner/${plan.id}`)}
        />
      ) : (
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          {/* Compact Meal Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-[var(--tkv-surface-mint)] text-xs font-extrabold text-[var(--tkv-primary)]">
                  {MEAL_CHIP_LABELS[slotMealType]}
                </span>
                <span className="text-xs font-bold text-[var(--tkv-ink-secondary)] capitalize tabular-nums">
                  {formatMealDateVi(slotDate)} · {slotServings} người
                </span>
              </div>
              <h1 className="tkv-heading text-xl sm:text-2xl font-extrabold text-[var(--tkv-ink)] mt-1">
                {sortedComponents.length > 0
                  ? sortedComponents.map((c) => c.title).join(' · ')
                  : v1Meal?.title ?? 'Mâm cơm đang chọn món'}
              </h1>
            </div>

            {editable && (
              <button
                type="button"
                disabled={Boolean(busyKey)}
                onClick={() => void handleRefreshMeal()}
                className="tkv-focusable self-start sm:self-auto min-h-[38px] px-3.5 py-1.5 rounded-full bg-[var(--tkv-surface)] border border-[var(--tkv-border)] hover:border-[var(--tkv-primary)] text-xs font-extrabold text-[var(--tkv-ink)] inline-flex items-center gap-1.5 shrink-0"
              >
                <VNextIcon name="refresh" size={14} />
                <span>{busyKey === 'refresh' ? 'Đang đổi…' : 'Đổi gợi ý bữa này'}</span>
              </button>
            )}
          </div>

          {feedback && (
            <div
              role={feedback.tone === 'error' ? 'alert' : 'status'}
              className={clsx(
                'rounded-2xl px-4 py-3 text-xs font-semibold border flex items-center justify-between gap-2',
                feedback.tone === 'error'
                  ? 'bg-[var(--tkv-surface-coral)] border-[var(--tkv-border-coral)] text-[var(--tkv-coral-ink)]'
                  : 'bg-[var(--tkv-surface-mint)] border-[var(--tkv-border-mint)] text-[var(--tkv-primary)]',
              )}
            >
              <span>{feedback.text}</span>
              <button type="button" onClick={() => setFeedback(null)} className="font-extrabold">
                Đóng
              </button>
            </div>
          )}

          {/* 1. Dishes in Meal Tray */}
          <TkvSurface className="p-4 sm:p-5 space-y-3 bg-[var(--tkv-surface)]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">
                Các món trong bữa ({sortedComponents.length || (v1Meal ? 1 : 0)})
              </h2>
              {editable && sortedComponents.length < 8 && (
                <button
                  type="button"
                  disabled={Boolean(busyKey)}
                  onClick={() =>
                    setPickerState({
                      intent: 'add',
                      role: slotComposition?.missingRoles[0] ?? 'side',
                    })
                  }
                  className="tkv-focusable px-3 py-1.5 rounded-full bg-[var(--tkv-primary)] text-white text-xs font-extrabold inline-flex items-center gap-1"
                >
                  <VNextIcon name="plus" size={13} />
                  <span>Thêm món</span>
                </button>
              )}
            </div>

            {sortedComponents.length > 0 ? (
              <ul className="divide-y divide-[var(--tkv-border)]">
                {sortedComponents.map((comp) => {
                  const slug = resolveCanonicalDishSlug(comp.recipeId, null, comp.title);
                  const recipeDetailHref =
                    comp.kind === 'recipe' && comp.recipeId && comp.cookable
                      ? `/recipes/id/${encodeURIComponent(comp.recipeId)}?servings=${slotServings}&returnTo=${encodeURIComponent(returnTo)}${comp.contentFingerprint ? `&version=${comp.contentFingerprint}` : ''}`
                      : null;
                  const cookHref =
                    comp.kind === 'recipe' && comp.recipeId && comp.cookable
                      ? `/cook/${encodeURIComponent(slug || comp.recipeId)}?servings=${slotServings}&returnTo=${encodeURIComponent(returnTo)}`
                      : null;

                  return (
                    <li
                      key={comp.id}
                      className="py-3 first:pt-1 last:pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <VerifiedDishImage
                          recipeId={comp.recipeId}
                          title={comp.title}
                          aspectClass="aspect-square"
                          compact
                          className="w-14 h-14 rounded-xl shrink-0 border border-[var(--tkv-border)]"
                        />
                        <div className="min-w-0">
                          {recipeDetailHref ? (
                            <Link
                              to={recipeDetailHref}
                              className="tkv-heading text-sm sm:text-base font-extrabold text-[var(--tkv-ink)] hover:text-[var(--tkv-primary)] line-clamp-1"
                            >
                              {comp.title}
                            </Link>
                          ) : (
                            <p className="tkv-heading text-sm sm:text-base font-extrabold text-[var(--tkv-ink)] line-clamp-1">
                              {comp.title}
                            </p>
                          )}
                          <div className="flex items-center gap-1.5 flex-wrap text-xs font-semibold text-[var(--tkv-ink-secondary)] mt-0.5 tabular-nums">
                            <span className="text-[var(--tkv-primary)] font-bold">
                              {roleLabel(comp.role, 'vi')}
                            </span>
                            {comp.cookTimeMinutes !== null && (
                              <>
                                <span>·</span>
                                <span>{comp.cookTimeMinutes} phút</span>
                              </>
                            )}
                            {comp.locked && (
                              <>
                                <span>·</span>
                                <span className="text-[var(--tkv-ink-muted)]">Đã ghim</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                        {cookHref && (
                          <Link
                            to={cookHref}
                            className="tkv-focusable min-h-[34px] px-3 rounded-lg bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] text-xs font-extrabold text-[var(--tkv-primary)] inline-flex items-center gap-1"
                          >
                            <span>Nấu món này</span>
                          </Link>
                        )}
                        {editable && (
                          <>
                            <button
                              type="button"
                              disabled={Boolean(busyKey)}
                              onClick={() =>
                                setPickerState({
                                  intent: 'swap',
                                  role: comp.role,
                                  componentId: comp.id,
                                  replacingTitle: comp.title,
                                })
                              }
                              className="tkv-focusable min-h-[34px] px-2.5 rounded-lg bg-[var(--tkv-bg)] border border-[var(--tkv-border)] text-xs font-extrabold text-[var(--tkv-ink)] inline-flex items-center gap-1"
                            >
                              <VNextIcon name="swap" size={13} />
                              <span>Đổi</span>
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(busyKey)}
                              aria-label={comp.locked ? `Bỏ ghim ${comp.title}` : `Ghim ${comp.title}`}
                              onClick={() => void handleToggleLock(comp.id, !comp.locked)}
                              className={clsx(
                                'tkv-focusable w-8 h-8 rounded-lg border flex items-center justify-center',
                                comp.locked
                                  ? 'bg-[var(--tkv-surface-mint)] border-[var(--tkv-primary)] text-[var(--tkv-primary)]'
                                  : 'bg-[var(--tkv-bg)] border-[var(--tkv-border)] text-[var(--tkv-ink-muted)]',
                              )}
                            >
                              <VNextIcon name="lock" size={13} />
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(busyKey)}
                              aria-label={`Bỏ món ${comp.title}`}
                              onClick={() => void handleRemove(comp.id)}
                              className="tkv-focusable w-8 h-8 rounded-lg bg-[var(--tkv-bg)] border border-[var(--tkv-border)] text-[var(--tkv-ink-muted)] hover:text-[var(--tkv-coral)] flex items-center justify-center"
                            >
                              <VNextIcon name="trash" size={13} />
                            </button>
                          </>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : v1Meal ? (
              <div className="flex items-center justify-between gap-3 py-1">
                <div className="flex items-center gap-3 min-w-0">
                  <VerifiedDishImage
                    recipeId={v1Meal.source.kind === 'recipe' ? v1Meal.source.id : null}
                    title={v1Meal.title}
                    aspectClass="aspect-square"
                    compact
                    className="w-14 h-14 rounded-xl shrink-0 border border-[var(--tkv-border)]"
                  />
                  <div>
                    <p className="text-sm font-extrabold text-[var(--tkv-ink)]">{v1Meal.title}</p>
                    {v1Meal.cookTimeMinutes !== null && (
                      <p className="text-xs text-[var(--tkv-ink-secondary)]">
                        {v1Meal.cookTimeMinutes} phút nấu
                      </p>
                    )}
                  </div>
                </div>
                {v1Meal.source.kind === 'recipe' && (
                  <Link
                    to={`/recipes/id/${encodeURIComponent(v1Meal.source.id)}?servings=${slotServings}&returnTo=${encodeURIComponent(returnTo)}`}
                    className="tkv-focusable px-3 py-1.5 rounded-full bg-[var(--tkv-surface-mint)] text-xs font-extrabold text-[var(--tkv-primary)]"
                  >
                    Xem công thức
                  </Link>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--tkv-ink-secondary)] py-2">
                Bữa này chưa có món nào. Bấm <strong>Thêm món</strong> để bắt đầu xếp mâm cơm.
              </p>
            )}
          </TkvSurface>

          {/* 2. Unified Ingredient Checklist for the Whole Meal */}
          {aggregatedIngredients.length > 0 && (
            <TkvSurface
              data-testid="c25-meal-ingredients"
              className="p-4 sm:p-5 space-y-3 bg-[var(--tkv-surface)]"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h2 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)] tabular-nums">
                    Nguyên liệu chuẩn bị ({aggregatedIngredients.length})
                  </h2>
                  <p className="text-xs text-[var(--tkv-ink-secondary)] tabular-nums">
                    {missingIngCount > 0
                      ? `Cần mua thêm ${missingIngCount} nguyên liệu cho bữa này`
                      : 'Tủ lạnh đã đủ nguyên liệu dự kiến'}
                  </p>
                </div>

                {missingIngCount > 0 && (
                  <button
                    type="button"
                    disabled={Boolean(busyKey)}
                    onClick={() => void handleSyncShopping()}
                    className="tkv-focusable min-h-[36px] px-3.5 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-[var(--tkv-shadow-cta)] transition-colors"
                  >
                    <VNextIcon name="shopping" size={13} />
                    <span>
                      {busyKey === 'shopping' ? 'Đang chuyển…' : 'Thêm thiếu vào Giỏ đi chợ'}
                    </span>
                  </button>
                )}
              </div>

              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {aggregatedIngredients.map((ing) => {
                  const thumb = getIngredientImage(ing.ingredientId, ing.name);
                  return (
                    <li
                      key={ing.key}
                      className="rounded-xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] px-3 py-2 flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {thumb && (
                          <img
                            src={thumb}
                            alt=""
                            width={28}
                            height={28}
                            loading="lazy"
                            className="w-7 h-7 object-contain shrink-0"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs sm:text-sm font-bold text-[var(--tkv-ink)] truncate">
                            {ing.name}
                          </p>
                          <p className="text-[11px] font-semibold text-[var(--tkv-ink-secondary)] tabular-nums">
                            Cần: {formatKitchenAmount(ing.requiredQty, ing.unit)}
                          </p>
                        </div>
                      </div>

                      <span
                        className={clsx(
                          'shrink-0 px-2 py-0.5 rounded-full text-[11px] font-extrabold tabular-nums',
                          ing.status === 'missing'
                            ? 'bg-[var(--tkv-surface-coral)] text-[var(--tkv-coral-ink)]'
                            : 'bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)]',
                        )}
                      >
                        {ing.status === 'missing'
                          ? ing.missingQty !== null
                            ? `Mua ${formatKitchenAmount(ing.missingQty, ing.unit)}`
                            : 'Cần mua'
                          : 'Có sẵn'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </TkvSurface>
          )}

          {/* 3. Step-by-Step Cooking Guide per Dish (Visible in both V2 and V1!) */}
          {(resolvedRecipes.length > 0 || (v1Meal && v1Meal.instructions.length > 0)) && (
            <TkvSurface
              data-testid="c25-meal-steps"
              className="p-4 sm:p-5 space-y-3.5 bg-[var(--tkv-surface)]"
            >
              <h2 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">
                Hướng dẫn chế biến
              </h2>

              {resolvedRecipes.length > 0 ? (
                <div className="space-y-3">
                  {resolvedRecipes.map((rec, idx) => (
                    <details
                      key={`${rec.recipeId}-${idx}`}
                      open={idx === 0}
                      className="rounded-2xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] p-3.5"
                    >
                      <summary className="cursor-pointer list-none flex items-center justify-between gap-2">
                        <span className="tkv-heading text-sm font-extrabold text-[var(--tkv-ink)]">
                          {rec.title}
                        </span>
                        <span className="text-xs font-bold text-[var(--tkv-primary)] shrink-0 tabular-nums">
                          {rec.steps.length} bước · {rec.cookTimeMinutes}p
                        </span>
                      </summary>

                      <ol className="mt-3 pt-3 border-t border-[var(--tkv-border)] space-y-2.5">
                        {rec.steps.map((step, sIdx) => (
                          <li key={step.stepNumber ?? sIdx} className="flex items-start gap-2.5 text-xs sm:text-sm text-[var(--tkv-ink)] leading-relaxed">
                            <span className="w-5 h-5 rounded-full bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] font-extrabold text-[11px] flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                              {sIdx + 1}
                            </span>
                            <span>{step.instruction}</span>
                          </li>
                        ))}
                      </ol>

                      <div className="mt-3 pt-2 flex items-center justify-end gap-2">
                        <Link
                          to={`/cook/${encodeURIComponent(rec.slug || rec.recipeId)}?servings=${slotServings}&returnTo=${encodeURIComponent(returnTo)}`}
                          className="tkv-focusable min-h-[36px] px-3.5 rounded-full bg-[var(--tkv-primary)] text-white text-xs font-extrabold inline-flex items-center gap-1.5"
                        >
                          <span>Bắt đầu nấu từng bước</span>
                          <VNextIcon name="arrow-right" size={13} />
                        </Link>
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <ol className="space-y-2">
                  {v1Meal!.instructions.map((line, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-[var(--tkv-ink)]">
                      <span className="w-5 h-5 rounded-full bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] font-extrabold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ol>
              )}
            </TkvSurface>
          )}
        </div>
      )}

      {plan && pickerState && (
        <VNextDishPickerSheet
          open={Boolean(pickerState)}
          intent={pickerState.intent}
          initialRole={pickerState.role}
          initialRecipeId={pickerState.initialRecipeId}
          replacingTitle={pickerState.replacingTitle}
          scope={{
            planId: plan.id,
            slotId,
            revision: plan.revision,
            date: slotDate,
            mealType: slotMealType,
            servings: slotServings,
            excludeComponentId: pickerState.componentId,
            noBuy: plan.intent.mode === 'cook_now',
          }}
          busy={Boolean(busyKey)}
          onChoose={(item, role) => void handleChooseDish(item, role)}
          onClose={() => {
            clearHandoffParam();
            setPickerState(null);
          }}
          onReloadPlan={() => void model.query.refetch()}
        />
      )}
    </ConsumerStudioShell>
  );
};

/**
 * C27 / C28 — Danh sách đi chợ & Sửa mục mua hàng (`/shopping`).
 * Pure Brand Board v2 Calm Kitchen Shopping Studio tightly linked to the active weekly meal plan,
 * preserving offline outbox (`pendingSync`), stable idempotency keys, and honest demand review.
 */
export const C27C28ShoppingVNext: React.FC = () => (
  <ConsumerStudioShell screenId="C27" title="Danh sách mua sắm">
    <Suspense fallback={<ShoppingListSkeleton />}>
      <LazyShoppingStudio />
    </Suspense>
  </ConsumerStudioShell>
);

/**
 * C29 — Đồng bộ nguyên liệu đi chợ theo kế hoạch (`/planner/:planId/shopping`).
 * Streamlined single-card Brand Board v2 grocery sync screen.
 */
export const C29ShoppingImportVNext: React.FC = () => {
  const { planId } = useParams<{ planId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isGuest = useAuthStore((s) => s.isGuest);
  const returnTo = `${location.pathname}${location.search}`;

  const model = usePlanner(planId, !isGuest && Boolean(planId));
  const plan = model.plan;
  const compositionsQuery = usePlanCompositions(plan ?? undefined, !isGuest && Boolean(plan));

  const [tripDays, setTripDays] = useState<number | undefined>(undefined);
  const [syncing, setSyncing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const windowRange = useMemo(
    () => (plan ? resolvePlanShoppingWindow(plan, tripDays) : null),
    [plan, tripDays],
  );

  const previewMissing = useMemo(() => {
    if (!plan || !windowRange) return [];
    const map = new Map<
      string,
      { ingredientId: string; name: string; unit: string; missingQty: number | null }
    >();
    const comps =
      compositionsQuery.data?.planRevision === plan.revision
        ? compositionsQuery.data.compositions
        : model.familyPlan?.plan.revision === plan.revision
          ? model.familyPlan.compositions.compositions
          : [];

    for (const slot of comps) {
      if (slot.date < windowRange.startDate || slot.date > windowRange.endDate) continue;
      for (const comp of slot.components) {
        for (const req of comp.assessment?.requirements ?? []) {
          if (req.isOptional || req.status === 'satisfied') continue;
          const key = `${req.ingredientId}:${req.unit}`;
          const prev = map.get(key);
          map.set(key, {
            ingredientId: req.ingredientId,
            name: req.name || ingredientLabel(req.ingredientId, 'vi'),
            unit: req.unit,
            missingQty:
              req.missingQuantity !== null
                ? (prev?.missingQty ?? 0) + req.missingQuantity
                : prev?.missingQty ?? null,
          });
        }
      }
    }

    if (map.size === 0) {
      for (const meal of plan.result.meals) {
        if (meal.date < windowRange.startDate || meal.date > windowRange.endDate) continue;
        for (const req of meal.requirements) {
          if (req.optional || req.status === 'satisfied') continue;
          const key = `${req.ingredientId}:${req.required.unit}`;
          const prev = map.get(key);
          const addQty = req.missing ? Number(req.missing.value) : 0;
          map.set(key, {
            ingredientId: req.ingredientId,
            name: ingredientLabel(req.ingredientId, 'vi'),
            unit: req.required.unit,
            missingQty: addQty > 0 ? (prev?.missingQty ?? 0) + addQty : prev?.missingQty ?? null,
          });
        }
      }
    }

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  }, [plan, windowRange, compositionsQuery.data, model.familyPlan]);

  const handleSync = async () => {
    if (!plan || syncing) return;
    setErrorMsg(null);
    setSyncing(true);
    try {
      await syncPlanToShoppingList(queryClient, plan, { days: tripDays });
      showTkvToast({
        message: 'Đã đồng bộ nguyên liệu sang danh sách mua sắm',
        tone: 'success',
      });
      navigate('/shopping');
    } catch (failure) {
      setErrorMsg(plannerErrorMessage(failure, 'vi'));
    } finally {
      setSyncing(false);
    }
  };

  return (
    <ConsumerStudioShell
      screenId="C29"
      title="Đi chợ theo thực đơn"
      backTo={vnextHref(planId ? `/planner/${planId}` : '/planner')}
    >
      {isGuest ? (
        <TkvSurface className="p-5 space-y-4 bg-[var(--tkv-surface)] max-w-xl mx-auto">
          <h1 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink)]">
            Đăng nhập để đồng bộ giỏ đi chợ
          </h1>
          <Link
            data-testid="planner-login-cta"
            to={`/auth?mode=login&returnTo=${encodeURIComponent(returnTo)}`}
            className="tkv-focusable w-full min-h-[48px] px-5 py-3 rounded-full bg-[var(--tkv-primary)] text-white font-extrabold text-sm inline-flex items-center justify-center gap-2"
          >
            <span>Đăng nhập để tiếp tục</span>
            <VNextIcon name="chevron-right" size={16} />
          </Link>
        </TkvSurface>
      ) : model.query.isPending ? (
        <ShoppingListSkeleton label="Đang đối chiếu nguyên liệu cần mua…" />
      ) : model.query.isError || !plan ? (
        <TkvErrorState
          title="Chưa tải được dữ liệu thực đơn"
          message="Vui lòng thử lại hoặc quay về trang Thực đơn."
          onRetry={() => void model.query.refetch()}
        />
      ) : (
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="flex items-center gap-3">
            <BrandFeatureIcon name="shopping" size={40} className="shrink-0" />
            <div>
              <h1 className="tkv-heading text-xl sm:text-2xl font-extrabold text-[var(--tkv-ink)]">
                Gom nguyên liệu đi chợ
              </h1>
              <p className="text-xs sm:text-sm text-[var(--tkv-ink-secondary)]">
                Chọn nhịp mua sắm — hệ thống tự trừ phần đã có sẵn trong tủ lạnh.
              </p>
            </div>
          </div>

          <TkvSurface className="p-4 sm:p-5 space-y-4 bg-[var(--tkv-surface)]">
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  [1, 'Hôm nay'],
                  [3, '3 ngày tới'],
                  [undefined, 'Cả tuần'],
                ] as const
              ).map(([d, label]) => {
                const active = tripDays === d;
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setTripDays(d)}
                    className={clsx(
                      'tkv-focusable min-h-[42px] rounded-xl text-xs sm:text-sm font-extrabold border transition-colors',
                      active
                        ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)]'
                        : 'bg-[var(--tkv-bg)] text-[var(--tkv-ink)] border-[var(--tkv-border)]',
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {previewMissing.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-extrabold text-[var(--tkv-ink-secondary)] tabular-nums">
                  Dự kiến cần mua ({previewMissing.length} mục)
                </p>
                <ul className="max-h-72 overflow-y-auto divide-y divide-[var(--tkv-border)] rounded-xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] px-3">
                  {previewMissing.map((item) => {
                    const thumb = getIngredientImage(item.ingredientId, item.name);
                    return (
                      <li
                        key={`${item.ingredientId}:${item.unit}`}
                        className="py-2.5 flex items-center justify-between gap-2 text-xs sm:text-sm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {thumb && (
                            <img
                              src={thumb}
                              alt=""
                              width={24}
                              height={24}
                              loading="lazy"
                              className="w-6 h-6 object-contain shrink-0"
                            />
                          )}
                          <span className="font-bold text-[var(--tkv-ink)] truncate">{item.name}</span>
                        </div>
                        <span className="font-extrabold text-[var(--tkv-primary)] tabular-nums shrink-0">
                          {formatKitchenAmount(item.missingQty, item.unit)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-[var(--tkv-ink-secondary)] py-2">
                {compositionsQuery.isPending
                  ? 'Đang tính toán lượng nguyên liệu cần mua…'
                  : 'Các bữa trong khoảng ngày này đã đủ nguyên liệu hoặc chưa cần mua thêm.'}
              </p>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] p-3 text-xs font-semibold text-[var(--tkv-coral-ink)]"
              >
                {errorMsg}
              </div>
            )}

            <TkvButton
              type="button"
              data-testid="c29-sync-shopping-btn"
              disabled={syncing}
              iconRight="arrow-right"
              onClick={() => void handleSync()}
              className="w-full min-h-[50px]"
            >
              {syncing ? 'Đang đồng bộ vào Giỏ đi chợ…' : 'Đồng bộ sang Giỏ đi chợ & Mở danh sách'}
            </TkvButton>
          </TkvSurface>
        </div>
      )}
    </ConsumerStudioShell>
  );
};
