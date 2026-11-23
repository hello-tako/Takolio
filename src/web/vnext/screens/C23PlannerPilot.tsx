import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import type {
  MealComponentDto,
  MealCompositionDto,
  MealRole,
  PickerItemDto,
} from '../../../../packages/domain/src/meal-composition-api';
import type { PlannedMealDto } from '../../../../packages/domain/src/meal-planning-api';
import { useAuthStore } from '../../stores/useAuthStore';
import { mealCompositionApi } from '../../services/meal-composition';
import { familyPreferencesApi } from '../../services/family-preferences';
import { familyPreferencesKey } from '../../features/family/useFamilyPreferences';
import { sanitizeFamilyPreferencesForGeneration } from '../../features/family/preference-sync';
import {
  compositionUnavailable,
  isMealCompositionEnabled,
  roleLabel,
  usePlanCompositions,
} from '../../features/planner/composition';
import { usePlanner } from '../../features/planner/usePlanner';
import {
  plannerErrorMessage,
  plannerStatusLabel,
} from '../../features/planner/presentation';
import { ConsumerStudioShell } from '../components/Shells';
import {
  TkvButton,
  TkvEmptyState,
  TkvErrorState,
  TkvSurface,
} from '../components/Primitives';
import { showTkvToast } from '../components/LivingMotion';
import { VNextIcon } from '../components/VNextIcons';
import {
  BrandFeatureIcon,
  MascotIllustration,
  resolveCanonicalDishSlug,
  VerifiedDishImage,
} from '../components/VNextMedia';
import { VNextDishPickerSheet } from '../components/VNextDishPickerSheet';
import { WeeklyPlannerSkeleton } from '../components/Skeletons';
import {
  acceptSlotCompositionMutation,
  buildRecoveryIntentForPlan,
  isSlotEditableTodayOrFuture,
  syncPlanToShoppingList,
} from '../lib/planner-workbench';
import { useVNextSeo } from '../lib/seo';
import { useAppLocale } from '../../i18n/LocaleContext';

const LEGACY_NAME_RE = /\bFri\w*\b/i;
function sanitizeUserDisplayName(raw: string | undefined | null, isGuest = false): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return isGuest ? 'Khách ghé thăm' : 'Bếp trưởng';
  if (LEGACY_NAME_RE.test(trimmed)) return 'Bếp trưởng';
  return raw as string;
}

const MEAL_LABELS: Record<'breakfast' | 'lunch' | 'dinner', string> = {
  breakfast: 'Bữa sáng',
  lunch: 'Bữa trưa',
  dinner: 'Bữa tối',
};

const MEAL_SORT_ORDER: Record<'breakfast' | 'lunch' | 'dinner', number> = {
  breakfast: 0,
  lunch: 1,
  dinner: 2,
};

const SHORT_WEEKDAY_VI = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'] as const;
const SHORT_WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function formatDayHeadingVi(isoDate: string): string {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(parsed);
}

function formatDayPillParts(
  isoDate: string,
  locale: 'vi' | 'en',
): { weekday: string; dateShort: string } {
  const parsed = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return { weekday: isoDate.slice(5), dateShort: '' };
  }
  const dayOfWeek = parsed.getUTCDay();
  const dd = String(parsed.getUTCDate()).padStart(2, '0');
  const mm = String(parsed.getUTCMonth() + 1).padStart(2, '0');
  return {
    weekday: locale === 'vi' ? SHORT_WEEKDAY_VI[dayOfWeek]! : SHORT_WEEKDAY_EN[dayOfWeek]!,
    dateShort: `${dd}/${mm}`,
  };
}

interface UnifiedSlotView {
  slotId: string;
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner';
  servings: number;
  title: string;
  dishTitles: string[];
  components: MealComponentDto[];
  missingRoles: MealRole[];
  leadRecipeId: string | null;
  leadSlug: string;
  cookMinutes: number | null;
  missingCount: number;
  isEmptyManual: boolean;
  isUnplanned: boolean;
}

function compHasAssessment(components: ReadonlyArray<{ assessment?: unknown }>): boolean {
  return components.some((c) => c.assessment !== undefined);
}

function componentMissingCount(comp: MealComponentDto): number {
  if (comp.assessment) {
    return comp.assessment.requirements.filter(
      (r) => !r.isOptional && r.status !== 'satisfied',
    ).length;
  }
  return comp.projection?.missingCount ?? 0;
}

/**
 * C23 — Thực đơn tuần (Minimalist Inline Workbench, Official Takolio Brand Board v2).
 * Renders full V2 multi-dish trays inline per day, 1-tap dish swap/add/remove via bottom sheet,
 * 1-tap refresh per meal, and 1-tap grocery sync straight to `/shopping`.
 */
export const C23PlannerPilot: React.FC = () => {
  const { planId } = useParams<{ planId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isGuest = useAuthStore((s) => s.isGuest);
  const displayName = useAuthStore((s) => s.displayName);
  const cleanName = sanitizeUserDisplayName(displayName, isGuest);
  const returnTo = `${location.pathname}${location.search}`;

  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [syncDays, setSyncDays] = useState<number | undefined>(undefined);
  const [actionBusyKey, setActionBusyKey] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    tone: 'error' | 'info';
    text: string;
  } | null>(null);
  const [pickerTarget, setPickerTarget] = useState<{
    intent: 'add' | 'swap';
    slotId: string;
    date: string;
    mealType: 'breakfast' | 'lunch' | 'dinner';
    servings: number;
    role: MealRole;
    componentId?: string;
    replacingTitle?: string;
  } | null>(null);

  useVNextSeo({
    title: 'Thực đơn tuần — Takolio',
    description: 'Cân bằng dinh dưỡng cho cả gia đình và tự động tạo danh sách mua sắm thông minh.',
    canonicalPath: '/planner',
    domainSurface: 'app',
    noindex: true,
  });

  const model = usePlanner(planId, !isGuest);
  const plan = model.plan;
  const compositionsQuery = usePlanCompositions(plan ?? undefined, !isGuest && Boolean(plan));
  const v2Active =
    isMealCompositionEnabled() && !compositionUnavailable(compositionsQuery.error);

  const effectiveCompositions = useMemo(() => {
    if (!plan || !v2Active) return null;
    if (
      compositionsQuery.data &&
      compositionsQuery.data.planRevision === plan.revision
    ) {
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

  const unifiedSlots = useMemo<UnifiedSlotView[]>(() => {
    if (!plan) return [];
    const v1BySlot = new Map<string, PlannedMealDto>(
      plan.result.meals.map((m) => [m.slotId, m]),
    );
    const v2BySlot = new Map<string, MealCompositionDto>(
      (effectiveCompositions?.compositions ?? []).map((c) => [c.slotId, c]),
    );
    const unplannedSet = new Set<string>(
      plan.result.unplannedSlots.map((u) => u.slotId),
    );

    const slotOrder: Array<{
      slotId: string;
      date: string;
      mealType: 'breakfast' | 'lunch' | 'dinner';
      servings: number;
    }> = [];
    const seen = new Set<string>();

    for (const intentSlot of plan.intent.slots) {
      const slotId = `${intentSlot.date}:${intentSlot.mealType}:${intentSlot.sequence ?? 0}`;
      if (!seen.has(slotId)) {
        seen.add(slotId);
        slotOrder.push({
          slotId,
          date: intentSlot.date,
          mealType: intentSlot.mealType,
          servings: intentSlot.servings ?? plan.intent.defaultServings,
        });
      }
    }
    for (const v1Meal of plan.result.meals) {
      if (!seen.has(v1Meal.slotId)) {
        seen.add(v1Meal.slotId);
        slotOrder.push({
          slotId: v1Meal.slotId,
          date: v1Meal.date,
          mealType: v1Meal.mealType,
          servings: v1Meal.servings,
        });
      }
    }

    slotOrder.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        MEAL_SORT_ORDER[a.mealType] - MEAL_SORT_ORDER[b.mealType] ||
        a.slotId.localeCompare(b.slotId),
    );

    return slotOrder.map((meta) => {
      const v2 = v2BySlot.get(meta.slotId);
      const v1 = v1BySlot.get(meta.slotId);

      if (v2 && v2.components.length > 0) {
        const sortedComponents = [...v2.components].sort((a, b) => a.ordinal - b.ordinal);
        const lead =
          sortedComponents.find((c) => c.role === 'main') ?? sortedComponents[0]!;
        const dishTitles = sortedComponents.map((c) => c.title);
        const assessedMissing = sortedComponents.reduce(
          (sum, comp) => sum + componentMissingCount(comp),
          0,
        );
        const fallbackMissing = v1
          ? v1.requirements.filter((r) => !r.optional && r.status !== 'satisfied').length
          : 0;
        const maxComponentCook = sortedComponents.reduce(
          (max, comp) => Math.max(max, comp.cookTimeMinutes ?? 0),
          0,
        );
        const v1Minutes = v1
          ? (v1.prepTimeMinutes ?? 0) + (v1.cookTimeMinutes ?? 0)
          : 0;
        const totalMinutes =
          maxComponentCook > 0 ? maxComponentCook : v1Minutes > 0 ? v1Minutes : null;

        return {
          slotId: meta.slotId,
          date: meta.date,
          mealType: meta.mealType,
          servings: meta.servings,
          title: dishTitles.join(' · '),
          dishTitles,
          components: sortedComponents,
          missingRoles: v2.missingRoles,
          leadRecipeId: lead.recipeId ?? null,
          leadSlug: resolveCanonicalDishSlug(lead.recipeId, null, lead.title),
          cookMinutes: totalMinutes,
          missingCount:
            compHasAssessment(sortedComponents) ||
            sortedComponents.some((c) => c.projection !== null)
              ? assessedMissing
              : fallbackMissing,
          isEmptyManual: false,
          isUnplanned: false,
        };
      }

      if (v1) {
        const leadRecipeId = v1.source.kind === 'recipe' ? v1.source.id : null;
        const v1Minutes = (v1.prepTimeMinutes ?? 0) + (v1.cookTimeMinutes ?? 0);
        return {
          slotId: meta.slotId,
          date: meta.date,
          mealType: meta.mealType,
          servings: v1.servings,
          title: v1.title,
          dishTitles: [v1.title],
          components: [],
          missingRoles: [],
          leadRecipeId,
          leadSlug: resolveCanonicalDishSlug(leadRecipeId, null, v1.title),
          cookMinutes: v1Minutes > 0 ? v1Minutes : null,
          missingCount: v1.requirements.filter((r) => !r.optional && r.status !== 'satisfied')
            .length,
          isEmptyManual: false,
          isUnplanned: false,
        };
      }

      const isUnplanned = unplannedSet.has(meta.slotId);
      return {
        slotId: meta.slotId,
        date: meta.date,
        mealType: meta.mealType,
        servings: meta.servings,
        title: isUnplanned ? 'Chưa tìm được món phù hợp' : 'Chưa có món — thêm món vào bữa',
        dishTitles: [],
        components: [],
        missingRoles: v2?.missingRoles ?? ['main', 'soup', 'vegetable', 'staple'],
        leadRecipeId: null,
        leadSlug: '',
        cookMinutes: null,
        missingCount: 0,
        isEmptyManual: !isUnplanned,
        isUnplanned,
      };
    });
  }, [plan, effectiveCompositions]);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, UnifiedSlotView[]>();
    for (const slot of unifiedSlots) {
      const list = map.get(slot.date) ?? [];
      list.push(slot);
      map.set(slot.date, list);
    }
    return map;
  }, [unifiedSlots]);

  const orderedDates = useMemo(() => Array.from(slotsByDate.keys()).sort(), [slotsByDate]);

  useEffect(() => {
    if (orderedDates.length === 0) {
      setSelectedDateKey(null);
      return;
    }
    if (!selectedDateKey || !orderedDates.includes(selectedDateKey)) {
      const todayKey = new Date().toISOString().slice(0, 10);
      setSelectedDateKey(orderedDates.includes(todayKey) ? todayKey : orderedDates[0]!);
    }
  }, [orderedDates, selectedDateKey]);

  const activeDateKey =
    selectedDateKey && orderedDates.includes(selectedDateKey)
      ? selectedDateKey
      : orderedDates[0] ?? null;
  const activeDaySlots = activeDateKey ? slotsByDate.get(activeDateKey) ?? [] : [];
  const plannedMealSlotsCount = unifiedSlots.filter((s) => s.dishTitles.length > 0).length;
  const compositionsLoading = v2Active && compositionsQuery.isPending && !effectiveCompositions;
  const hasLockedComponents = useMemo(
    () =>
      (effectiveCompositions?.compositions ?? []).some((slot) =>
        slot.components.some((c) => c.locked),
      ),
    [effectiveCompositions],
  );
  const isManualEmptyDraft = useMemo(() => {
    if (!plan || plannedMealSlotsCount > 0) return false;
    const comps = effectiveCompositions?.compositions ?? [];
    if (
      comps.length > 0 &&
      comps.every(
        (c) => c.mode === 'manual' || c.warnings.includes('MANUAL_SELECTION_PENDING'),
      )
    ) {
      return true;
    }
    return (
      plan.result.unplannedSlots.length > 0 &&
      plan.result.unplannedSlots.every((u) => u.reasons.includes('MANUAL_SELECTION_PENDING'))
    );
  }, [plan, plannedMealSlotsCount, effectiveCompositions]);
  const showInfeasibleRecovery = Boolean(
    plan &&
      !compositionsLoading &&
      !isManualEmptyDraft &&
      (plan.result.status === 'infeasible' ||
        (plannedMealSlotsCount === 0 && plan.result.unplannedSlots.length > 0)),
  );

  const missingShoppingCount = useMemo(() => {
    if (!plan) return 0;
    const missingIngredients = new Set<string>();
    if (effectiveCompositions) {
      for (const slot of effectiveCompositions.compositions) {
        for (const comp of slot.components) {
          for (const req of comp.assessment?.requirements ?? []) {
            if (!req.isOptional && req.status !== 'satisfied') {
              missingIngredients.add(req.ingredientId);
            }
          }
        }
      }
    }
    if (missingIngredients.size === 0) {
      for (const meal of plan.result.meals) {
        for (const req of meal.requirements) {
          if (!req.optional && req.status !== 'satisfied') {
            missingIngredients.add(req.ingredientId);
          }
        }
      }
    }
    return missingIngredients.size;
  }, [plan, effectiveCompositions]);

  const { locale: appLocale, copy: appCopy } = useAppLocale();
  const plannerLocale: 'vi' | 'en' = appLocale === 'vi' ? 'vi' : 'en';

  const handlePickerChoose = async (item: PickerItemDto, chosenRole: MealRole) => {
    if (!plan || !pickerTarget || actionBusyKey) return;
    setActionFeedback(null);
    setActionBusyKey(`picker:${pickerTarget.slotId}`);

    const target =
      item.kind === 'recipe'
        ? ({ kind: 'recipe', recipeId: item.id } as const)
        : ({ kind: 'simple_food', simpleFoodId: item.id } as const);

    try {
      const dto =
        pickerTarget.intent === 'swap' && pickerTarget.componentId
          ? await mealCompositionApi.swap(
              plan.id,
              pickerTarget.slotId,
              pickerTarget.componentId,
              {
                revision: plan.revision,
                target,
                role: chosenRole,
                locked: true,
              },
            )
          : await mealCompositionApi.add(plan.id, pickerTarget.slotId, {
              revision: plan.revision,
              target,
              role: chosenRole,
              locked: true,
            });

      acceptSlotCompositionMutation(queryClient, plan, effectiveCompositions, dto);
      setPickerTarget(null);
    } catch (failure) {
      setActionFeedback({
        tone: 'error',
        text: plannerErrorMessage(failure, 'vi'),
      });
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleRemoveComponent = async (slotId: string, componentId: string) => {
    if (!plan || actionBusyKey) return;
    setActionFeedback(null);
    setActionBusyKey(`rm:${componentId}`);
    try {
      const dto = await mealCompositionApi.remove(plan.id, slotId, componentId, plan.revision);
      acceptSlotCompositionMutation(queryClient, plan, effectiveCompositions, dto);
    } catch (failure) {
      setActionFeedback({
        tone: 'error',
        text: plannerErrorMessage(failure, 'vi'),
      });
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleRefreshMealSlot = async (slot: UnifiedSlotView) => {
    if (!plan || actionBusyKey) return;
    setActionFeedback(null);
    setActionBusyKey(`refresh:${slot.slotId}`);
    try {
      const action = slot.components.length === 0 ? 'complete' : 'regenerate_unlocked';
      const proposalRes = await mealCompositionApi.assist(plan.id, slot.slotId, {
        revision: plan.revision,
        action,
        variant: 0,
      });
      if (!proposalRes.proposal) {
        setActionFeedback({
          tone: 'info',
          text: 'Chưa tìm thấy phương án khác phù hợp hơn cho bữa này.',
        });
        return;
      }
      const applied = await mealCompositionApi.assistApply(plan.id, slot.slotId, {
        revision: plan.revision,
        action,
        variant: 0,
        proposalId: proposalRes.proposal.optionId,
      });
      acceptSlotCompositionMutation(queryClient, plan, effectiveCompositions, applied);
    } catch (failure) {
      setActionFeedback({
        tone: 'error',
        text: plannerErrorMessage(failure, 'vi'),
      });
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleAutoSuggestWeek = async () => {
    if (!plan || actionBusyKey) return;
    setActionFeedback(null);
    setActionBusyKey('auto-suggest-week');
    try {
      // Heal any legacy unverified allergens before regenerating so SAFETY_UNKNOWN cannot trap suggestions.
      if (v2Active) {
        try {
          const currentPref = await familyPreferencesApi.get();
          const { sanitized, migratedAllergens } = sanitizeFamilyPreferencesForGeneration(
            currentPref.preferences,
          );
          if (migratedAllergens.length > 0) {
            const saved = await familyPreferencesApi.save(currentPref.revision, sanitized);
            queryClient.setQueryData(familyPreferencesKey(), saved);
          }
        } catch {
          // Proceed with regeneration even if preferences endpoint is unavailable.
        }
      }

      const recoveryIntent = buildRecoveryIntentForPlan(plan, hasLockedComponents);
      const updated = await model.regenerate(plan.id, plan.revision, recoveryIntent);
      model.replacePlan(updated);
      await queryClient.invalidateQueries({
        queryKey: ['meal-planning', 'plan', updated.id],
      });
      showTkvToast({
        message: 'Đã tự động gợi ý mâm cơm cho lịch tuần',
        tone: 'success',
      });
    } catch (failure) {
      setActionFeedback({
        tone: 'error',
        text: plannerErrorMessage(failure, 'vi'),
      });
    } finally {
      setActionBusyKey(null);
    }
  };

  const handleQuickSyncShopping = async () => {
    if (!plan || actionBusyKey) return;
    setActionFeedback(null);
    setActionBusyKey('sync-shopping');
    try {
      await syncPlanToShoppingList(queryClient, plan, { days: syncDays });
      showTkvToast({
        message: 'Đã đồng bộ nguyên liệu sang danh sách đi chợ',
        tone: 'success',
      });
      navigate('/shopping');
    } catch (failure) {
      setActionFeedback({
        tone: 'error',
        text: plannerErrorMessage(failure, 'vi'),
      });
    } finally {
      setActionBusyKey(null);
    }
  };

  return (
    <ConsumerStudioShell screenId="C23" title={appCopy.planner.title}>
      <div className="flex flex-col gap-3.5 sm:gap-4">
        {/* Compact Top Heading */}
        <div className="flex flex-wrap items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <BrandFeatureIcon name="planner" size={40} className="shrink-0" />
            <div className="min-w-0">
              <h1 className="tkv-heading text-xl sm:text-2xl font-extrabold text-[var(--tkv-ink)] leading-tight">
                {appCopy.planner.title}
              </h1>
              <p className="text-xs font-semibold text-[var(--tkv-ink-secondary)] leading-snug">
                {plan
                  ? `${plannedMealSlotsCount}/${unifiedSlots.length} bữa đã có món · ${plannerStatusLabel(plan.result.status, plannerLocale)}`
                  : isGuest
                    ? appCopy.planner.subtitleDefault
                    : `Bếp của ${cleanName}`}
              </p>
            </div>
          </div>

          {!isGuest && (
            <TkvButton
              variant="primary"
              size="sm"
              iconLeft="plus"
              onClick={() => navigate('/planner/new')}
              className="shrink-0"
            >
              Tạo thực đơn mới
            </TkvButton>
          )}
        </div>

        {/* Guest Gate vs Loading vs Error vs Empty vs Active Workbench */}
        {isGuest ? (
          <TkvSurface className="p-4 sm:p-6 space-y-5 bg-[var(--tkv-surface)]">
            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-3.5 sm:gap-4">
              <MascotIllustration
                pose="shopping"
                size={88}
                className="w-20 h-20 shrink-0"
              />
              <div className="space-y-1.5 min-w-0 flex-1">
                <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink)]">
                  Đăng nhập để tạo và lưu thực đơn tuần
                </h2>
                <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">
                  Đối chiếu nguyên liệu sẵn có trong tủ lạnh và gom gọn danh sách đi chợ cho cả nhà.
                </p>
              </div>
            </div>

            <Link
              data-testid="planner-login-cta"
              to={`/auth?mode=login&returnTo=${encodeURIComponent(returnTo)}`}
              className="tkv-focusable w-full min-h-[48px] px-5 py-3 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white shadow-[var(--tkv-shadow-cta)] font-extrabold text-sm inline-flex items-center justify-center gap-2 transition-colors"
            >
              <span>Đăng nhập để lập thực đơn</span>
              <VNextIcon name="chevron-right" size={16} className="shrink-0" />
            </Link>
          </TkvSurface>
        ) : model.query.isPending ? (
          <WeeklyPlannerSkeleton />
        ) : model.query.isError ? (
          <TkvErrorState
            title="Chưa tải được thực đơn tuần"
            message="Không thể đọc dữ liệu kế hoạch bữa ăn từ máy chủ. Vui lòng thử lại."
            onRetry={() => void model.query.refetch()}
          />
        ) : !plan ? (
          <TkvEmptyState
            pose="shopping"
            eyebrow="Sẵn sàng lập lịch"
            title="Bắt đầu thực đơn tuần đầu tiên"
            description="Chọn số ngày, các bữa nấu và khẩu phần — hệ thống phối sẵn mâm cơm gia đình và tính phần cần mua thêm."
            primaryAction={
              <TkvButton onClick={() => navigate('/planner/new')} iconRight="arrow-right">
                + Tạo thực đơn mới
              </TkvButton>
            }
            secondaryAction={
              <TkvButton
                variant="secondary"
                iconLeft="shopping"
                onClick={() => navigate('/shopping')}
              >
                Giỏ đi chợ
              </TkvButton>
            }
          />
        ) : (
          <div className="flex flex-col gap-3.5">
            {/* Manual Empty Draft Guidance (Calm, Non-Error) */}
            {isManualEmptyDraft && !compositionsLoading && (
              <div
                role="status"
                data-testid="c23-manual-draft-banner"
                className="rounded-2xl bg-[var(--tkv-surface-mint)]/60 border border-[var(--tkv-border-mint)] p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-extrabold text-[var(--tkv-ink)]">
                    Khung thực đơn đang chờ xếp món
                  </p>
                  <p className="text-xs text-[var(--tkv-ink-secondary)]">
                    Bạn có thể bấm gợi ý tự động cả tuần hoặc thêm từng món vào bữa bên dưới.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <TkvButton
                    variant="primary"
                    size="sm"
                    iconLeft="sparkles"
                    data-testid="c23-auto-suggest-recover-btn"
                    disabled={Boolean(actionBusyKey)}
                    onClick={() => void handleAutoSuggestWeek()}
                  >
                    {actionBusyKey === 'auto-suggest-week'
                      ? 'Đang gợi ý…'
                      : 'Tự động gợi ý cả tuần'}
                  </TkvButton>
                </div>
              </div>
            )}

            {/* Infeasible / Partial Plan Recovery Banner (Guarded against loading flashes & manual drafts) */}
            {showInfeasibleRecovery && (
              <div
                role="status"
                data-testid="c23-infeasible-banner"
                className="rounded-2xl bg-[var(--tkv-surface)] border border-[var(--tkv-border-coral)] p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-extrabold text-[var(--tkv-coral-ink)]">
                    Chưa tìm đủ món khớp điều kiện hiện tại
                  </p>
                  <p className="text-xs text-[var(--tkv-ink-secondary)]">
                    {plan.intent.mode === 'cook_now'
                      ? 'Chế độ chỉ dùng đồ sẵn có cần đủ nguyên liệu trong tủ lạnh. Bấm gợi ý tự động để phối mâm cơm kèm phần cần mua thêm.'
                      : 'Điều kiện lọc trước đó có thể quá chặt hoặc dữ liệu vừa cập nhật. Bấm gợi ý lại để hệ thống tự phối thực đơn mới.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <TkvButton
                    variant="primary"
                    size="sm"
                    iconLeft="sparkles"
                    data-testid="c23-auto-suggest-recover-btn"
                    disabled={Boolean(actionBusyKey)}
                    onClick={() => void handleAutoSuggestWeek()}
                  >
                    {actionBusyKey === 'auto-suggest-week'
                      ? 'Đang gợi ý…'
                      : plan.intent.mode === 'cook_now'
                        ? 'Gợi ý kèm đi chợ'
                        : 'Tự động gợi ý lại'}
                  </TkvButton>
                  <TkvButton variant="secondary" size="sm" onClick={() => navigate('/planner/new')}>
                    Thiết lập lại
                  </TkvButton>
                </div>
              </div>
            )}

            {/* Calm Planner ↔ Shopping Bridge Bar */}
            <div className="rounded-2xl bg-[var(--tkv-surface)] border border-[var(--tkv-border)] p-3.5 sm:p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] text-[var(--tkv-primary)] flex items-center justify-center shrink-0">
                    <VNextIcon name="shopping" size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs sm:text-sm font-extrabold text-[var(--tkv-ink)] tabular-nums">
                      {missingShoppingCount > 0
                        ? `Thiếu ${missingShoppingCount} nguyên liệu cho lịch tuần`
                        : 'Đồng bộ nguyên liệu sang giỏ đi chợ'}
                    </p>
                    <p className="text-[11px] font-semibold text-[var(--tkv-ink-secondary)]">
                      Tự trừ phần có sẵn trong tủ lạnh và gom gọn theo quầy chợ
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <Link
                    to={`/planner/${plan.id}/shopping`}
                    className="tkv-focusable min-h-[36px] px-3 rounded-full bg-[var(--tkv-bg)] border border-[var(--tkv-border)] hover:border-[var(--tkv-primary)] text-xs font-bold text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-primary)] inline-flex items-center transition-colors"
                  >
                    Xem chi tiết
                  </Link>
                  <button
                    type="button"
                    data-testid="c23-sync-shopping-btn"
                    disabled={Boolean(actionBusyKey) || plannedMealSlotsCount === 0}
                    onClick={() => void handleQuickSyncShopping()}
                    className="tkv-focusable min-h-[38px] px-4 py-1.5 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shadow-[var(--tkv-shadow-cta)] transition-colors shrink-0"
                  >
                    <span>
                      {actionBusyKey === 'sync-shopping'
                        ? 'Đang đồng bộ…'
                        : 'Đồng bộ Giỏ đi chợ'}
                    </span>
                    <VNextIcon name="arrow-right" size={14} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap pt-2.5 border-t border-[var(--tkv-border)]/70">
                <div className="flex items-center gap-1.5" role="group" aria-label="Khoảng ngày đi chợ">
                  <span className="text-[11px] font-bold text-[var(--tkv-ink-muted)] mr-1">
                    Nhịp đi chợ:
                  </span>
                  {(
                    [
                      [1, 'Hôm nay'],
                      [3, '3 ngày'],
                      [undefined, 'Cả tuần'],
                    ] as const
                  ).map(([daysVal, label]) => {
                    const active = syncDays === daysVal;
                    return (
                      <button
                        key={label}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSyncDays(daysVal)}
                        className={clsx(
                          'tkv-focusable min-h-[28px] px-2.5 rounded-full text-[11px] font-bold border transition-colors',
                          active
                            ? 'bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] border-[var(--tkv-primary)]'
                            : 'bg-[var(--tkv-bg)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)] hover:border-[var(--tkv-border-mint)]',
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <Link
                  to="/shopping"
                  className="text-[11px] font-bold text-[var(--tkv-primary)] hover:underline inline-flex items-center gap-1"
                >
                  <span>Mở giỏ đi chợ</span>
                  <VNextIcon name="chevron-right" size={12} />
                </Link>
              </div>
            </div>

            {actionFeedback && (
              <div
                role={actionFeedback.tone === 'error' ? 'alert' : 'status'}
                className={clsx(
                  'rounded-2xl px-3.5 py-2.5 text-xs font-semibold flex items-center justify-between gap-2 border',
                  actionFeedback.tone === 'error'
                    ? 'bg-[var(--tkv-surface-coral)] border-[var(--tkv-border-coral)] text-[var(--tkv-coral-ink)]'
                    : 'bg-[var(--tkv-surface-mint)] border-[var(--tkv-border-mint)] text-[var(--tkv-primary)]',
                )}
              >
                <span>{actionFeedback.text}</span>
                <button
                  type="button"
                  onClick={() => setActionFeedback(null)}
                  className="font-extrabold px-2"
                >
                  Đóng
                </button>
              </div>
            )}

            {/* Calendar-Accurate Day Pill Selector */}
            {orderedDates.length > 0 && (
              <div
                role="group"
                aria-label="Chọn ngày trong kế hoạch"
                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5"
              >
                {orderedDates.map((dateIso) => {
                  const active = dateIso === activeDateKey;
                  const parts = formatDayPillParts(dateIso, plannerLocale);
                  return (
                    <button
                      key={dateIso}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedDateKey(dateIso)}
                      className={clsx(
                        'tkv-focusable min-w-[64px] px-2.5 py-1.5 min-h-[44px] rounded-2xl text-xs font-extrabold flex flex-col items-center justify-center transition-colors border shrink-0 tabular-nums',
                        active
                          ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] shadow-[var(--tkv-shadow-cta)]'
                          : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)] hover:bg-[var(--tkv-surface-mint)] hover:text-[var(--tkv-primary)]',
                      )}
                    >
                      <span>{parts.weekday}</span>
                      <span
                        className={clsx(
                          'text-[11px] font-semibold',
                          active ? 'text-white/90' : 'text-[var(--tkv-ink-muted)]',
                        )}
                      >
                        {parts.dateShort}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Selected Day Inline Meal Trays (Sáng · Trưa · Tối) */}
            {activeDateKey && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 px-0.5">
                  <h2 className="tkv-heading text-base sm:text-lg font-extrabold text-[var(--tkv-ink)] capitalize">
                    {formatDayHeadingVi(activeDateKey)}
                  </h2>
                  <span className="text-xs font-bold text-[var(--tkv-ink-secondary)] tabular-nums">
                    {activeDaySlots.length} bữa · v{plan.revision}
                  </span>
                </div>

                {activeDaySlots.map((slot) => {
                  const editable = v2Active && isSlotEditableTodayOrFuture(plan, slot.date);
                  const refreshingThisSlot = actionBusyKey === `refresh:${slot.slotId}`;
                  const mealDetailHref = `/planner/${plan.id}/meal/${encodeURIComponent(slot.slotId)}`;

                  return (
                    <TkvSurface
                      key={slot.slotId}
                      data-testid={`c23-meal-tray-${slot.mealType}`}
                      className="p-3.5 sm:p-4 space-y-2.5 bg-[var(--tkv-surface)] border-[var(--tkv-border)]"
                    >
                      {/* Meal Tray Header */}
                      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-[var(--tkv-border)] pb-2">
                        <div className="flex items-center gap-2 min-w-0 tabular-nums">
                          <span className="px-2.5 py-0.5 rounded-full bg-[var(--tkv-surface-mint)] text-xs font-extrabold text-[var(--tkv-primary)]">
                            {MEAL_LABELS[slot.mealType]}
                          </span>
                          <span className="text-xs font-bold text-[var(--tkv-ink-secondary)]">
                            {slot.servings} người
                            {slot.cookMinutes ? ` · ~${slot.cookMinutes}p` : ''}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {editable && (
                            <button
                              type="button"
                              disabled={Boolean(actionBusyKey)}
                              onClick={() => void handleRefreshMealSlot(slot)}
                              className="tkv-focusable min-h-[32px] px-2.5 py-1 rounded-full bg-[var(--tkv-bg)] border border-[var(--tkv-border)] hover:border-[var(--tkv-border-mint)] text-[11px] font-extrabold text-[var(--tkv-ink)] inline-flex items-center gap-1 transition-colors"
                            >
                              <VNextIcon name="refresh" size={12} />
                              <span>{refreshingThisSlot ? 'Đang đổi…' : 'Đổi gợi ý'}</span>
                            </button>
                          )}
                          <Link
                            to={mealDetailHref}
                            className="tkv-focusable min-h-[32px] px-2.5 py-1 rounded-full bg-[var(--tkv-surface-mint)] text-[11px] font-extrabold text-[var(--tkv-primary)] inline-flex items-center gap-1"
                          >
                            <span>Cách nấu</span>
                            <VNextIcon name="chevron-right" size={12} />
                          </Link>
                        </div>
                      </div>

                      {/* Composed V2 Dish Rows */}
                      {slot.components.length > 0 ? (
                        <ul className="divide-y divide-[var(--tkv-border)]/60">
                          {slot.components.map((comp) => {
                            const compMissing = componentMissingCount(comp);
                            const recipeHref =
                              comp.kind === 'recipe' && comp.recipeId && comp.cookable
                                ? `/recipes/id/${encodeURIComponent(comp.recipeId)}?servings=${slot.servings}&returnTo=${encodeURIComponent(returnTo)}${comp.contentFingerprint ? `&version=${comp.contentFingerprint}` : ''}`
                                : mealDetailHref;

                            return (
                              <li
                                key={comp.id}
                                className="py-2 first:pt-0.5 last:pb-0.5 flex items-center justify-between gap-2.5"
                              >
                                <Link
                                  to={recipeHref}
                                  className="tkv-focusable flex items-center gap-2.5 min-w-0 flex-1 group rounded-xl"
                                >
                                  <VerifiedDishImage
                                    recipeId={comp.recipeId}
                                    title={comp.title}
                                    aspectClass="aspect-square"
                                    compact
                                    className="w-12 h-12 rounded-xl shrink-0 border border-[var(--tkv-border)]"
                                  />
                                  <div className="min-w-0">
                                    <p className="text-sm font-extrabold text-[var(--tkv-ink)] group-hover:text-[var(--tkv-primary)] leading-snug line-clamp-1 transition-colors">
                                      {comp.title}
                                    </p>
                                    <p className="text-[11px] font-semibold text-[var(--tkv-ink-secondary)] mt-0.5 flex items-center gap-1.5 flex-wrap tabular-nums">
                                      <span className="text-[var(--tkv-primary)] font-bold">
                                        {roleLabel(comp.role, 'vi')}
                                      </span>
                                      {comp.cookTimeMinutes !== null && (
                                        <>
                                          <span>·</span>
                                          <span>{comp.cookTimeMinutes}p</span>
                                        </>
                                      )}
                                      <span>·</span>
                                      <span
                                        className={
                                          compMissing > 0
                                            ? 'text-[var(--tkv-coral-ink)]'
                                            : 'text-[var(--tkv-ink-muted)]'
                                        }
                                      >
                                        {compMissing === 0 ? 'Đủ đồ' : `Mua ${compMissing}`}
                                      </span>
                                    </p>
                                  </div>
                                </Link>

                                {editable && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      data-testid="c23-swap-dish-btn"
                                      disabled={Boolean(actionBusyKey)}
                                      aria-label={`Đổi món ${comp.title}`}
                                      onClick={() =>
                                        setPickerTarget({
                                          intent: 'swap',
                                          slotId: slot.slotId,
                                          date: slot.date,
                                          mealType: slot.mealType,
                                          servings: slot.servings,
                                          role: comp.role,
                                          componentId: comp.id,
                                          replacingTitle: comp.title,
                                        })
                                      }
                                      className="tkv-focusable h-8 px-2.5 rounded-lg bg-[var(--tkv-bg)] border border-[var(--tkv-border)] hover:border-[var(--tkv-primary)] text-[11px] font-extrabold text-[var(--tkv-ink)] inline-flex items-center gap-1"
                                    >
                                      <VNextIcon name="swap" size={12} />
                                      <span>Đổi</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={Boolean(actionBusyKey)}
                                      aria-label={`Bỏ món ${comp.title}`}
                                      onClick={() => void handleRemoveComponent(slot.slotId, comp.id)}
                                      className="tkv-focusable w-8 h-8 rounded-lg bg-[var(--tkv-bg)] border border-[var(--tkv-border)] hover:border-[var(--tkv-border-coral)] text-[var(--tkv-ink-muted)] hover:text-[var(--tkv-coral)] flex items-center justify-center"
                                    >
                                      <VNextIcon name="trash" size={13} />
                                    </button>
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : slot.dishTitles.length > 0 ? (
                        /* V1 Legacy Fallback Single-Dish Row */
                        <Link
                          to={mealDetailHref}
                          className="tkv-focusable flex items-center justify-between gap-3 py-1"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <VerifiedDishImage
                              slug={slot.leadSlug || undefined}
                              recipeId={slot.leadRecipeId}
                              title={slot.title}
                              aspectClass="aspect-square"
                              compact
                              className="w-12 h-12 rounded-xl shrink-0 border border-[var(--tkv-border)]"
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-extrabold text-[var(--tkv-ink)] line-clamp-2">
                                {slot.title}
                              </p>
                              <p className="text-xs text-[var(--tkv-ink-secondary)] mt-0.5 tabular-nums">
                                {slot.missingCount === 0
                                  ? 'Đủ nguyên liệu dự kiến'
                                  : `Cần mua ${slot.missingCount} nguyên liệu`}
                              </p>
                            </div>
                          </div>
                          <VNextIcon name="chevron-right" size={16} className="text-[var(--tkv-ink-muted)] shrink-0" />
                        </Link>
                      ) : (
                        /* Empty Manual / Unplanned Slot */
                        <div className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <p className="text-xs text-[var(--tkv-ink-secondary)]">
                            {slot.isUnplanned
                              ? 'Chưa có gợi ý tự động cho bữa này — bấm gợi ý nhanh hoặc tự chọn món.'
                              : 'Bữa trống — gợi ý nhanh một mâm cơm hoặc tự thêm món yêu thích.'}
                          </p>
                          {editable && (
                            <button
                              type="button"
                              data-testid={`c23-suggest-slot-${slot.mealType}`}
                              disabled={Boolean(actionBusyKey)}
                              onClick={() => void handleRefreshMealSlot(slot)}
                              className="tkv-focusable self-start sm:self-auto min-h-[34px] px-3 rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] text-xs font-extrabold text-[var(--tkv-primary)] inline-flex items-center gap-1.5 shrink-0"
                            >
                              <VNextIcon name="sparkles" size={13} />
                              <span>{refreshingThisSlot ? 'Đang gợi ý…' : 'Gợi ý tự động bữa này'}</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Add Dish Footer */}
                      {editable && slot.components.length < 8 && (
                        <div className="pt-1">
                          <button
                            type="button"
                            data-testid={`c23-add-dish-${slot.mealType}`}
                            disabled={Boolean(actionBusyKey)}
                            onClick={() =>
                              setPickerTarget({
                                intent: 'add',
                                slotId: slot.slotId,
                                date: slot.date,
                                mealType: slot.mealType,
                                servings: slot.servings,
                                role: slot.missingRoles[0] ?? 'side',
                              })
                            }
                            className="tkv-focusable w-full min-h-[36px] rounded-xl border border-dashed border-[var(--tkv-border-mint)] bg-[var(--tkv-bg)] hover:bg-[var(--tkv-surface-mint)] text-xs font-extrabold text-[var(--tkv-primary)] inline-flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <VNextIcon name="plus" size={14} />
                            <span>Thêm món vào {MEAL_LABELS[slot.mealType].toLowerCase()}</span>
                          </button>
                        </div>
                      )}
                    </TkvSurface>
                  );
                })}
              </div>
            )}

            {/* Collapsible Week-at-a-Glance Summary */}
            <details className="rounded-2xl bg-[var(--tkv-surface)] border border-[var(--tkv-border)] p-3.5 sm:p-4">
              <summary className="cursor-pointer list-none flex items-center justify-between gap-2">
                <span
                  id="c23-schedule-heading"
                  className="tkv-heading text-sm sm:text-base font-extrabold text-[var(--tkv-ink)] tabular-nums"
                >
                  Toàn bộ lịch tuần ({plannedMealSlotsCount}/{unifiedSlots.length} bữa đã có món)
                </span>
                <span className="text-xs font-bold text-[var(--tkv-primary)]">
                  Xem nhanh 7 ngày
                </span>
              </summary>

              <div className="mt-3 pt-3 border-t border-[var(--tkv-border)] grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {orderedDates.map((dateKey) => {
                  const dayMeals = slotsByDate.get(dateKey) ?? [];
                  return (
                    <div
                      key={dateKey}
                      className="rounded-xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDateKey(dateKey);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="tkv-heading text-sm font-extrabold text-[var(--tkv-ink)] hover:text-[var(--tkv-primary)] capitalize text-left"
                        >
                          {formatDayHeadingVi(dateKey)}
                        </button>
                        <span className="text-[11px] font-bold text-[var(--tkv-primary)] tabular-nums">
                          {dayMeals.length} bữa
                        </span>
                      </div>
                      <ul className="space-y-1.5">
                        {dayMeals.map((s) => (
                          <li key={s.slotId} className="text-xs">
                            <Link
                              to={`/planner/${plan.id}/meal/${encodeURIComponent(s.slotId)}`}
                              className="hover:underline text-[var(--tkv-ink)] font-semibold line-clamp-1"
                            >
                              <span className="text-[var(--tkv-ink-muted)]">
                                {MEAL_LABELS[s.mealType]}:{' '}
                              </span>
                              {s.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Inline Dish Picker Sheet (Zero page jump!) */}
      {plan && pickerTarget && (
        <VNextDishPickerSheet
          open={Boolean(pickerTarget)}
          intent={pickerTarget.intent}
          initialRole={pickerTarget.role}
          replacingTitle={pickerTarget.replacingTitle}
          scope={{
            planId: plan.id,
            slotId: pickerTarget.slotId,
            revision: plan.revision,
            date: pickerTarget.date,
            mealType: pickerTarget.mealType,
            servings: pickerTarget.servings,
            excludeComponentId: pickerTarget.componentId,
            noBuy: plan.intent.mode === 'cook_now',
          }}
          busy={Boolean(actionBusyKey)}
          mutationError={
            actionFeedback?.tone === 'error' ? new Error(actionFeedback.text) : undefined
          }
          onChoose={(item, chosenRole) => void handlePickerChoose(item, chosenRole)}
          onClose={() => setPickerTarget(null)}
          onReloadPlan={() => void model.query.refetch()}
        />
      )}
    </ConsumerStudioShell>
  );
};
