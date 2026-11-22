import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import '../styles/tokens.css';
import { useAuthStore } from '../../stores/useAuthStore';

const ONBOARDING_GOALS_STORAGE_KEY = 'takolio_onboarding_goals';
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
import { BrandLockup, MascotIllustration } from '../components/VNextMedia';
import { TkvIconButton, TkvSurface } from '../components/Primitives';
import { VNextIcon, type VNextIconName } from '../components/VNextIcons';

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
}> = [
  { id: 'fridge', title: 'Quản lý tủ lạnh', subtitle: 'Biết còn gì, ưu tiên dùng gì trước', icon: 'fridge' },
  { id: 'today', title: 'Tìm món nấu ngay', subtitle: 'Tận dụng nguyên liệu sẵn có hôm nay', icon: 'recipes' },
  { id: 'week', title: 'Lên thực đơn tuần', subtitle: 'Chủ động từng bữa và danh sách chợ', icon: 'calendar' },
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

const STARTER_PATHS: Array<{
  id: 'scan' | 'fridge' | 'recipes';
  title: string;
  subtitle: string;
  icon: VNextIconName;
  href: string;
}> = [
  {
    id: 'scan',
    title: 'Chụp ảnh tủ lạnh',
    subtitle: 'Lựa chọn an toàn, luôn duyệt kết quả trước khi lưu',
    icon: 'scan',
    href: '/scan',
  },
  {
    id: 'fridge',
    title: 'Thêm nguyên liệu thủ công',
    subtitle: 'Nhập nhanh vài thực phẩm đang có sẵn trong bếp',
    icon: 'plus',
    href: '/fridge?action=add',
  },
  {
    id: 'recipes',
    title: 'Khám phá món trước',
    subtitle: 'Xem ngay kho công thức gia đình Việt xác minh',
    icon: 'recipes',
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
 * Official Takolio Brand Board v2 6-Step Onboarding Flow (`O01–O06`).
 * - Persists `O02` goals selection to `localStorage` (`takolio_onboarding_goals`).
 * - Shares exact `CUISINE` / `RESTRICTION` / `spicyLevel` vocabulary with `U02` (`FoodPreferencesPage`).
 * - Preserves `1..20` household sizing and server-confirmed completion invariants.
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
  const [starterChoice, setStarterChoice] = useState<'scan' | 'fridge' | 'recipes'>('fridge');
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
        setErrorMessage('Khẩu phần vừa thay đổi trên thiết bị khác. Đã tải lại dữ liệu mới nhất — vui lòng kiểm tra và thử lại.');
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
    'tkv-focusable min-h-[50px] px-6 py-3 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary,#196149)] hover:bg-[var(--tkv-primary-hover,#134C39)] text-white font-bold text-base shadow-xs inline-flex items-center justify-center transition-colors disabled:opacity-60';
  const secondaryBtnClass =
    'tkv-focusable min-h-[50px] px-5 py-3 rounded-[var(--tkv-radius-btn)] bg-white border border-[var(--tkv-border-strong,#B8CABE)] hover:bg-[var(--tkv-surface-muted,#E7F4EC)] text-[var(--tkv-ink,#152E2C)] font-bold text-base inline-flex items-center justify-center transition-colors shrink-0';

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
        className="flex-1 max-w-[980px] w-full mx-auto px-4 sm:px-6 py-5 sm:py-10 flex items-center justify-center"
      >
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <TkvSurface className="lg:col-span-7 p-6 sm:p-8 space-y-6 bg-white border-[var(--tkv-border,#DCE6DE)] shadow-soft">
            {/* Top Bar + Skip */}
            <div className="flex items-center justify-between gap-3">
              <Link to={vnextHref('/landing')} className="tkv-focusable rounded-xl py-1">
                <BrandLockup />
              </Link>
              {step !== 'ready' && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void commitServerOnboarding(true)}
                  className="tkv-focusable min-h-[44px] px-3 rounded-xl text-sm font-bold text-[var(--tkv-ink-soft,#3C5954)] hover:bg-[var(--tkv-surface-muted,#E7F4EC)] hover:text-[var(--tkv-ink,#152E2C)]"
                >
                  Bỏ qua
                </button>
              )}
            </div>

            {/* 6-Segment Terracotta Progress Bar */}
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
                  className={clsx(
                    'h-1.5 rounded-full transition-colors',
                    idx <= stepNum
                      ? 'bg-[var(--tkv-primary,#196149)]'
                      : 'bg-[var(--tkv-border,#DCE6DE)]',
                  )}
                />
              ))}
            </div>

            {/* Bé Mầm Bếp Companion Illustration */}
            <div className="flex justify-center pt-1">
              <MascotIllustration
                pose={step === 'ready' ? 'achievement' : step === 'welcome' ? 'welcome' : 'guide'}
                size={104}
                className="w-24 h-24"
              />
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-[var(--tkv-accent-soft,#FFF0E9)] border border-[var(--tkv-accent-border,#FAD0C4)] text-sm font-semibold text-[var(--tkv-accent-ink,#B33A22)] flex items-center gap-2.5"
              >
                <span className="w-2 h-2 rounded-full bg-[var(--tkv-primary,#196149)] shrink-0" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* O01 — Chào mừng đến Takolio */}
            {step === 'welcome' && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h1 className="tkv-heading text-2xl sm:text-[1.85rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
                    Chào mừng đến Takolio
                  </h1>
                  <p className="text-sm sm:text-base text-[var(--tkv-ink-soft,#3C5954)]">
                    Sắp xếp căn bếp thông minh theo cách riêng của bạn.
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--tkv-accent-border,#FAD0C4)] bg-[var(--tkv-accent-soft,#FFF0E9)] p-4 flex items-center gap-3.5">
                  <span className="w-11 h-11 rounded-xl bg-white border border-[var(--tkv-accent-border,#FAD0C4)] text-[var(--tkv-primary,#196149)] flex items-center justify-center shrink-0">
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
                  Tiếp tục
                </button>
              </div>
            )}

            {/* O02 — Mục tiêu sử dụng */}
            {step === 'goals' && (
              <div className="space-y-5">
                <div className="text-center space-y-2">
                  <h1 className="tkv-heading text-2xl sm:text-[1.85rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
                    Mục tiêu sử dụng
                  </h1>
                  <p className="text-sm sm:text-base text-[var(--tkv-ink-soft,#3C5954)]">
                    Bạn muốn Takolio giúp việc gì trước tiên?
                  </p>
                </div>

                <div className="space-y-2.5" role="radiogroup" aria-label="Mục tiêu sử dụng chính">
                  {GOAL_CARDS.map((g) => {
                    const selected = primaryGoal === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        data-testid={`o02-goal-${g.id}`}
                        onClick={() => selectGoal(g.id)}
                        className={clsx(
                          'tkv-focusable w-full p-4 rounded-2xl border text-left flex items-center justify-between gap-3.5 transition-colors',
                          selected
                            ? 'bg-[var(--tkv-accent-soft,#FFF0E9)] border-[var(--tkv-primary,#196149)] ring-1 ring-[var(--tkv-primary,#196149)]'
                            : 'bg-white border-[var(--tkv-border,#DCE6DE)] hover:border-[var(--tkv-border-strong,#B8CABE)]',
                        )}
                      >
                        <div className="flex items-center gap-3.5">
                          <span className="w-11 h-11 rounded-xl bg-white border border-[var(--tkv-border,#DCE6DE)] text-[var(--tkv-primary,#196149)] flex items-center justify-center shrink-0">
                            <VNextIcon name={g.icon} size={20} />
                          </span>
                          <div>
                            <p className="tkv-heading text-base font-extrabold text-[var(--tkv-ink,#152E2C)]">{g.title}</p>
                            <p className="text-xs text-[var(--tkv-ink-soft,#3C5954)]">{g.subtitle}</p>
                          </div>
                        </div>
                        {selected && (
                          <span className="w-2.5 h-2.5 rounded-full bg-[var(--tkv-primary,#196149)] shrink-0" aria-hidden="true" />
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
                    Tiếp tục
                  </button>
                </div>
              </div>
            )}

            {/* O03 — Gia đình và khẩu phần */}
            {step === 'household' && (
              <div className="space-y-5">
                <div className="text-center space-y-2">
                  <h1 className="tkv-heading text-2xl sm:text-[1.85rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
                    Gia đình và khẩu phần
                  </h1>
                  <p className="text-sm sm:text-base text-[var(--tkv-ink-soft,#3C5954)]">
                    Chọn số người ăn thường xuyên để Takolio quy đổi lượng nguyên liệu và khẩu phần hợp lý.
                  </p>
                </div>

                <fieldset className="space-y-3">
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
                            'tkv-focusable min-h-[56px] rounded-2xl tabular-nums text-lg font-extrabold border transition-colors',
                            active
                              ? 'bg-[var(--tkv-primary,#196149)] text-white border-[var(--tkv-primary,#196149)] shadow-xs'
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
                  <div className="p-4 rounded-2xl bg-[var(--tkv-surface-muted,#E7F4EC)] border border-[var(--tkv-border,#DCE6DE)] flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[var(--tkv-ink,#152E2C)]">Số người cụ thể (5–20 người)</p>
                      <p className="text-xs text-[var(--tkv-ink-soft,#3C5954)]">Máy chủ lưu chính xác từ 1 đến 20 người</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <TkvIconButton
                        icon="minus"
                        label="Giảm số người"
                        onClick={() => setHouseholdSize((n) => Math.max(1, n - 1))}
                      />
                      <span className="min-w-[68px] text-center tabular-nums text-base font-extrabold text-[var(--tkv-ink,#152E2C)]">
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
                    Tiếp tục
                  </button>
                </div>
                <p className="text-center text-xs text-[var(--tkv-ink-muted,#52706A)]">
                  Chỉ dùng để tính khẩu phần món ăn — có thể thay đổi bất cứ lúc nào trong phần Cài đặt.
                </p>
              </div>
            )}

            {/* O04 — Khẩu vị của bạn (aligned 1:1 with U02 FoodPreferencesPage) */}
            {step === 'preferences' && (
              <div className="space-y-5">
                <div className="text-center space-y-2">
                  <h1 className="tkv-heading text-2xl sm:text-[1.85rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
                    Khẩu vị của bạn
                  </h1>
                  <p className="text-sm sm:text-base text-[var(--tkv-ink-soft,#3C5954)]">
                    Chọn nền ẩm thực, thói quen ăn uống và mức cay phù hợp với gia đình.
                  </p>
                </div>

                <fieldset className="space-y-2.5">
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
                            'tkv-focusable min-h-[42px] px-3.5 py-1.5 rounded-full text-sm font-bold border transition-colors',
                            active
                              ? 'bg-[var(--tkv-sage,#196149)] text-white border-[var(--tkv-sage,#196149)] shadow-xs'
                              : 'bg-white text-[var(--tkv-ink,#152E2C)] border-[var(--tkv-border,#DCE6DE)] hover:border-[var(--tkv-border-strong,#B8CABE)]',
                          )}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="space-y-2.5">
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
                            'tkv-focusable min-h-[42px] px-3 py-1.5 rounded-full text-xs sm:text-sm font-bold border transition-colors',
                            active
                              ? 'bg-[var(--tkv-primary,#196149)] text-white border-[var(--tkv-primary,#196149)] shadow-xs'
                              : 'bg-white text-[var(--tkv-ink,#152E2C)] border-[var(--tkv-border,#DCE6DE)] hover:border-[var(--tkv-border-strong,#B8CABE)]',
                          )}
                        >
                          {sp.label}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <p className="text-center text-xs text-[var(--tkv-ink-muted,#52706A)]">
                  Lưu ý an toàn: nhãn khẩu vị hỗ trợ gợi ý món ăn, không thay thế việc kiểm tra thành phần gây dị ứng y khoa trên từng nguyên liệu.
                </p>

                <div className="flex gap-2.5">
                  <button type="button" className={secondaryBtnClass} onClick={() => goToStep('household')}>
                    Quay lại
                  </button>
                  <button type="button" className={clsx(primaryBtnClass, 'flex-1')} onClick={() => goToStep('start')}>
                    Tiếp tục
                  </button>
                </div>
              </div>
            )}

            {/* O05 — Khởi tạo căn bếp */}
            {step === 'start' && (
              <div className="space-y-5">
                <div className="text-center space-y-2">
                  <h1 className="tkv-heading text-2xl sm:text-[1.85rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
                    Khởi tạo căn bếp
                  </h1>
                  <p className="text-sm sm:text-base text-[var(--tkv-ink-soft,#3C5954)]">
                    Thêm nguyên liệu bằng tay, quét ảnh hoặc khám phá món trước.
                  </p>
                </div>

                <div className="space-y-2.5" role="radiogroup" aria-label="Hành động đầu tiên khi vào bếp">
                  {STARTER_PATHS.map((sp) => {
                    const selected = starterChoice === sp.id;
                    return (
                      <button
                        key={sp.id}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setStarterChoice(sp.id)}
                        className={clsx(
                          'tkv-focusable w-full p-4 rounded-2xl border text-left flex items-center justify-between gap-3.5 transition-colors',
                          selected
                            ? 'bg-[var(--tkv-accent-soft,#FFF0E9)] border-[var(--tkv-primary,#196149)] ring-1 ring-[var(--tkv-primary,#196149)]'
                            : 'bg-white border-[var(--tkv-border,#DCE6DE)] hover:border-[var(--tkv-border-strong,#B8CABE)]',
                        )}
                      >
                        <div className="flex items-center gap-3.5">
                          <span className="w-11 h-11 rounded-xl bg-white border border-[var(--tkv-border,#DCE6DE)] text-[var(--tkv-primary,#196149)] flex items-center justify-center shrink-0">
                            <VNextIcon name={sp.icon} size={20} />
                          </span>
                          <div>
                            <p className="tkv-heading text-base font-extrabold text-[var(--tkv-ink,#152E2C)]">{sp.title}</p>
                            <p className="text-xs text-[var(--tkv-ink-soft,#3C5954)]">{sp.subtitle}</p>
                          </div>
                        </div>
                        {selected && (
                          <span className="w-2.5 h-2.5 rounded-full bg-[var(--tkv-primary,#196149)] shrink-0" aria-hidden="true" />
                        )}
                      </button>
                    );
                  })}
                </div>

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
                    {isSaving ? 'Đang lưu…' : 'Tiếp tục'}
                  </button>
                </div>
              </div>
            )}

            {/* O06 — Sẵn sàng vào bếp (Server-Confirmed Completion) */}
            {step === 'ready' && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h1 className="tkv-heading text-2xl sm:text-[1.85rem] font-extrabold text-[var(--tkv-ink,#152E2C)]">
                    Sẵn sàng vào bếp
                  </h1>
                  <p className="text-sm sm:text-base text-[var(--tkv-ink-soft,#3C5954)]">
                    {serverConfirmed
                      ? 'Thiết lập ban đầu đã được máy chủ xác nhận, hãy bắt đầu việc đầu tiên.'
                      : 'Xác nhận lưu thiết lập với máy chủ trước khi vào căn bếp của bạn.'}
                  </p>
                </div>

                <div className="rounded-2xl bg-[var(--tkv-sage-soft,#E7F4EC)] border border-[var(--tkv-sage-border,#BDE0CC)] p-5 text-center space-y-2">
                  <span className="w-12 h-12 mx-auto rounded-2xl bg-[var(--tkv-sage,#196149)] text-white flex items-center justify-center">
                    <VNextIcon name="check" size={22} />
                  </span>
                  <p className="tkv-heading text-base sm:text-lg font-extrabold text-[var(--tkv-ink,#152E2C)]">
                    Bạn đã sẵn sàng bắt đầu hành trình bếp thông minh.
                  </p>
                  <p className="text-xs text-[var(--tkv-ink-soft,#3C5954)]">
                    Khẩu phần mặc định: <strong className="tabular-nums text-[var(--tkv-ink,#152E2C)]">{householdSize} người</strong> · Có thể chỉnh lại bất kỳ lúc nào tại mục Cài đặt.
                  </p>
                </div>

                {serverConfirmed ? (
                  <button type="button" onClick={handleEnterTakolio} className={clsx(primaryBtnClass, 'w-full')}>
                    Vào Takolio
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
          </TkvSurface>

          {/* Desktop Live Scaling & Summary Side Panel */}
          <div className="hidden lg:block lg:col-span-5">
            <div className="rounded-[24px] bg-gradient-to-br from-[var(--tkv-linen-from,#FFFFFF)] to-[var(--tkv-surface-muted,#E7F4EC)] border border-[var(--tkv-border,#DCE6DE)] p-7 space-y-4 shadow-soft">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[var(--tkv-surface-mint,#E7F4EC)] border border-[var(--tkv-border-mint,#BDE0CC)] text-sm font-semibold text-[var(--tkv-primary,#196149)]">
                <span className="w-2 h-2 rounded-full bg-[var(--tkv-primary,#196149)]" aria-hidden="true" />
                <span>Khẩu phần hiện chọn: {householdSize} người</span>
              </div>
              <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink,#152E2C)]">
                Định lượng tự động nhân chia theo bàn ăn nhà bạn
              </h2>
              <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)] leading-relaxed">
                Ví dụ với món <strong className="font-semibold text-[var(--tkv-ink,#152E2C)]">Thịt kho tàu nước dừa trứng</strong> chuẩn 4 người, Takolio quy đổi sang khẩu phần <strong className="font-semibold text-[var(--tkv-ink,#152E2C)]">{householdSize} người</strong>:
              </p>
              <div className="bg-white rounded-2xl p-4 border border-[var(--tkv-border,#DCE6DE)] space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--tkv-ink-soft,#3C5954)]">Thịt ba chỉ</span>
                  <strong className="font-semibold text-[var(--tkv-ink,#152E2C)]">{Math.round((400 / 4) * householdSize)} g</strong>
                </div>
                <div className="flex justify-between border-t border-[var(--tkv-border,#DCE6DE)] pt-2">
                  <span className="text-[var(--tkv-ink-soft,#3C5954)]">Trứng gà ta</span>
                  <strong className="font-semibold text-[var(--tkv-ink,#152E2C)]">{Math.max(1, Math.round((4 / 4) * householdSize))} quả</strong>
                </div>
                <div className="flex justify-between border-t border-[var(--tkv-border,#DCE6DE)] pt-2">
                  <span className="text-[var(--tkv-ink-soft,#3C5954)]">Nước mắm Phú Quốc</span>
                  <strong className="font-semibold text-[var(--tkv-ink,#152E2C)]">{Math.round((40 / 4) * householdSize)} ml</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
