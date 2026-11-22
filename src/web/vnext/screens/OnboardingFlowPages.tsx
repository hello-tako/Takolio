import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import '../styles/tokens.css';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../services/api';
import { ApiError, guardPrivateSession } from '../../services/http';
import { capturePrivateSession, isOfflineGuestSession } from '../../lib/private-session';
import {
  DEFAULT_FAMILY_PREFERENCES,
  familyPreferencesApi,
  type FamilyPreferences,
} from '../../services/family-preferences';
import { familyPreferencesKey, useFamilyPreferences } from '../../features/family/useFamilyPreferences';
import { isMealPlannerEnabled } from '../../features/planner/feature';
import { vnextHref } from '../feature';
import { useVNextSeo } from '../lib/seo';
import { prefetchDestination, prefetchRouteChunk } from '../lib/prefetch';
import { BrandLockup, MascotIllustration, VerifiedDishImage, type MascotPose } from '../components/VNextMedia';
import { TkvIconButton, TkvSurface } from '../components/Primitives';
import { VNextIcon, type VNextIconName } from '../components/VNextIcons';
import { TkvConfettiBurst } from '../components/LivingMotion';

const ONBOARDING_GOALS_STORAGE_KEY = 'takolio_onboarding_goals';

export type OnboardingStepKey = 'welcome' | 'goals' | 'household' | 'preferences' | 'start' | 'ready';

function resolveStep(pathname: string): OnboardingStepKey {
  if (pathname.endsWith('/goals')) return 'goals';
  if (pathname.endsWith('/household')) return 'household';
  if (pathname.endsWith('/preferences')) return 'preferences';
  if (pathname.endsWith('/start')) return 'start';
  if (pathname.endsWith('/ready')) return 'ready';
  return 'welcome';
}

const STEP_INDEX: Record<OnboardingStepKey, number> = {
  welcome: 1,
  goals: 2,
  household: 3,
  preferences: 4,
  start: 5,
  ready: 6,
};

const STEP_TITLES: Record<OnboardingStepKey, string> = {
  welcome: 'Chào mừng',
  goals: 'Mục tiêu',
  household: 'Khẩu phần',
  preferences: 'Khẩu vị',
  start: 'Bắt đầu',
  ready: 'Sẵn sàng',
};

const SCREEN_IDS: Record<OnboardingStepKey, string> = {
  welcome: 'O01',
  goals: 'O02',
  household: 'O03',
  preferences: 'O04',
  start: 'O05',
  ready: 'O06',
};

const GOAL_CARDS: Array<{
  id: 'fridge' | 'today' | 'week';
  title: string;
  subtitle: string;
  icon: VNextIconName;
  mascotPose: MascotPose;
}> = [
  {
    id: 'fridge',
    title: 'Quản lý tủ lạnh',
    subtitle: 'Biết còn gì, ưu tiên dùng gì trước',
    icon: 'fridge',
    mascotPose: 'fridge',
  },
  {
    id: 'today',
    title: 'Tìm món nấu ngay',
    subtitle: 'Tận dụng nguyên liệu sẵn có hôm nay',
    icon: 'recipes',
    mascotPose: 'cooking',
  },
  {
    id: 'week',
    title: 'Lên thực đơn tuần',
    subtitle: 'Chủ động từng bữa và danh sách chợ',
    icon: 'calendar',
    mascotPose: 'shopping',
  },
];

/** Canonical cuisine & dietary restriction chips shared 1:1 with FoodPreferencesPage (U02). */
const TASTE_CHIPS = [
  { id: 'vietnamese', kind: 'cuisine', label: 'Món Việt' },
  { id: 'japanese', kind: 'cuisine', label: 'Nhật Bản' },
  { id: 'korean', kind: 'cuisine', label: 'Hàn Quốc' },
  { id: 'thai', kind: 'cuisine', label: 'Thái Lan' },
  { id: 'vegetarian', kind: 'restriction', label: 'Ăn chay linh hoạt' },
  { id: 'more_greens', kind: 'restriction', label: 'Nhiều rau' },
  { id: 'quick_meals', kind: 'restriction', label: 'Nấu nhanh' },
  { id: 'seafood', kind: 'restriction', label: 'Hạn chế hải sản' },
  { id: 'beef', kind: 'restriction', label: 'Hạn chế thịt bò' },
  { id: 'peanuts', kind: 'restriction', label: 'Hạn chế đậu phộng' },
] as const;

type CanonicalSpicyLevel = 'none' | 'mild' | 'medium' | 'hot';

function normalizeSpicyLevel(raw: string | undefined): CanonicalSpicyLevel {
  if (raw === 'none' || raw === 'mild' || raw === 'medium' || raw === 'hot') return raw;
  if (raw === 'spicy') return 'hot';
  return 'medium';
}

const SPICY_CHIPS: Array<{ id: CanonicalSpicyLevel; label: string }> = [
  { id: 'none', label: 'Không cay' },
  { id: 'mild', label: 'Ít cay' },
  { id: 'medium', label: 'Trung bình' },
  { id: 'hot', label: 'Cay đậm' },
];

/** Curated lightweight preview pool backed 1:1 by verified local WebP assets (0 extra bundle bloat). */
const TASTE_PREVIEW_DISHES: ReadonlyArray<{
  slug: string;
  title: string;
  cookTime: number;
  tags: ReadonlyArray<string>;
}> = [
  {
    slug: 'thit-kho-trung',
    title: 'Thịt kho tàu nước dừa trứng',
    cookTime: 40,
    tags: ['vietnamese'],
  },
  {
    slug: 'rau-muong-xao-toi',
    title: 'Rau muống xào tỏi',
    cookTime: 10,
    tags: ['vietnamese', 'vegetarian', 'more_greens', 'quick_meals'],
  },
  {
    slug: 'dau-phu-sot-ca-chua',
    title: 'Đậu phụ sốt cà chua',
    cookTime: 15,
    tags: ['vietnamese', 'vegetarian', 'quick_meals'],
  },
  {
    slug: 'chawanmushi',
    title: 'Trứng hấp Chawanmushi Nhật',
    cookTime: 20,
    tags: ['japanese', 'quick_meals'],
  },
  {
    slug: 'com-chien-trung-toi-hanh-hoa',
    title: 'Cơm chiên trứng tỏi phi',
    cookTime: 12,
    tags: ['vietnamese', 'korean', 'quick_meals'],
  },
  {
    slug: 'goi-ga-xe-phay-bap-cai',
    title: 'Gỏi gà xé phay bắp cải',
    cookTime: 20,
    tags: ['vietnamese', 'thai', 'more_greens'],
  },
  {
    slug: 'ga-ta-kho-gung-sa',
    title: 'Gà ta kho gừng sả',
    cookTime: 30,
    tags: ['vietnamese', 'thai'],
  },
  {
    slug: 'tomato-egg-stir-fry',
    title: 'Trứng xào cà chua mềm ngọt',
    cookTime: 10,
    tags: ['vietnamese', 'japanese', 'korean', 'vegetarian', 'quick_meals'],
  },
];

const STARTER_PATHS: Array<{
  id: 'scan' | 'fridge' | 'recipes';
  title: string;
  subtitle: string;
  badge?: string;
  icon: VNextIconName;
  mascotPose: MascotPose;
  href: string;
}> = [
  {
    id: 'scan',
    title: 'Chụp ảnh tủ lạnh',
    subtitle: 'Lựa chọn an toàn, luôn duyệt kết quả trước khi lưu',
    badge: 'Nhanh nhất · 30 giây',
    icon: 'scan',
    mascotPose: 'scanning',
    href: '/scan',
  },
  {
    id: 'fridge',
    title: 'Thêm nguyên liệu thủ công',
    subtitle: 'Nhập nhanh vài thực phẩm đang có sẵn trong bếp',
    icon: 'plus',
    mascotPose: 'fridge',
    href: '/fridge?action=add',
  },
  {
    id: 'recipes',
    title: 'Khám phá món trước',
    subtitle: 'Xem ngay kho công thức gia đình Việt xác minh',
    icon: 'recipes',
    mascotPose: 'cooking',
    href: '/recipes',
  },
];

function readInitialGoal(storeGoal?: string): 'fridge' | 'today' | 'week' {
  try {
    const saved = localStorage.getItem(ONBOARDING_GOALS_STORAGE_KEY);
    if (saved === 'fridge' || saved === 'today' || saved === 'week') return saved;
  } catch {
    // Ignore storage read errors.
  }
  if (storeGoal === 'week' || storeGoal === 'fridge' || storeGoal === 'today') return storeGoal;
  return 'today';
}

/**
 * Official Takolio Brand Board v2 6-Step Onboarding Flow (`O01–O06`) — Living Kitchen Edition.
 * - Directional slide transitions, reactive Bé Mầm Bếp poses, live mobile + desktop ingredient scaling,
 *   live dish-taste preview strip, and zero-wait O06 background route/query prefetching.
 * - Preserves `1..20` household sizing, `O04 <-> U02` vocabulary, and server-confirmed completion invariants.
 */
export const VNextOnboardingFlow: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const familyQuery = useFamilyPreferences();

  const step = resolveStep(pathname);
  const stepNum = STEP_INDEX[step];
  const screenId = SCREEN_IDS[step];
  const prevStepNumRef = useRef(stepNum);
  const [slideDir, setSlideDir] = useState<'next' | 'prev'>('next');

  useEffect(() => {
    if (stepNum < prevStepNumRef.current) {
      setSlideDir('prev');
    } else {
      setSlideDir('next');
    }
    prevStepNumRef.current = stepNum;
  }, [stepNum]);

  const [family, setFamily] = useState<FamilyPreferences | null>(() =>
    isOfflineGuestSession() ? DEFAULT_FAMILY_PREFERENCES : null,
  );
  const [draftRevision, setDraftRevision] = useState<number | null>(null);
  const [primaryGoal, setPrimaryGoal] = useState<'fridge' | 'today' | 'week'>(() =>
    readInitialGoal(auth.primaryGoal),
  );
  const [householdSize, setHouseholdSize] = useState<number>(() =>
    Number.isInteger(auth.householdSize) && auth.householdSize >= 1 && auth.householdSize <= 20
      ? auth.householdSize
      : 2,
  );
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(() =>
    auth.favoriteCuisines.length > 0 ? auth.favoriteCuisines : ['vietnamese'],
  );
  const [spicyLevel, setSpicyLevel] = useState<CanonicalSpicyLevel>(() =>
    normalizeSpicyLevel(auth.spicyLevel),
  );
  const [restrictions, setRestrictions] = useState<string[]>(() => auth.dietaryRestrictions);
  const [starterChoice, setStarterChoice] = useState<'scan' | 'fridge' | 'recipes'>('scan');
  const [serverConfirmed, setServerConfirmed] = useState<boolean>(() => auth.isOnboarded);
  const editedSizeRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useVNextSeo({
    title: `Thiết lập căn bếp (${stepNum}/6)`,
    description: 'Cá nhân hóa khẩu phần hộ gia đình và sở thích món ăn trên Takolio.',
    canonicalPath: pathname,
    domainSurface: 'app',
    noindex: true,
  });

  useEffect(() => {
    if (familyQuery.data && !family) {
      setFamily(familyQuery.data.preferences);
      setDraftRevision(familyQuery.data.revision);
      if (familyQuery.data.revision > 0 && !editedSizeRef.current) {
        setHouseholdSize(familyQuery.data.preferences.householdSize);
      }
    }
  }, [familyQuery.data, family]);

  // Zero-wait handoff: prefetch target chunks & data in background when user reaches O05 / O06
  useEffect(() => {
    if (step !== 'ready' && step !== 'start') return;
    prefetchRouteChunk('/');
    prefetchRouteChunk('/fridge');
    prefetchRouteChunk('/scan');
    prefetchRouteChunk('/recipes');
    if (step === 'ready') {
      prefetchDestination(queryClient, '/', {
        userId: auth.userId,
        householdId: auth.householdId,
        isGuest: auth.isGuest,
      });
      prefetchDestination(queryClient, '/fridge', {
        userId: auth.userId,
        householdId: auth.householdId,
        isGuest: auth.isGuest,
      });
    }
  }, [step, queryClient, auth.userId, auth.householdId, auth.isGuest]);

  const selectGoal = (goal: 'fridge' | 'today' | 'week') => {
    setPrimaryGoal(goal);
    try {
      localStorage.setItem(ONBOARDING_GOALS_STORAGE_KEY, goal);
    } catch {
      // Ignore storage errors.
    }
  };

  const goToStep = (next: OnboardingStepKey) => {
    setErrorMessage(null);
    setSlideDir(STEP_INDEX[next] < stepNum ? 'prev' : 'next');
    navigate(vnextHref(`/onboarding/${next}`));
  };

  const toggleTasteChip = (chip: (typeof TASTE_CHIPS)[number]) => {
    if (chip.kind === 'cuisine') {
      setSelectedCuisines((prev) =>
        prev.includes(chip.id) ? prev.filter((x) => x !== chip.id) : [...prev, chip.id],
      );
    } else {
      setRestrictions((prev) =>
        prev.includes(chip.id) ? prev.filter((x) => x !== chip.id) : [...prev, chip.id],
      );
    }
  };

  const liveMatchedPreviewDishes = useMemo(() => {
    const activeTags = new Set([...selectedCuisines, ...restrictions]);
    return [...TASTE_PREVIEW_DISHES]
      .map((dish) => {
        let score = 0;
        for (const t of dish.tags) {
          if (activeTags.has(t)) score += 2;
        }
        if (restrictions.includes('vegetarian') && !dish.tags.includes('vegetarian')) {
          score -= 3;
        }
        if (restrictions.includes('quick_meals') && dish.cookTime <= 15) {
          score += 2;
        }
        return { dish, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((entry) => entry.dish);
  }, [selectedCuisines, restrictions]);

  const activeMascotPose: MascotPose = useMemo(() => {
    if (step === 'ready') return 'achievement';
    if (step === 'welcome') return 'welcome';
    if (step === 'goals') {
      return GOAL_CARDS.find((g) => g.id === primaryGoal)?.mascotPose ?? 'cooking';
    }
    if (step === 'preferences') return 'cooking';
    if (step === 'start') {
      return STARTER_PATHS.find((p) => p.id === starterChoice)?.mascotPose ?? 'scanning';
    }
    return 'guide';
  }, [step, primaryGoal, starterChoice]);

  const activeMascotMotion: 'idle' | 'cheer' | 'scan' =
    step === 'ready'
      ? 'cheer'
      : step === 'start' && starterChoice === 'scan'
        ? 'scan'
        : 'idle';

  const commitServerOnboarding = async (skipDirectlyToApp: boolean) => {
    setErrorMessage(null);
    try {
      localStorage.setItem(ONBOARDING_GOALS_STORAGE_KEY, primaryGoal);
    } catch {
      // Ignore storage errors.
    }
    const prefs = {
      householdSize,
      spicyLevel,
      favoriteCuisines: selectedCuisines.length > 0 ? selectedCuisines : ['vietnamese'],
      dietaryRestrictions: restrictions,
    };

    // Unauthenticated `/vnext/o03` preview safety
    if (!auth.userId || !auth.householdId) {
      auth.setOnboardingFromServer(true, { householdSize });
      setServerConfirmed(true);
      navigate(skipDirectlyToApp ? vnextHref('/') : vnextHref('/onboarding/ready'));
      return;
    }

    const isCurrent = capturePrivateSession();
    setIsSaving(true);
    try {
      const assertCurrent = guardPrivateSession();
      const key = familyPreferencesKey();
      if (!isOfflineGuestSession()) {
        if (!skipDirectlyToApp || editedSizeRef.current) {
          try {
            const baseFamily = family ?? familyQuery.data?.preferences ?? DEFAULT_FAMILY_PREFERENCES;
            const baseRev = draftRevision ?? familyQuery.data?.revision ?? 0;
            const saved = await familyPreferencesApi.save(baseRev, {
              ...baseFamily,
              householdSize,
            });
            assertCurrent();
            queryClient.setQueryData(key, saved);
            setDraftRevision(saved.revision);
          } catch (prefErr) {
            if (!skipDirectlyToApp) throw prefErr;
          }
        }

        const result = await api.completeOnboarding(prefs);
        if (!result.success || result.onboardingCompleted !== true) {
          throw new Error('Máy chủ chưa xác nhận hoàn tất thiết lập.');
        }
      }
      assertCurrent();
      if (!isCurrent()) return;
      setServerConfirmed(true);

      if (skipDirectlyToApp) {
        auth.setOnboardingFromServer(true, prefs);
        auth.setOnboardingData({ ...prefs, primaryGoal: 'today' });
        navigate(vnextHref('/'), { replace: true });
      } else {
        auth.setOnboardingFromServer(false, prefs);
        navigate(vnextHref('/onboarding/ready'));
      }
    } catch (failure) {
      if (!isCurrent()) return;
      if (failure instanceof ApiError && failure.code === 'REVISION_CONFLICT') {
        void familyQuery.refetch();
        setErrorMessage(
          'Khẩu phần vừa thay đổi trên thiết bị khác. Đã tải lại dữ liệu mới nhất — vui lòng kiểm tra và thử lại.',
        );
      } else {
        setErrorMessage('Chưa thể lưu thiết lập căn bếp. Vui lòng kiểm tra kết nối và thử lại.');
      }
    } finally {
      if (isCurrent()) setIsSaving(false);
    }
  };

  const handleEnterTakolio = () => {
    auth.setOnboardingData({
      householdSize,
      spicyLevel,
      favoriteCuisines: selectedCuisines.length > 0 ? selectedCuisines : ['vietnamese'],
      dietaryRestrictions: restrictions,
      primaryGoal,
    });
    const starter = STARTER_PATHS.find((p) => p.id === starterChoice);
    const target =
      primaryGoal === 'week'
        ? isMealPlannerEnabled()
          ? '/planner/new'
          : '/week/setup'
        : starter?.href ?? '/';
    navigate(vnextHref(target), { replace: true });
  };

  const primaryBtnClass =
    'tkv-focusable tkv-tactile min-h-[50px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#196149)] hover:bg-[var(--tkv-primary-hover,#134C39)] text-white font-bold text-base shadow-[var(--tkv-shadow-cta)] inline-flex items-center justify-center gap-2 active:scale-[0.985] disabled:opacity-60';
  const secondaryBtnClass =
    'tkv-focusable tkv-tactile min-h-[50px] px-5 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-surface)] border border-[var(--tkv-border-strong,#B8CABE)] hover:bg-[var(--tkv-surface-muted,#E7F4EC)] text-[var(--tkv-ink,#152E2C)] font-bold text-base inline-flex items-center justify-center active:scale-[0.985] shrink-0';

  const scaledPorkGrams = Math.round((400 / 4) * householdSize);
  const scaledEggs = Math.max(1, Math.round((4 / 4) * householdSize));
  const scaledFishSauceMl = Math.round((40 / 4) * householdSize);

  const selectedGoalTitle = GOAL_CARDS.find((g) => g.id === primaryGoal)?.title ?? 'Tìm món nấu ngay';
  const selectedSpicyLabel = SPICY_CHIPS.find((s) => s.id === spicyLevel)?.label ?? 'Trung bình';
  const selectedCuisineLabels = TASTE_CHIPS.filter(
    (c) => c.kind === 'cuisine' && selectedCuisines.includes(c.id),
  ).map((c) => c.label);

  const stepAnimClass = slideDir === 'prev' ? 'tkv-slide-prev' : 'tkv-slide-next';

  return (
    <div
      className="tkv-root min-h-dvh flex flex-col bg-[var(--tkv-bg,#FFF9F1)]"
      data-tkv-direction="a"
      data-tkv-screen={screenId}
    >
      <a href="#tkv-onb-main" className="tkv-skip-link">
        Đến bước thiết lập căn bếp
      </a>

      <main
        id="tkv-onb-main"
        tabIndex={-1}
        className="flex-1 max-w-[1020px] w-full mx-auto px-4 sm:px-6 pt-[max(1.25rem,env(safe-area-inset-top,0px))] pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] sm:py-10 flex items-center justify-center"
      >
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <TkvSurface className="lg:col-span-7 p-5 sm:p-8 flex flex-col gap-5 bg-[var(--tkv-surface)] border-[var(--tkv-border)] shadow-[var(--tkv-shadow-elevated)]">
            {/* Top Bar + Skip */}
            <div className="flex items-center justify-between gap-3">
              <Link to={vnextHref('/landing')} className="tkv-focusable rounded-xl py-1">
                <BrandLockup />
              </Link>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full bg-[var(--tkv-surface-mint)] text-[11px] font-extrabold text-[var(--tkv-primary)] tabular-nums">
                  Bước {stepNum}/6 · {STEP_TITLES[step]}
                </span>
                {step !== 'ready' && (
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => void commitServerOnboarding(true)}
                    className="tkv-focusable min-h-[44px] px-3 rounded-xl text-sm font-bold text-[var(--tkv-ink-soft,#3C5954)] hover:bg-[var(--tkv-surface-muted,#E7F4EC)] hover:text-[var(--tkv-ink,#152E2C)] transition-colors"
                  >
                    Bỏ qua
                  </button>
                )}
              </div>
            </div>

            {/* 6-Segment Animated Leaf Green Progress Rail */}
            <div className="flex flex-col gap-1.5">
              <div
                role="progressbar"
                aria-label={`Tiến độ thiết lập: bước ${stepNum} trên 6`}
                aria-valuemin={1}
                aria-valuemax={6}
                aria-valuenow={stepNum}
                className="grid grid-cols-6 gap-2"
              >
                {[1, 2, 3, 4, 5, 6].map((idx) => (
                  <span
                    key={idx}
                    aria-hidden="true"
                    className="h-2 rounded-full overflow-hidden bg-[var(--tkv-border,#DCE6DE)]"
                  >
                    <span
                      className={clsx(
                        'block h-full rounded-full bg-[var(--tkv-primary,#196149)] transition-[width] duration-300 ease-out',
                        idx <= stepNum ? 'w-full' : 'w-0',
                      )}
                    />
                  </span>
                ))}
              </div>
              <p className="sm:hidden text-[11px] font-extrabold text-[var(--tkv-ink-muted)] tabular-nums text-right">
                Bước {stepNum}/6 · {STEP_TITLES[step]}
              </p>
            </div>

            {/* Living Bé Mầm Bếp Companion Illustration */}
            <div className="relative flex justify-center pt-1">
              {step === 'ready' && <TkvConfettiBurst />}
              <MascotIllustration
                key={activeMascotPose}
                pose={activeMascotPose}
                size={108}
                motion={activeMascotMotion}
                priority
                className="w-24 h-24 sm:w-28 sm:h-28"
              />
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-sm font-semibold text-[var(--tkv-accent-ink,#B33A22)] flex items-center gap-2.5 tkv-enter-fade-up"
              >
                <span className="w-2 h-2 rounded-full bg-[var(--tkv-primary,#196149)] shrink-0" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Animated Step Content Host */}
            <div key={step} className={stepAnimClass}>
              {/* O01 — Chào mừng đến Takolio */}
              {step === 'welcome' && (
                <div className="flex flex-col gap-5">
                  <div className="text-center flex flex-col gap-2">
                    <span className="inline-flex items-center gap-1.5 self-center px-3 py-1 rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] text-xs font-extrabold text-[var(--tkv-primary)]">
                      <VNextIcon name="sparkles" size={13} />
                      <span>Thiết lập nhanh ~45 giây</span>
                    </span>
                    <h1 className="tkv-heading text-2xl sm:text-[1.9rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
                      Chào mừng đến Takolio
                    </h1>
                    <p className="text-sm sm:text-base text-[var(--tkv-ink-soft,#3C5954)]">
                      Sắp xếp căn bếp thông minh theo đúng khẩu phần và thói quen nhà bạn.
                    </p>
                  </div>

                  {/* Mini 3-Step Visual Kitchen Loop */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { icon: 'scan' as const, label: 'Chụp tủ lạnh', sub: 'Duyệt an toàn' },
                      { icon: 'recipes' as const, label: 'Gợi ý món ngon', sub: 'Khớp tủ sẵn có' },
                      { icon: 'calendar' as const, label: 'Lên tuần gọn', sub: 'Đi chợ vừa đủ' },
                    ].map((item, idx) => (
                      <div
                        key={item.label}
                        style={{ '--tkv-i': idx } as React.CSSProperties}
                        className="tkv-stagger rounded-2xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] p-3 text-center flex flex-col items-center gap-1.5"
                      >
                        <span className="w-9 h-9 rounded-xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] text-[var(--tkv-primary)] inline-flex items-center justify-center">
                          <VNextIcon name={item.icon} size={18} />
                        </span>
                        <p className="text-xs font-extrabold text-[var(--tkv-ink)] leading-snug">{item.label}</p>
                        <p className="text-[11px] font-medium text-[var(--tkv-ink-muted)] leading-tight">{item.sub}</p>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-[var(--tkv-accent-border,#FAD0C4)] bg-[var(--tkv-accent-soft,#FFF0E9)] p-4 flex items-center gap-3.5">
                    <span className="w-11 h-11 rounded-xl bg-[var(--tkv-surface)] border border-[var(--tkv-accent-border,#FAD0C4)] text-[var(--tkv-primary,#196149)] flex items-center justify-center shrink-0">
                      <VNextIcon name="sparkles" size={20} />
                    </span>
                    <div className="min-w-0">
                      <p className="tkv-heading text-[15px] sm:text-base font-extrabold text-[var(--tkv-ink,#152E2C)] leading-snug text-balance">
                        Tự động gợi ý cho bữa{'\u00A0'}hôm{'\u00A0'}nay
                      </p>
                      <p className="text-xs sm:text-sm text-[var(--tkv-ink-soft,#3C5954)] mt-0.5">
                        Bắt đầu đơn giản, nâng cao dần theo thói quen gia đình
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => goToStep('goals')}
                    className={clsx(primaryBtnClass, 'w-full')}
                  >
                    <span>Tiếp tục</span>
                    <VNextIcon name="arrow-right" size={18} />
                  </button>
                </div>
              )}

              {/* O02 — Mục tiêu sử dụng */}
              {step === 'goals' && (
                <div className="flex flex-col gap-5">
                  <div className="text-center flex flex-col gap-2">
                    <h1 className="tkv-heading text-2xl sm:text-[1.85rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
                      Mục tiêu sử dụng
                    </h1>
                    <p className="text-sm sm:text-base text-[var(--tkv-ink-soft,#3C5954)]">
                      Bạn muốn Takolio giúp việc gì trước tiên?
                    </p>
                  </div>

                  <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Mục tiêu sử dụng chính">
                    {GOAL_CARDS.map((g, idx) => {
                      const selected = primaryGoal === g.id;
                      return (
                        <button
                          key={g.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          data-testid={`o02-goal-${g.id}`}
                          onClick={() => selectGoal(g.id)}
                          style={{ '--tkv-i': idx } as React.CSSProperties}
                          className={clsx(
                            'tkv-focusable tkv-tactile tkv-stagger w-full p-4 rounded-2xl border text-left flex items-center justify-between gap-3.5 active:scale-[0.985]',
                            selected
                              ? 'bg-[var(--tkv-surface-mint)] border-[var(--tkv-primary,#196149)] ring-1 ring-[var(--tkv-primary,#196149)] shadow-xs'
                              : 'bg-[var(--tkv-surface)] border-[var(--tkv-border,#DCE6DE)] hover:border-[var(--tkv-border-strong,#B8CABE)]',
                          )}
                        >
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <span
                              className={clsx(
                                'w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-colors',
                                selected
                                  ? 'bg-[var(--tkv-primary)] border-[var(--tkv-primary)] text-white tkv-pop'
                                  : 'bg-[var(--tkv-bg)] border-[var(--tkv-border)] text-[var(--tkv-primary)]',
                              )}
                            >
                              <VNextIcon name={g.icon} size={20} />
                            </span>
                            <div className="min-w-0">
                              <p className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">{g.title}</p>
                              <p className="text-xs text-[var(--tkv-ink-secondary)]">{g.subtitle}</p>
                            </div>
                          </div>
                          {selected && (
                            <span
                              className="w-6 h-6 rounded-full bg-[var(--tkv-primary,#196149)] text-white inline-flex items-center justify-center shrink-0 tkv-pop"
                              aria-hidden="true"
                            >
                              <VNextIcon name="check" size={14} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex gap-2.5">
                    <button type="button" className={secondaryBtnClass} onClick={() => goToStep('welcome')}>
                      Quay lại
                    </button>
                    <button type="button" className={clsx(primaryBtnClass, 'flex-1')} onClick={() => goToStep('household')}>
                      <span>Tiếp tục</span>
                      <VNextIcon name="arrow-right" size={18} />
                    </button>
                  </div>
                </div>
              )}

              {/* O03 — Gia đình và khẩu phần */}
              {step === 'household' && (
                <div className="flex flex-col gap-5">
                  <div className="text-center flex flex-col gap-2">
                    <h1 className="tkv-heading text-2xl sm:text-[1.85rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
                      Gia đình và khẩu phần
                    </h1>
                    <p className="text-sm sm:text-base text-[var(--tkv-ink-soft,#3C5954)]">
                      Chọn số người ăn thường xuyên để Takolio quy đổi lượng nguyên liệu và khẩu phần hợp lý.
                    </p>
                  </div>

                  {/* Interactive Visual Dining-Table Counter */}
                  <div
                    aria-hidden="true"
                    className="rounded-2xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] px-4 py-3 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {Array.from({ length: Math.min(householdSize, 8) }).map((_, i) => (
                        <span
                          key={i}
                          className="w-7 h-7 rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] text-[var(--tkv-primary)] inline-flex items-center justify-center tkv-pop"
                        >
                          <VNextIcon name="users" size={14} />
                        </span>
                      ))}
                      {householdSize > 8 && (
                        <span className="px-2 py-1 rounded-full bg-[var(--tkv-surface-coral)] text-[11px] font-extrabold text-[var(--tkv-coral-ink)] tabular-nums">
                          +{householdSize - 8}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-extrabold text-[var(--tkv-primary)] tabular-nums shrink-0">
                      Bàn ăn {householdSize} người
                    </span>
                  </div>

                  <fieldset className="flex flex-col gap-3">
                    <legend className="text-sm font-extrabold text-[var(--tkv-ink,#152E2C)] mb-2">
                      Gia đình bạn có bao nhiêu người?
                    </legend>
                    <div className="grid grid-cols-5 gap-2.5">
                      {([1, 2, 3, 4, 5] as const).map((b) => {
                        const active = b < 5 ? householdSize === b : householdSize >= 5;
                        return (
                          <button
                            key={b}
                            type="button"
                            data-testid={`o03-bucket-${b}`}
                            aria-pressed={active}
                            onClick={() => {
                              editedSizeRef.current = true;
                              if (b === 5 && householdSize > 5) return;
                              setHouseholdSize(b);
                            }}
                            className={clsx(
                              'tkv-focusable tkv-tactile min-h-[56px] rounded-2xl tabular-nums text-lg font-extrabold border active:scale-95',
                              active
                                ? 'bg-[var(--tkv-primary,#196149)] text-white border-[var(--tkv-primary,#196149)] shadow-[var(--tkv-shadow-cta)] tkv-pop'
                                : 'bg-[var(--tkv-bg,#FFF9F1)] text-[var(--tkv-ink,#152E2C)] border-[var(--tkv-border,#DCE6DE)] hover:border-[var(--tkv-border-strong,#B8CABE)]',
                            )}
                          >
                            {b === 5 ? '5+' : b}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  {householdSize >= 5 && (
                    <div className="p-4 rounded-2xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 tkv-enter-fade-up">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[var(--tkv-ink)]">Số người cụ thể (5–20 người)</p>
                        <p className="text-xs text-[var(--tkv-ink-secondary)]">Máy chủ lưu chính xác từ 1 đến 20 người</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                        <TkvIconButton
                          icon="minus"
                          label="Giảm số người"
                          onClick={() => setHouseholdSize((n) => Math.max(1, n - 1))}
                        />
                        <span className="min-w-[68px] text-center tabular-nums text-base font-extrabold text-[var(--tkv-ink)]">
                          {householdSize} người
                        </span>
                        <TkvIconButton
                          icon="plus"
                          label="Tăng số người"
                          onClick={() => setHouseholdSize((n) => Math.min(20, n + 1))}
                          disabled={householdSize >= 20}
                        />
                      </div>
                    </div>
                  )}

                  {/* Mobile Live Ingredient Scaling Strip (makes scaling magic visible on phones too!) */}
                  <div className="lg:hidden rounded-2xl bg-[var(--tkv-surface-mint)]/70 border border-[var(--tkv-border-mint)] p-3.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-extrabold text-[var(--tkv-primary)]">
                        Quy đổi mẫu · Thịt kho trứng
                      </span>
                      <span className="text-[11px] font-bold text-[var(--tkv-ink-secondary)] tabular-nums">
                        {householdSize} người
                      </span>
                    </div>
                    <div
                      key={householdSize}
                      className="grid grid-cols-3 gap-2 text-center bg-[var(--tkv-surface)] rounded-xl p-2.5 border border-[var(--tkv-border)] tkv-enter-fade-up"
                    >
                      <div>
                        <p className="text-[11px] text-[var(--tkv-ink-muted)]">Thịt ba chỉ</p>
                        <p className="text-xs font-extrabold text-[var(--tkv-ink)] tabular-nums">{scaledPorkGrams} g</p>
                      </div>
                      <div className="border-x border-[var(--tkv-border)]">
                        <p className="text-[11px] text-[var(--tkv-ink-muted)]">Trứng gà</p>
                        <p className="text-xs font-extrabold text-[var(--tkv-ink)] tabular-nums">{scaledEggs} quả</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-[var(--tkv-ink-muted)]">Nước mắm</p>
                        <p className="text-xs font-extrabold text-[var(--tkv-ink)] tabular-nums">{scaledFishSauceMl} ml</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2.5">
                    <button type="button" className={secondaryBtnClass} onClick={() => goToStep('goals')}>
                      Quay lại
                    </button>
                    <button
                      type="button"
                      onClick={() => goToStep('preferences')}
                      data-testid="o03-continue-btn"
                      className={clsx(primaryBtnClass, 'flex-1')}
                    >
                      <span>Tiếp tục</span>
                      <VNextIcon name="arrow-right" size={18} />
                    </button>
                  </div>
                  <p className="text-center text-xs text-[var(--tkv-ink-muted,#52706A)]">
                    Chỉ dùng để tính khẩu phần món ăn — có thể thay đổi bất cứ lúc nào trong phần Cài đặt.
                  </p>
                </div>
              )}

              {/* O04 — Khẩu vị của bạn (aligned 1:1 with U02 FoodPreferencesPage + Live Recipe Preview) */}
              {step === 'preferences' && (
                <div className="flex flex-col gap-5">
                  <div className="text-center flex flex-col gap-2">
                    <h1 className="tkv-heading text-2xl sm:text-[1.85rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
                      Khẩu vị của bạn
                    </h1>
                    <p className="text-sm sm:text-base text-[var(--tkv-ink-soft,#3C5954)]">
                      Chọn nền ẩm thực, thói quen ăn uống và mức cay phù hợp với gia đình.
                    </p>
                  </div>

                  <fieldset className="flex flex-col gap-2.5">
                    <legend className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink-muted,#52706A)]">
                      Ẩm thực & thói quen
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {TASTE_CHIPS.map((chip) => {
                        const active =
                          chip.kind === 'cuisine'
                            ? selectedCuisines.includes(chip.id)
                            : restrictions.includes(chip.id);
                        return (
                          <button
                            key={chip.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggleTasteChip(chip)}
                            className={clsx(
                              'tkv-focusable tkv-tactile min-h-[44px] px-3.5 py-2 rounded-full text-sm font-bold border active:scale-95 inline-flex items-center gap-1.5',
                              active
                                ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] shadow-xs'
                                : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink)] border-[var(--tkv-border)] hover:border-[var(--tkv-border-strong)]',
                            )}
                          >
                            {active && <VNextIcon name="check" size={14} />}
                            <span>{chip.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <fieldset className="flex flex-col gap-2.5">
                    <legend className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink-muted,#52706A)]">
                      Mức độ cay
                    </legend>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {SPICY_CHIPS.map((sp) => {
                        const active = spicyLevel === sp.id;
                        return (
                          <button
                            key={sp.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setSpicyLevel(sp.id)}
                            className={clsx(
                              'tkv-focusable tkv-tactile min-h-[44px] px-3 py-2 rounded-full text-xs sm:text-sm font-bold border active:scale-95',
                              active
                                ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] shadow-xs'
                                : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink)] border-[var(--tkv-border)] hover:border-[var(--tkv-border-strong)]',
                            )}
                          >
                            {sp.label}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  {/* Live "Món hợp gu nhà bạn" Preview Strip */}
                  <div className="rounded-2xl bg-[var(--tkv-bg)] border border-[var(--tkv-border-mint)] p-3.5 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--tkv-primary)]">
                        <VNextIcon name="sparkles" size={14} />
                        <span>Món hợp gu nhà bạn ({householdSize} người)</span>
                      </span>
                      <span className="text-[11px] font-semibold text-[var(--tkv-ink-muted)]">Xem trước trực tiếp</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {liveMatchedPreviewDishes.map((dish, idx) => (
                        <div
                          key={dish.slug}
                          style={{ '--tkv-i': idx } as React.CSSProperties}
                          className="tkv-stagger rounded-xl overflow-hidden bg-[var(--tkv-surface)] border border-[var(--tkv-border)] flex flex-col"
                        >
                          <VerifiedDishImage
                            slug={dish.slug}
                            title={dish.title}
                            aspectClass="aspect-[4/3]"
                            className="w-full"
                          />
                          <div className="p-2 flex flex-col gap-0.5">
                            <p className="text-[11px] font-extrabold text-[var(--tkv-ink)] line-clamp-2 leading-snug">
                              {dish.title}
                            </p>
                            <span className="text-[10px] font-semibold text-[var(--tkv-ink-muted)] tabular-nums">
                              {dish.cookTime} phút
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className="text-center text-xs text-[var(--tkv-ink-muted,#52706A)]">
                    Lưu ý an toàn: nhãn khẩu vị hỗ trợ gợi ý món ăn, không thay thế việc kiểm tra thành phần gây dị ứng y khoa trên từng nguyên liệu.
                  </p>

                  <div className="flex gap-2.5">
                    <button type="button" className={secondaryBtnClass} onClick={() => goToStep('household')}>
                      Quay lại
                    </button>
                    <button type="button" className={clsx(primaryBtnClass, 'flex-1')} onClick={() => goToStep('start')}>
                      <span>Tiếp tục</span>
                      <VNextIcon name="arrow-right" size={18} />
                    </button>
                  </div>
                </div>
              )}

              {/* O05 — Khởi tạo căn bếp */}
              {step === 'start' && (
                <div className="flex flex-col gap-5">
                  <div className="text-center flex flex-col gap-2">
                    <h1 className="tkv-heading text-2xl sm:text-[1.85rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
                      Khởi tạo căn bếp
                    </h1>
                    <p className="text-sm sm:text-base text-[var(--tkv-ink-soft,#3C5954)]">
                      Chọn cách vào bếp đầu tiên phù hợp nhất ngay lúc này.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Hành động đầu tiên khi vào bếp">
                    {STARTER_PATHS.map((sp, idx) => {
                      const selected = starterChoice === sp.id;
                      return (
                        <button
                          key={sp.id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setStarterChoice(sp.id)}
                          style={{ '--tkv-i': idx } as React.CSSProperties}
                          className={clsx(
                            'tkv-focusable tkv-tactile tkv-stagger w-full p-4 rounded-2xl border text-left flex items-center justify-between gap-3.5 active:scale-[0.985]',
                            selected
                              ? 'bg-[var(--tkv-surface-mint)] border-[var(--tkv-primary,#196149)] ring-1 ring-[var(--tkv-primary,#196149)] shadow-xs'
                              : 'bg-[var(--tkv-surface)] border-[var(--tkv-border,#DCE6DE)] hover:border-[var(--tkv-border-strong,#B8CABE)]',
                          )}
                        >
                          <div className="flex items-center gap-3.5 min-w-0 flex-1">
                            <span
                              className={clsx(
                                'w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-colors',
                                selected
                                  ? 'bg-[var(--tkv-primary)] border-[var(--tkv-primary)] text-white tkv-pop'
                                  : 'bg-[var(--tkv-bg)] border-[var(--tkv-border)] text-[var(--tkv-primary)]',
                              )}
                            >
                              <VNextIcon name={sp.icon} size={20} />
                            </span>
                            <div className="min-w-0 flex flex-col gap-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">{sp.title}</p>
                                {sp.badge && (
                                  <span className="px-2 py-0.5 rounded-full bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] text-[10.5px] font-extrabold text-[var(--tkv-coral-ink)]">
                                    {sp.badge}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-[var(--tkv-ink-secondary)]">{sp.subtitle}</p>
                            </div>
                          </div>
                          {selected && (
                            <span
                              className="w-6 h-6 rounded-full bg-[var(--tkv-primary,#196149)] text-white inline-flex items-center justify-center shrink-0 tkv-pop"
                              aria-hidden="true"
                            >
                              <VNextIcon name="check" size={14} />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {isSaving && (
                    <div
                      role="status"
                      aria-live="polite"
                      className="rounded-2xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] px-4 py-3 text-xs font-bold text-[var(--tkv-primary)] flex items-center justify-center gap-2 tkv-enter-fade-up"
                    >
                      <span className="inline-flex items-center gap-1" aria-hidden="true">
                        <span className="tkv-pending-dot" style={{ animationDelay: '0ms' }} />
                        <span className="tkv-pending-dot" style={{ animationDelay: '140ms' }} />
                        <span className="tkv-pending-dot" style={{ animationDelay: '280ms' }} />
                      </span>
                      <span>Bé Mầm Bếp đang cá nhân hóa căn bếp cho {householdSize} người…</span>
                    </div>
                  )}

                  <div className="flex gap-2.5">
                    <button type="button" className={secondaryBtnClass} onClick={() => goToStep('preferences')}>
                      Quay lại
                    </button>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void commitServerOnboarding(false)}
                      className={clsx(primaryBtnClass, 'flex-1')}
                    >
                      {isSaving ? 'Đang lưu…' : 'Hoàn tất thiết lập'}
                    </button>
                  </div>
                </div>
              )}

              {/* O06 — Sẵn sàng vào bếp (Server-Confirmed Completion + Instant Prefetched Handoff) */}
              {step === 'ready' && (
                <div className="flex flex-col gap-5">
                  <div className="text-center flex flex-col gap-2">
                    <h1 className="tkv-heading text-2xl sm:text-[1.9rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
                      Sẵn sàng vào bếp
                    </h1>
                    <p className="text-sm sm:text-base text-[var(--tkv-ink-soft,#3C5954)]">
                      {serverConfirmed
                        ? 'Thiết lập ban đầu đã được máy chủ xác nhận, căn bếp riêng của bạn đã mở.'
                        : 'Xác nhận lưu thiết lập với máy chủ trước khi vào căn bếp của bạn.'}
                    </p>
                  </div>

                  {/* Personalized Kitchen Profile Card */}
                  <div className="rounded-2xl bg-[var(--tkv-sage-soft,#E7F4EC)] border border-[var(--tkv-sage-border,#BDE0CC)] p-5 flex flex-col gap-3.5">
                    <div className="flex items-center gap-3">
                      <span className="w-11 h-11 rounded-2xl bg-[var(--tkv-sage,#196149)] text-white flex items-center justify-center shrink-0 tkv-pop">
                        <VNextIcon name="check" size={22} />
                      </span>
                      <div className="min-w-0">
                        <p className="tkv-heading text-base sm:text-lg font-extrabold text-[var(--tkv-ink,#152E2C)]">
                          Hồ sơ căn bếp đã sẵn sàng
                        </p>
                        <p className="text-xs text-[var(--tkv-ink-soft,#3C5954)]">
                          Mọi thông số đều có thể điều chỉnh lại trong mục Cài đặt.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 bg-[var(--tkv-surface)] rounded-xl p-3.5 border border-[var(--tkv-border)] text-xs">
                      <div>
                        <p className="text-[var(--tkv-ink-muted)] font-semibold">Khẩu phần mặc định</p>
                        <p className="font-extrabold text-[var(--tkv-ink)] tabular-nums mt-0.5">{householdSize} người</p>
                      </div>
                      <div>
                        <p className="text-[var(--tkv-ink-muted)] font-semibold">Mục tiêu chính</p>
                        <p className="font-extrabold text-[var(--tkv-ink)] mt-0.5 truncate">{selectedGoalTitle}</p>
                      </div>
                      <div>
                        <p className="text-[var(--tkv-ink-muted)] font-semibold">Ẩm thực ưa thích</p>
                        <p className="font-extrabold text-[var(--tkv-ink)] mt-0.5 truncate">
                          {selectedCuisineLabels.length > 0 ? selectedCuisineLabels.join(', ') : 'Món Việt'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[var(--tkv-ink-muted)] font-semibold">Độ cay</p>
                        <p className="font-extrabold text-[var(--tkv-ink)] mt-0.5">{selectedSpicyLabel}</p>
                      </div>
                    </div>
                  </div>

                  {serverConfirmed ? (
                    <button type="button" onClick={handleEnterTakolio} className={clsx(primaryBtnClass, 'w-full')}>
                      <span>Vào Takolio</span>
                      <VNextIcon name="arrow-right" size={18} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void commitServerOnboarding(true)}
                      className={clsx(primaryBtnClass, 'w-full')}
                    >
                      {isSaving ? 'Đang lưu…' : 'Xác nhận lưu & Vào Takolio'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </TkvSurface>

          {/* Desktop Live Scaling & Summary Side Panel */}
          <div className="hidden lg:block lg:col-span-5">
            <div className="tkv-hero-living rounded-[24px] p-7 flex flex-col gap-4">
              <div className="inline-flex items-center gap-2 self-start px-3.5 py-1.5 rounded-full bg-[var(--tkv-surface-mint,#E7F4EC)] border border-[var(--tkv-border-mint,#BDE0CC)] text-sm font-semibold text-[var(--tkv-primary,#196149)]">
                <span className="w-2 h-2 rounded-full bg-[var(--tkv-primary,#196149)]" aria-hidden="true" />
                <span>Khẩu phần hiện chọn: {householdSize} người</span>
              </div>
              <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink,#152E2C)]">
                Định lượng tự động nhân chia theo bàn ăn nhà bạn
              </h2>
              <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                Ví dụ với món <strong className="font-semibold text-[var(--tkv-ink,#152E2C)]">Thịt kho tàu nước dừa trứng</strong> chuẩn 4 người, Takolio quy đổi sang khẩu phần <strong className="font-semibold text-[var(--tkv-ink,#152E2C)]">{householdSize} người</strong>:
              </p>

              <VerifiedDishImage
                slug="thit-kho-trung"
                title="Thịt kho tàu nước dừa trứng"
                aspectClass="aspect-[16/9]"
                className="w-full rounded-2xl border border-[var(--tkv-border)] shadow-xs"
              />

              <div
                key={householdSize}
                className="bg-[var(--tkv-surface)] rounded-2xl p-4 border border-[var(--tkv-border,#DCE6DE)] flex flex-col gap-2 text-sm tkv-enter-fade-up"
              >
                <div className="flex justify-between">
                  <span className="text-[var(--tkv-ink-soft,#3C5954)]">Thịt ba chỉ</span>
                  <strong className="font-extrabold tabular-nums text-[var(--tkv-ink,#152E2C)]">{scaledPorkGrams} g</strong>
                </div>
                <div className="flex justify-between border-t border-[var(--tkv-border,#DCE6DE)] pt-2">
                  <span className="text-[var(--tkv-ink-soft,#3C5954)]">Trứng gà ta</span>
                  <strong className="font-extrabold tabular-nums text-[var(--tkv-ink,#152E2C)]">{scaledEggs} quả</strong>
                </div>
                <div className="flex justify-between border-t border-[var(--tkv-border,#DCE6DE)] pt-2">
                  <span className="text-[var(--tkv-ink-soft,#3C5954)]">Nước mắm Phú Quốc</span>
                  <strong className="font-extrabold tabular-nums text-[var(--tkv-ink,#152E2C)]">{scaledFishSauceMl} ml</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
