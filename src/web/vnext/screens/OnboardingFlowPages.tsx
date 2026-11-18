import React, { useEffect, useRef, useState } from 'react';
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
import { useBrandDirection, vnextHref } from '../feature';
import { useVNextSeo } from '../lib/seo';
import { BrandLockup, MascotIllustration } from '../components/VNextMedia';
import { TkvButton, TkvIconButton, TkvSurface } from '../components/Primitives';
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

const TASTE_CHIPS = [
  { id: 'vietnamese', kind: 'cuisine', label: 'Món Việt' },
  { id: 'mild', kind: 'spicy', label: 'Ít cay' },
  { id: 'more_greens', kind: 'restriction', label: 'Nhiều rau' },
  { id: 'quick_meals', kind: 'restriction', label: 'Nấu nhanh' },
  { id: 'japanese', kind: 'cuisine', label: 'Món Nhật thanh vị' },
  { id: 'vegetarian', kind: 'restriction', label: 'Ăn chay linh hoạt' },
] as const;

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

/**
 * Unified Gate G04 6-Step Onboarding Flow (`O01–O06`).
 * Preserves 100% of server completion & concurrency invariants:
 * - `O01` Welcome -> `O02` Goals (`primaryGoal` client-scoped) -> `O03` Household (`1..20`)
 *   -> `O04` Taste & Restrictions -> `O05` Kitchen Starter (executes authoritative `familyPreferencesApi.save`
 *   + `api.completeOnboarding`) -> `O06` Ready (only after server confirms completion).
 */
export const VNextOnboardingFlow: React.FC = () => {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const [direction] = useBrandDirection(search);
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
  const [primaryGoal, setPrimaryGoal] = useState<'fridge' | 'today' | 'week'>(
    auth.primaryGoal === 'week' ? 'week' : auth.primaryGoal === 'fridge' ? 'fridge' : 'today',
  );
  const [householdSize, setHouseholdSize] = useState<number>(() =>
    Number.isInteger(auth.householdSize) && auth.householdSize >= 1 && auth.householdSize <= 20
      ? auth.householdSize
      : 2,
  );
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(() =>
    auth.favoriteCuisines.length > 0 ? auth.favoriteCuisines : ['vietnamese'],
  );
  const [spicyLevel, setSpicyLevel] = useState<'none' | 'mild' | 'medium' | 'hot'>(() =>
    auth.spicyLevel === 'none' || auth.spicyLevel === 'mild' || auth.spicyLevel === 'hot'
      ? auth.spicyLevel
      : 'medium',
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

  const goToStep = (next: OnboardingStepKey) => {
    setErrorMessage(null);
    navigate(vnextHref(`/onboarding/${next}`));
  };

  const toggleTasteChip = (chip: (typeof TASTE_CHIPS)[number]) => {
    if (chip.kind === 'cuisine') {
      setSelectedCuisines((prev) =>
        prev.includes(chip.id) ? prev.filter((x) => x !== chip.id) : [...prev, chip.id],
      );
    } else if (chip.kind === 'spicy') {
      setSpicyLevel((prev) => (prev === 'mild' ? 'medium' : 'mild'));
    } else {
      setRestrictions((prev) =>
        prev.includes(chip.id) ? prev.filter((x) => x !== chip.id) : [...prev, chip.id],
      );
    }
  };

  const commitServerOnboarding = async (skipDirectlyToApp: boolean) => {
    setErrorMessage(null);
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
        const baseFamily = family ?? familyQuery.data?.preferences ?? DEFAULT_FAMILY_PREFERENCES;
        const baseRev = draftRevision ?? familyQuery.data?.revision ?? 0;
        const saved = await familyPreferencesApi.save(baseRev, {
          ...baseFamily,
          householdSize,
        });
        assertCurrent();
        queryClient.setQueryData(key, saved);
        setDraftRevision(saved.revision);

        const result = await api.completeOnboarding(prefs);
        if (!result.success || result.onboardingCompleted !== true) {
          throw new Error('Máy chủ chưa xác nhận hoàn tất thiết lập.');
        }
      }
      assertCurrent();
      if (!isCurrent()) return;
      setServerConfirmed(true);

      if (skipDirectlyToApp) {
        auth.setOnboardingData({ ...prefs, primaryGoal });
        const dest =
          primaryGoal === 'week'
            ? isMealPlannerEnabled()
              ? '/planner/new'
              : '/week/setup'
            : '/';
        navigate(vnextHref(dest), { replace: true });
      } else {
        // Keep `auth.isOnboarded` false while showing O06 `/onboarding/ready` inside `/onboarding/*` route guard,
        // then finalize `setOnboardingData` when clicking "Vào Takolio"!
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

  return (
    <div className="tkv-root min-h-dvh flex flex-col" data-tkv-direction={direction} data-tkv-screen={screenId}>
      <a href="#tkv-onb-main" className="tkv-skip-link">
        Đến bước thiết lập căn bếp
      </a>

      <main
        id="tkv-onb-main"
        tabIndex={-1}
        className="flex-1 max-w-[980px] w-full mx-auto px-4 sm:px-6 py-5 sm:py-10 flex items-center justify-center"
      >
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <TkvSurface className="lg:col-span-7 p-6 sm:p-8 space-y-6">
            {/* Top Bar + Skip */}
            <div className="flex items-center justify-between gap-3">
              <Link to={vnextHref('/landing')} className="tkv-focusable rounded-xl py-1">
                <BrandLockup direction={direction} />
              </Link>
              {step !== 'ready' && (
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => void commitServerOnboarding(true)}
                  className="tkv-focusable min-h-[44px] px-3 rounded-xl text-sm font-bold text-[var(--tkv-primary)] hover:bg-[var(--tkv-surface-mint)]"
                >
                  Bỏ qua
                </button>
              )}
            </div>

            {/* 6-Segment Progress Bar matching O01..O06 wireframes */}
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
                    'h-2 rounded-full transition-colors',
                    idx <= stepNum ? 'bg-[var(--tkv-primary)]' : 'bg-[var(--tkv-surface-mint)]',
                  )}
                />
              ))}
            </div>

            {/* Mascot Medallion */}
            <div className="flex justify-center pt-1">
              <div className="w-32 h-32 rounded-full bg-[var(--tkv-surface-mint)] p-2.5 flex items-center justify-center border border-[var(--tkv-border)]">
                <MascotIllustration
                  pose={step === 'ready' ? 'achievement' : step === 'welcome' ? 'welcome' : 'guide'}
                  size={104}
                />
              </div>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-[var(--tkv-surface-coral)] border border-[var(--tkv-danger)]/35 text-sm font-semibold text-[var(--tkv-danger)] flex items-center gap-2"
              >
                <VNextIcon name="error" size={18} />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* O01 — Chào mừng đến Takolio */}
            {step === 'welcome' && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h1 className="tkv-heading text-2xl sm:text-[1.85rem] font-extrabold text-[var(--tkv-ink)]">
                    Chào mừng đến Takolio
                  </h1>
                  <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)]">
                    Sắp xếp căn bếp thông minh theo cách riêng của bạn.
                  </p>
                </div>

                <div className="rounded-2xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] p-4 flex items-center gap-3.5">
                  <span className="w-11 h-11 rounded-2xl bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] flex items-center justify-center shrink-0">
                    <VNextIcon name="sparkles" size={22} />
                  </span>
                  <div>
                    <p className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">
                      Tự động gợi ý cho bữa hôm nay
                    </p>
                    <p className="text-xs sm:text-sm text-[var(--tkv-ink-secondary)]">
                      Bắt đầu đơn giản, nâng cao dần theo thói quen gia đình
                    </p>
                  </div>
                </div>

                <TkvButton variant="primary" size="lg" fullWidth onClick={() => goToStep('goals')}>
                  Tiếp tục
                </TkvButton>
              </div>
            )}

            {/* O02 — Mục tiêu sử dụng */}
            {step === 'goals' && (
              <div className="space-y-5">
                <div className="text-center space-y-2">
                  <h1 className="tkv-heading text-2xl sm:text-[1.85rem] font-extrabold text-[var(--tkv-ink)]">
                    Mục tiêu sử dụng
                  </h1>
                  <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)]">
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
                        onClick={() => setPrimaryGoal(g.id)}
                        className={clsx(
                          'tkv-focusable w-full p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-colors',
                          selected
                            ? 'bg-[var(--tkv-surface-mint)] border-[var(--tkv-primary)] ring-1 ring-[var(--tkv-primary)]'
                            : 'bg-white border-[var(--tkv-border)] hover:border-[var(--tkv-primary)]',
                        )}
                      >
                        <span className="w-11 h-11 rounded-2xl bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] flex items-center justify-center shrink-0">
                          <VNextIcon name={g.icon} size={20} />
                        </span>
                        <div>
                          <p className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">{g.title}</p>
                          <p className="text-xs text-[var(--tkv-ink-secondary)]">{g.subtitle}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2.5">
                  <TkvButton variant="secondary" size="lg" onClick={() => goToStep('welcome')}>
                    Quay lại
                  </TkvButton>
                  <TkvButton variant="primary" size="lg" fullWidth onClick={() => goToStep('household')}>
                    Tiếp tục
                  </TkvButton>
                </div>
              </div>
            )}

            {/* O03 — Gia đình và khẩu phần */}
            {step === 'household' && (
              <div className="space-y-5">
                <div className="text-center space-y-2">
                  <h1 className="tkv-heading text-2xl sm:text-[1.85rem] font-extrabold text-[var(--tkv-ink)]">
                    Gia đình và khẩu phần
                  </h1>
                  <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)]">
                    Chọn số người ăn thường xuyên để Takolio quy đổi lượng nguyên liệu và khẩu phần hợp lý.
                  </p>
                </div>

                <fieldset className="space-y-3">
                  <legend className="text-sm font-extrabold text-[var(--tkv-ink)] mb-2">
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
                            'tkv-focusable min-h-[56px] rounded-2xl tkv-heading text-lg font-extrabold border transition-colors',
                            active
                              ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] shadow-sm'
                              : 'bg-[var(--tkv-surface-mint)]/60 text-[var(--tkv-primary)] border-[var(--tkv-border)] hover:border-[var(--tkv-primary)]',
                          )}
                        >
                          {b === 5 ? '5+' : b}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {householdSize >= 5 && (
                  <div className="p-4 rounded-2xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[var(--tkv-ink)]">Số người cụ thể (5–20 người)</p>
                      <p className="text-xs text-[var(--tkv-ink-secondary)]">Máy chủ lưu chính xác từ 1 đến 20 người</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <TkvIconButton
                        icon="minus"
                        label="Giảm số người"
                        onClick={() => setHouseholdSize((n) => Math.max(1, n - 1))}
                      />
                      <span className="min-w-[56px] text-center tkv-heading text-lg font-extrabold text-[var(--tkv-primary)]">
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
                  <TkvButton variant="secondary" size="lg" onClick={() => goToStep('goals')}>
                    Quay lại
                  </TkvButton>
                  <TkvButton
                    variant="primary"
                    size="lg"
                    fullWidth
                    onClick={() => goToStep('preferences')}
                    data-testid="o03-continue-btn"
                  >
                    Tiếp tục
                  </TkvButton>
                </div>
                <p className="text-center text-xs text-[var(--tkv-ink-muted)]">
                  Chỉ dùng để tính khẩu phần món ăn — không tự tạo tài khoản thành viên giả định (U06).
                </p>
              </div>
            )}

            {/* O04 — Khẩu vị của bạn */}
            {step === 'preferences' && (
              <div className="space-y-5">
                <div className="text-center space-y-2">
                  <h1 className="tkv-heading text-2xl sm:text-[1.85rem] font-extrabold text-[var(--tkv-ink)]">
                    Khẩu vị của bạn
                  </h1>
                  <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)]">
                    Chọn món yêu thích và thói quen ăn uống.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5 justify-center">
                  {TASTE_CHIPS.map((chip) => {
                    const active =
                      chip.kind === 'cuisine'
                        ? selectedCuisines.includes(chip.id)
                        : chip.kind === 'spicy'
                          ? spicyLevel === 'mild'
                          : restrictions.includes(chip.id);
                    return (
                      <button
                        key={chip.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleTasteChip(chip)}
                        className={clsx(
                          'tkv-focusable min-h-[44px] px-4 py-2 rounded-full text-sm font-bold border transition-colors',
                          active
                            ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)]'
                            : 'bg-white text-[var(--tkv-ink)] border-[var(--tkv-border)] hover:border-[var(--tkv-primary)]',
                        )}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>

                <p className="text-center text-xs text-[var(--tkv-ink-muted)]">
                  Lưu ý an toàn: nhãn khẩu vị hỗ trợ gợi ý món ăn, không thay thế việc kiểm tra thành phần gây dị ứng y khoa trên từng nguyên liệu.
                </p>

                <div className="flex gap-2.5">
                  <TkvButton variant="secondary" size="lg" onClick={() => goToStep('household')}>
                    Quay lại
                  </TkvButton>
                  <TkvButton variant="primary" size="lg" fullWidth onClick={() => goToStep('start')}>
                    Tiếp tục
                  </TkvButton>
                </div>
              </div>
            )}

            {/* O05 — Khởi tạo căn bếp */}
            {step === 'start' && (
              <div className="space-y-5">
                <div className="text-center space-y-2">
                  <h1 className="tkv-heading text-2xl sm:text-[1.85rem] font-extrabold text-[var(--tkv-ink)]">
                    Khởi tạo căn bếp
                  </h1>
                  <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)]">
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
                          'tkv-focusable w-full p-4 rounded-2xl border text-left flex items-center gap-3.5 transition-colors',
                          selected
                            ? 'bg-[var(--tkv-surface-mint)] border-[var(--tkv-primary)] ring-1 ring-[var(--tkv-primary)]'
                            : 'bg-white border-[var(--tkv-border)] hover:border-[var(--tkv-primary)]',
                        )}
                      >
                        <span className="w-11 h-11 rounded-2xl bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] flex items-center justify-center shrink-0">
                          <VNextIcon name={sp.icon} size={20} />
                        </span>
                        <div>
                          <p className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">{sp.title}</p>
                          <p className="text-xs text-[var(--tkv-ink-secondary)]">{sp.subtitle}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex gap-2.5">
                  <TkvButton variant="secondary" size="lg" onClick={() => goToStep('preferences')}>
                    Quay lại
                  </TkvButton>
                  <TkvButton
                    variant="primary"
                    size="lg"
                    fullWidth
                    isLoading={isSaving}
                    onClick={() => void commitServerOnboarding(false)}
                  >
                    Tiếp tục
                  </TkvButton>
                </div>
              </div>
            )}

            {/* O06 — Sẵn sàng vào bếp (Server-Confirmed Completion) */}
            {step === 'ready' && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h1 className="tkv-heading text-2xl sm:text-[1.85rem] font-extrabold text-[var(--tkv-ink)]">
                    Sẵn sàng vào bếp
                  </h1>
                  <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)]">
                    {serverConfirmed
                      ? 'Thiết lập ban đầu đã được máy chủ xác nhận, hãy bắt đầu việc đầu tiên.'
                      : 'Xác nhận lưu thiết lập với máy chủ trước khi vào căn bếp của bạn.'}
                  </p>
                </div>

                <div className="rounded-2xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border)] p-5 text-center space-y-2">
                  <span className="w-12 h-12 mx-auto rounded-2xl bg-white text-[var(--tkv-primary)] flex items-center justify-center shadow-xs">
                    <VNextIcon name="check" size={24} />
                  </span>
                  <p className="tkv-heading text-base sm:text-lg font-extrabold text-[var(--tkv-primary)]">
                    Bạn đã sẵn sàng bắt đầu hành trình bếp thông minh.
                  </p>
                  <p className="text-xs text-[var(--tkv-ink-secondary)]">
                    Khẩu phần mặc định: <strong>{householdSize} người</strong> · Có thể chỉnh lại bất kỳ lúc nào tại mục Cài đặt.
                  </p>
                </div>

                {serverConfirmed ? (
                  <TkvButton variant="primary" size="lg" fullWidth onClick={handleEnterTakolio}>
                    Vào Takolio
                  </TkvButton>
                ) : (
                  <TkvButton
                    variant="primary"
                    size="lg"
                    fullWidth
                    isLoading={isSaving}
                    onClick={() => void commitServerOnboarding(true)}
                  >
                    Xác nhận lưu & Vào Takolio
                  </TkvButton>
                )}
              </div>
            )}
          </TkvSurface>

          {/* Desktop Live Scaling & Summary Side Panel */}
          <div className="hidden lg:block lg:col-span-5">
            <TkvSurface tone="mint" className="p-7 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white text-xs font-extrabold text-[var(--tkv-primary)]">
                <VNextIcon name="users" size={14} />
                <span>Khẩu phần hiện chọn: {householdSize} người</span>
              </div>
              <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink)]">
                Định lượng tự động nhân chia theo bàn ăn nhà bạn
              </h2>
              <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">
                Ví dụ với món <strong>Thịt kho tàu nước dừa trứng</strong> chuẩn 4 người, Takolio quy đổi sang khẩu phần <strong>{householdSize} người</strong>:
              </p>
              <div className="bg-white rounded-2xl p-4 border border-[var(--tkv-border)] space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-[var(--tkv-ink-secondary)]">Thịt ba chỉ</span>
                  <strong className="text-[var(--tkv-ink)]">{Math.round((400 / 4) * householdSize)} g</strong>
                </div>
                <div className="flex justify-between border-t border-[var(--tkv-border)] pt-2">
                  <span className="text-[var(--tkv-ink-secondary)]">Trứng gà ta</span>
                  <strong className="text-[var(--tkv-ink)]">{Math.max(1, Math.round((4 / 4) * householdSize))} quả</strong>
                </div>
                <div className="flex justify-between border-t border-[var(--tkv-border)] pt-2">
                  <span className="text-[var(--tkv-ink-secondary)]">Nước mắm Phú Quốc</span>
                  <strong className="text-[var(--tkv-ink)]">{Math.round((40 / 4) * householdSize)} ml</strong>
                </div>
              </div>
            </TkvSurface>
          </div>
        </div>
      </main>
    </div>
  );
};
