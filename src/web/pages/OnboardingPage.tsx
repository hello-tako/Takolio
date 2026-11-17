import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Calendar, Check, FastForward, Sparkles, Users, Utensils } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import { ApiError, guardPrivateSession, isOffline } from '../services/http';
import { isMealPlannerEnabled } from '../features/planner/feature';
import { isMealCompositionEnabled } from '../features/planner/composition';
import { FamilyPreferenceSummary } from '../features/family/FamilyPreferenceSummary';
import { FamilyPreferenceFields } from '../features/family/FamilyPreferenceFields';
import {
  useFamilyPreferences,
  familyPreferencesKey,
} from '../features/family/useFamilyPreferences';
import {
  DEFAULT_FAMILY_PREFERENCES,
  familyPreferencesApi,
  type FamilyPreferences,
} from '../services/family-preferences';
import { InlineError, InlineLoading } from '../components/common/AsyncState';
import { capturePrivateSession, isOfflineGuestSession } from '../lib/private-session';
import { api } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';
import { OnboardingMamCom3D } from '../components/3d';
import {
  ActionButton,
  AtelierBadge,
  BentoCard,
} from '../design-system/v4/AtelierPrimitives';
import {
  FlameHighIcon,
  FlameLowIcon,
  FlameMediumIcon,
  FlameOffIcon,
  TakolioWordmarkLockup,
} from '../design-system/icons';

const ONBOARDING_PATHS = {
  1: '/onboarding/household',
  2: '/onboarding/preferences',
  3: '/onboarding/goals',
} as const;

const CUISINE_TAGS = [
  { id: 'vietnamese', label: 'Việt Nam' },
  { id: 'korean', label: 'Hàn Quốc' },
  { id: 'japanese', label: 'Nhật Bản' },
  { id: 'italian', label: 'Ý' },
  { id: 'chinese', label: 'Trung Hoa' },
  { id: 'thai', label: 'Thái Lan' },
] as const;

const RESTRICTION_TAGS = [
  { id: 'beef', label: 'Thịt bò' },
  { id: 'seafood', label: 'Hải sản' },
  { id: 'peanuts', label: 'Đậu phộng' },
  { id: 'spicy', label: 'Đồ cay' },
  { id: 'mushroom', label: 'Nấm' },
  { id: 'onion_garlic', label: 'Hành tỏi' },
  { id: 'milk', label: 'Sữa' },
  { id: 'gluten', label: 'Gluten' },
  { id: 'other', label: 'Khác' },
] as const;

const SPICY_LABELS = {
  none: 'Không ăn cay',
  mild: 'Ít cay',
  medium: 'Cay vừa',
  hot: 'Cay nhiều',
} as const;

const SPICY_NUMERIC: Record<keyof typeof SPICY_LABELS, number> = {
  none: 0,
  mild: 1,
  medium: 2,
  hot: 3,
};

// Client-only planning goal: steers post-onboarding navigation and is never sent to `/preferences`.
const GOAL_OPTIONS = [
  {
    id: 'today',
    title: 'Gợi ý bữa tối nay từ tủ lạnh',
    description: 'Xem ngay các món nấu được liền từ nguyên liệu đang có sẵn.',
    icon: Utensils,
  },
  {
    id: 'week',
    title: 'Lập thực đơn Mâm cơm cả tuần',
    description: 'Sắp xếp bữa ăn 7 ngày cân đối và tạo danh sách đi chợ gọn nhẹ.',
    icon: Calendar,
  },
  {
    id: 'both',
    title: 'Kết hợp linh hoạt & Quét tủ lạnh AI ngay',
    description: 'Vào thẳng gian bếp chính, quét nguyên liệu và chủ động cả tuần.',
    icon: Sparkles,
  },
] as const;

// Visible household choices; 5 doubles as the "5+" bucket. Server truth is 1..20.
const HOUSEHOLD_CHOICES = [1, 2, 3, 4, 5] as const;
const HOUSEHOLD_PLUS_CHOICE = 5;

const SEAT_SUBTITLES: Record<(typeof HOUSEHOLD_CHOICES)[number], string> = {
  1: 'Gọn gàng 1 mình',
  2: 'Cặp đôi ấm cúng',
  3: 'Gia đình nhỏ',
  4: 'Mâm tròn 4 ghế',
  5: 'Đại gia đình đông vui',
};

type OnboardingStep = keyof typeof ONBOARDING_PATHS;
type SpicyLevel = keyof typeof SPICY_LABELS;
type PrimaryGoal = (typeof GOAL_OPTIONS)[number]['id'];

function supportedSpicyLevel(value: string): SpicyLevel {
  return Object.prototype.hasOwnProperty.call(SPICY_LABELS, value)
    ? (value as SpicyLevel)
    : 'medium';
}

function supportedPrimaryGoal(value: string | undefined): PrimaryGoal {
  return GOAL_OPTIONS.some((goal) => goal.id === value) ? (value as PrimaryGoal) : 'both';
}

function householdSizeLabel(size: number): string {
  return size >= HOUSEHOLD_PLUS_CHOICE ? '5 người trở lên' : `${size} người`;
}

function stepFromPath(pathname: string): OnboardingStep | null {
  const match = (Object.entries(ONBOARDING_PATHS) as Array<[`${OnboardingStep}`, string]>).find(
    ([, path]) => path === pathname,
  );
  return match ? (Number(match[0]) as OnboardingStep) : null;
}

export const OnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const auth = useAuthStore();
  const client = useQueryClient();
  const familyQuery = useFamilyPreferences();
  const [family, setFamily] = useState<FamilyPreferences | null>(() =>
    isOfflineGuestSession() ? DEFAULT_FAMILY_PREFERENCES : null,
  );
  const [draftRevision, setDraftRevision] = useState<number | null>(null);
  const [profileConflict, setProfileConflict] = useState(false);
  const householdSizeEdited = useRef(false);

  useEffect(() => {
    if (familyQuery.data && !family) {
      setFamily(familyQuery.data.preferences);
      setDraftRevision(familyQuery.data.revision);
      if (familyQuery.data.revision > 0 && !householdSizeEdited.current) {
        setHouseholdSize(familyQuery.data.preferences.householdSize);
      }
      setSelectedCuisines([
        ...familyQuery.data.preferences.preferredCuisines,
        ...auth.favoriteCuisines.filter((value) => !CUISINE_TAGS.some((tag) => tag.id === value)),
      ]);
    }
  }, [familyQuery.data, family, auth.favoriteCuisines]);

  const step = stepFromPath(pathname);
  const [householdSize, setHouseholdSize] = useState(() => {
    const stored = auth.householdSize;
    return Number.isInteger(stored) && stored >= 1 ? stored : 2;
  });
  const [hasYoungChildren, setHasYoungChildren] = useState(false);
  const [hasElderly, setHasElderly] = useState(false);
  const [spicyLevel, setSpicyLevel] = useState<SpicyLevel>(() =>
    supportedSpicyLevel(auth.spicyLevel),
  );
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(() => [
    ...auth.favoriteCuisines,
  ]);
  const [restrictions] = useState<string[]>(() => [...auth.dietaryRestrictions]);
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal>(() =>
    supportedPrimaryGoal(auth.primaryGoal),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSkipping, setIsSkipping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!step) return <Navigate to={ONBOARDING_PATHS[1]} replace />;

  const resolveDestination = (goal: PrimaryGoal): string => {
    if (goal !== 'week') return '/';
    // Prevent offline-only guests from hitting an online-only weekly setup wall.
    if (isOfflineGuestSession()) return '/';
    return isMealPlannerEnabled() && isMealCompositionEnabled() ? '/planner/new' : '/week/setup';
  };

  const commitOnboarding = async (overrideGoal?: PrimaryGoal) => {
    const isCurrent = capturePrivateSession();
    const chosenGoal = overrideGoal ?? primaryGoal;
    setError(null);
    if (overrideGoal) setIsSkipping(true);
    else setIsSaving(true);

    const preferences = {
      householdSize,
      spicyLevel,
      favoriteCuisines: selectedCuisines,
      dietaryRestrictions: restrictions,
    };

    try {
      const assertCurrent = guardPrivateSession();
      const key = familyPreferencesKey();
      if (!isOfflineGuestSession()) {
        if (profileConflict) throw new Error('Family preferences conflict');
        let workingFamily = family;
        let workingRevision = draftRevision;

        // Allow 1-click quick skip even on Step 1 before background query settles.
        if ((!workingFamily || workingRevision === null) && overrideGoal) {
          try {
            const loaded = await familyPreferencesApi.get();
            assertCurrent();
            workingFamily = loaded.preferences;
            workingRevision = loaded.revision;
          } catch (loadErr) {
            if (!isOffline(loadErr)) throw loadErr;
          }
        }

        if (!workingFamily || workingRevision === null) {
          throw new Error('Family preferences not ready');
        }

        const saved = await familyPreferencesApi.save(workingRevision, {
          ...workingFamily,
          householdSize,
        });
        assertCurrent();
        client.setQueryData(key, saved);
        setDraftRevision(saved.revision);
        const result = await api.completeOnboarding(preferences);
        if (!result.success || result.onboardingCompleted !== true) {
          throw new Error('Onboarding completion was not confirmed');
        }
      }
      assertCurrent();
      auth.setOnboardingData({ ...preferences, primaryGoal: chosenGoal });
      navigate(resolveDestination(chosenGoal), { replace: true });
    } catch (failure) {
      if (!isCurrent()) return;
      if (failure instanceof ApiError && failure.code === 'REVISION_CONFLICT') {
        setProfileConflict(true);
        setError('Thói quen vừa thay đổi trên thiết bị khác. Tải lại và xem trước khi hoàn tất.');
      } else {
        setError('Chưa thể lưu sở thích. Vui lòng kiểm tra kết nối và thử lại.');
      }
    } finally {
      if (isCurrent()) {
        setIsSaving(false);
        setIsSkipping(false);
      }
    }
  };

  const mealStyleBadge =
    family?.mealStyle === 'quick'
      ? 'Nhanh gọn 25p'
      : family?.mealStyle === 'one_pot'
        ? 'Món một nồi'
        : 'Mâm cơm 3–4 món';

  return (
    <main className="min-h-dvh bg-tk-canvas text-tk-ink px-4 sm:px-6 py-5 lg:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Top Studio Bar with 1-Click Quick Skip */}
        <header className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] bg-white/85 backdrop-blur border border-tk-stone/80 px-4 sm:px-6 py-3 shadow-xs">
          <div className="flex items-center gap-3">
            <TakolioWordmarkLockup size={28} tone="ink" />
            <span className="rounded-pill border border-tk-jade/25 bg-tk-jade-soft px-3 py-1 text-xs font-extrabold text-tk-jade-deep tk-tabular">
              {step} / 3
            </span>
          </div>

          <button
            type="button"
            disabled={isSaving || isSkipping || profileConflict}
            onClick={() => void commitOnboarding('today')}
            className="tap-target inline-flex items-center gap-1.5 rounded-xl border border-tk-stone bg-tk-canvas hover:bg-tk-sunken px-3.5 py-2 text-xs font-extrabold text-tk-secondary hover:text-tk-ink transition-tap cursor-pointer disabled:opacity-50"
          >
            <FastForward className="w-3.5 h-3.5 text-tk-flame" aria-hidden="true" />
            <span>
              {isSkipping ? 'Đang mở bếp…' : 'Thiết lập nhanh mặc định (Bỏ qua)'}
            </span>
          </button>
        </header>

        {/* Progress Bar */}
        <div
          className="grid grid-cols-3 gap-2.5"
          role="progressbar"
          aria-label={`Bước ${step} trên 3`}
          aria-valuemin={1}
          aria-valuemax={3}
          aria-valuenow={step}
          aria-valuetext={`Bước ${step} trên 3`}
        >
          {[1, 2, 3].map((item) => (
            <span
              key={item}
              aria-hidden="true"
              className={clsx(
                'h-2 rounded-pill transition-colors',
                item <= step ? 'bg-tk-jade' : 'bg-tk-stone',
              )}
            />
          ))}
        </div>

        {/* 2-Column Spatial Culinary Studio */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Sticky Live 3D Mâm Cơm Stage */}
          <aside
            aria-label="Mô hình mâm cơm gia đình 3D trực tiếp"
            className="lg:col-span-5 lg:sticky lg:top-6 space-y-3"
          >
            <OnboardingMamCom3D
              householdSize={householdSize}
              spicyLevel={SPICY_NUMERIC[spicyLevel]}
              mealStyle={mealStyleBadge}
              step={step}
              className="min-h-[270px] sm:min-h-[340px]"
            />

            <BentoCard tone="ceramic" padding="sm" className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-extrabold text-tk-ink">
                  Mâm cơm {householdSizeLabel(householdSize)} · {SPICY_LABELS[spicyLevel]}
                </span>
                <AtelierBadge tone="jade">{mealStyleBadge}</AtelierBadge>
              </div>
              {(hasYoungChildren || hasElderly) && (
                <p className="text-xs text-tk-jade-deep font-semibold">
                  Ưu tiên mềm thanh:{' '}
                  {[
                    hasYoungChildren && 'Có trẻ nhỏ',
                    hasElderly && 'Có người lớn tuổi',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              <p className="text-xs text-tk-secondary leading-relaxed">
                Kéo xoay khay gỗ 3D để ngắm chén đũa gốm tự động bày biện theo đúng nếp ăn của nhà
                mình.
              </p>
            </BentoCard>
          </aside>

          {/* Right Step Controls */}
          <div className="lg:col-span-7">
            {/* STEP 1: HOUSEHOLD SIZE */}
            {step === 1 && (
              <BentoCard
                tone="ceramic"
                padding="lg"
                className="animate-fade-in space-y-6 shadow-elevated"
              >
                <section aria-labelledby="onboarding-household-title" className="space-y-6">
                  <div className="space-y-2">
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-tk-jade">
                      Bước 1 · Bàn ăn nhà mình
                    </p>
                    <h1
                      id="onboarding-household-title"
                      className="text-2xl sm:text-3xl font-extrabold tracking-tight text-tk-ink leading-tight"
                    >
                      Nhà mình thường có bao nhiêu người ăn?
                    </h1>
                    <p className="text-sm text-tk-secondary leading-relaxed">
                      Chạm chọn số ghế bên dưới để Takolio cân chỉnh định lượng thịt cá, rau canh
                      vừa vặn từng bữa.
                    </p>
                  </div>

                  <fieldset className="space-y-3">
                    <legend className="text-xs font-extrabold uppercase tracking-wider text-tk-secondary">
                      Số người thường ăn
                    </legend>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                      {HOUSEHOLD_CHOICES.map((number) => {
                        const selected =
                          number === HOUSEHOLD_PLUS_CHOICE
                            ? householdSize >= HOUSEHOLD_PLUS_CHOICE
                            : householdSize === number;
                        const label = householdSizeLabel(number);
                        return (
                          <label key={number} className="min-w-0 cursor-pointer block">
                            <input
                              className="peer sr-only"
                              type="radio"
                              name="household-size"
                              aria-label={label}
                              value={number}
                              checked={selected}
                              onChange={() => {
                                householdSizeEdited.current = true;
                                setHouseholdSize(number);
                              }}
                            />
                            <span
                              className={clsx(
                                'tap-target flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-center transition-tap peer-focus-visible:ring-3 peer-focus-visible:ring-tk-flame/35',
                                selected
                                  ? 'border-tk-flame bg-tk-flame text-white shadow-float'
                                  : 'border-tk-stone bg-tk-canvas/70 text-tk-ink hover:border-tk-ink/30 hover:bg-tk-canvas',
                              )}
                            >
                              {selected ? (
                                <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
                              ) : (
                                <Users
                                  className="h-4 w-4 shrink-0 text-tk-muted"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="text-xl font-extrabold tk-tabular">
                                {number === HOUSEHOLD_PLUS_CHOICE ? '5+' : number}
                              </span>
                              <span
                                className={clsx(
                                  'text-[11px] font-semibold leading-tight',
                                  selected ? 'text-white/90' : 'text-tk-muted',
                                )}
                              >
                                {SEAT_SUBTITLES[number]}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  {/* Optional Quick Care Toggles (Young Kids / Seniors) */}
                  <div className="rounded-2xl bg-tk-sunken/70 border border-tk-stone/80 p-4 space-y-2.5">
                    <span className="block text-xs font-extrabold uppercase tracking-wider text-tk-secondary">
                      Thành viên đặc biệt trên mâm cơm (Tùy chọn)
                    </span>
                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        aria-pressed={hasYoungChildren}
                        onClick={() => setHasYoungChildren((prev) => !prev)}
                        className={clsx(
                          'tap-target inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold border transition-tap cursor-pointer',
                          hasYoungChildren
                            ? 'bg-tk-jade text-white border-tk-jade shadow-xs'
                            : 'bg-white text-tk-ink border-tk-stone hover:border-tk-ink/30',
                        )}
                      >
                        {hasYoungChildren && <Check className="w-4 h-4" aria-hidden="true" />}
                        <span>Có trẻ nhỏ</span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={hasElderly}
                        onClick={() => setHasElderly((prev) => !prev)}
                        className={clsx(
                          'tap-target inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold border transition-tap cursor-pointer',
                          hasElderly
                            ? 'bg-tk-jade text-white border-tk-jade shadow-xs'
                            : 'bg-white text-tk-ink border-tk-stone hover:border-tk-ink/30',
                        )}
                      >
                        {hasElderly && <Check className="w-4 h-4" aria-hidden="true" />}
                        <span>Có người lớn tuổi</span>
                      </button>
                    </div>
                  </div>

                  {error && (
                    <p
                      role="alert"
                      className="rounded-2xl border border-tk-berry/25 bg-tk-berry-soft p-3.5 text-xs font-semibold text-tk-berry-deep"
                    >
                      {error}
                    </p>
                  )}

                  <ActionButton
                    variant="flame"
                    size="lg"
                    fullWidth
                    type="button"
                    onClick={() => navigate(ONBOARDING_PATHS[2])}
                    trailingIcon={<ArrowRight className="w-4.5 h-4.5" aria-hidden="true" />}
                  >
                    Tiếp tục
                  </ActionButton>
                </section>
              </BentoCard>
            )}

            {/* STEP 2: PREFERENCES & ALLERGEN SHIELD */}
            {step === 2 && (
              <BentoCard
                tone="ceramic"
                padding="lg"
                className="animate-fade-in space-y-6 shadow-elevated"
              >
                <section aria-labelledby="onboarding-preferences-title" className="space-y-6">
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => navigate(ONBOARDING_PATHS[1])}
                      className="tap-target -ml-2 px-2 inline-flex items-center text-sm font-bold text-tk-jade hover:underline cursor-pointer"
                    >
                      ← Quay lại
                    </button>
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-tk-jade">
                      Bước 2 · Khẩu vị &amp; An toàn Dị ứng
                    </p>
                    <h1
                      id="onboarding-preferences-title"
                      className="text-2xl sm:text-3xl font-extrabold tracking-tight text-tk-ink leading-tight"
                    >
                      Nhà mình thường nấu thế nào?
                    </h1>
                    <p className="text-sm text-tk-secondary leading-relaxed">
                      Chọn nhanh vị vùng miền, kiểu bữa và khiên dị ứng. Bạn luôn có thể đổi lại bất
                      cứ lúc nào trong Cài đặt.
                    </p>
                  </div>

                  {/* Interactive Spice Level Selector synced to 3D Mâm Cơm */}
                  <fieldset className="rounded-[24px] border border-tk-stone/85 bg-tk-canvas/55 p-4 space-y-2.5">
                    <legend className="px-1 text-xs font-extrabold uppercase tracking-wider text-tk-ink">
                      Độ cay yêu thích của gia đình
                    </legend>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(Object.keys(SPICY_LABELS) as SpicyLevel[]).map((lvl) => {
                        const active = spicyLevel === lvl;
                        const SpiceIcon =
                          lvl === 'none'
                            ? FlameOffIcon
                            : lvl === 'mild'
                              ? FlameLowIcon
                              : lvl === 'medium'
                                ? FlameMediumIcon
                                : FlameHighIcon;
                        return (
                          <button
                            key={lvl}
                            type="button"
                            aria-pressed={active}
                            onClick={() => setSpicyLevel(lvl)}
                            className={clsx(
                              'tap-target inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-extrabold border transition-tap cursor-pointer',
                              active
                                ? 'bg-tk-flame text-white border-tk-flame shadow-xs'
                                : 'bg-white text-tk-secondary border-tk-stone hover:text-tk-ink',
                            )}
                          >
                            <SpiceIcon
                              size={15}
                              tone={active ? 'cream' : 'flame'}
                              active={active}
                            />
                            <span>{SPICY_LABELS[lvl]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  <div className="space-y-5">
                    {familyQuery.isPending && !isOfflineGuestSession() ? (
                      <InlineLoading label="Đang tải thói quen bữa nhà…" />
                    ) : familyQuery.isError ? (
                      <InlineError
                        error={familyQuery.error}
                        onRetry={() => void familyQuery.refetch()}
                      />
                    ) : (
                      family && (
                        <FamilyPreferenceFields
                          value={family}
                          onChange={(next) => {
                            setFamily(next);
                            setSelectedCuisines([
                              ...next.preferredCuisines,
                              ...auth.favoriteCuisines.filter(
                                (value) => !CUISINE_TAGS.some((tag) => tag.id === value),
                              ),
                            ]);
                          }}
                        />
                      )
                    )}

                    {restrictions.length > 0 && (
                      <p className="rounded-2xl border border-tk-turmeric/30 bg-tk-turmeric-soft p-3.5 text-xs text-tk-turmeric-deep leading-relaxed">
                        Hạn chế từ hồ sơ cũ:{' '}
                        {restrictions
                          .map(
                            (value) =>
                              RESTRICTION_TAGS.find((tag) => tag.id === value)?.label ?? value,
                          )
                          .join(', ')}
                        . Hãy chọn dị ứng và nguyên liệu bắt buộc tránh ở trên để áp dụng ràng buộc
                        chính xác cho thực đơn mới.
                      </p>
                    )}
                  </div>

                  <ActionButton
                    variant="flame"
                    size="lg"
                    fullWidth
                    type="button"
                    onClick={() => navigate(ONBOARDING_PATHS[3])}
                    trailingIcon={<ArrowRight className="w-4.5 h-4.5" aria-hidden="true" />}
                  >
                    Tiếp tục
                  </ActionButton>
                </section>
              </BentoCard>
            )}

            {/* STEP 3: GOALS & UNIFIED TRUTHFUL SUMMARY */}
            {step === 3 && (
              <BentoCard
                tone="ceramic"
                padding="lg"
                className="animate-fade-in space-y-6 shadow-elevated"
              >
                <section aria-labelledby="onboarding-goals-title" className="space-y-6">
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => navigate(ONBOARDING_PATHS[2])}
                      className="tap-target -ml-2 px-2 inline-flex items-center text-sm font-bold text-tk-jade hover:underline cursor-pointer"
                    >
                      ← Quay lại
                    </button>
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-tk-jade">
                      Bước 3 · Sẵn sàng vào bếp
                    </p>
                    <h1
                      id="onboarding-goals-title"
                      className="text-2xl sm:text-3xl font-extrabold tracking-tight text-tk-ink leading-tight"
                    >
                      Bạn muốn Takolio giúp việc gì trước?
                    </h1>
                    <p className="text-sm text-tk-secondary leading-relaxed">
                      Chọn điểm khởi đầu mong muốn và điểm lại bảng tóm tắt thống nhất bên dưới.
                    </p>
                  </div>

                  <fieldset className="space-y-3" data-testid="onboarding-goal-group">
                    <legend className="text-xs font-extrabold uppercase tracking-wider text-tk-secondary">
                      Ưu tiên mở màn
                    </legend>
                    <div className="space-y-2.5">
                      {GOAL_OPTIONS.map((goal) => {
                        const Icon = goal.icon;
                        const selected = primaryGoal === goal.id;
                        return (
                          <label key={goal.id} className="block cursor-pointer">
                            <input
                              className="peer sr-only"
                              type="radio"
                              name="primary-goal"
                              value={goal.id}
                              checked={selected}
                              onChange={() => setPrimaryGoal(goal.id)}
                            />
                            <span
                              className={clsx(
                                'flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition-tap peer-focus-visible:ring-3 peer-focus-visible:ring-tk-flame/35',
                                selected
                                  ? 'border-tk-flame bg-tk-flame-soft/55 ring-2 ring-tk-flame/15'
                                  : 'border-tk-stone bg-tk-canvas/50 hover:bg-tk-canvas',
                              )}
                            >
                              <span
                                className={clsx(
                                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                                  selected
                                    ? 'bg-tk-flame text-white shadow-xs'
                                    : 'bg-white border border-tk-stone text-tk-muted',
                                )}
                              >
                                <Icon className="h-5 w-5" aria-hidden="true" />
                              </span>
                              <span className="flex-1 min-w-0">
                                <strong className="block text-sm sm:text-base font-extrabold text-tk-ink">
                                  {goal.title}
                                </strong>
                                <span className="mt-0.5 block text-xs text-tk-secondary leading-relaxed">
                                  {goal.description}
                                </span>
                              </span>
                              {selected && (
                                <Check
                                  className="h-5 w-5 text-tk-flame shrink-0"
                                  aria-hidden="true"
                                />
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  {auth.isGuest && primaryGoal === 'week' && (
                    <div className="rounded-2xl border border-tk-jade/25 bg-tk-jade-soft/65 px-4 py-3 text-xs text-tk-jade-deep leading-relaxed">
                      Bạn đang ở phiên trải nghiệm trên thiết bị: bạn có thể xem trước khu vực thực
                      đơn tuần hoặc chuyển sang Bếp Hôm Nay bất cứ lúc nào trên thanh điều hướng.
                    </div>
                  )}

                  {/* Single Unified Truthful Summary Card */}
                  <div className="rounded-[22px] border border-tk-stone bg-tk-canvas/75 p-5 space-y-2">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-tk-stone/70">
                      <h2 className="text-xs font-extrabold uppercase tracking-wider text-tk-ink">
                        Hồ sơ bếp nhà sẽ được lưu
                      </h2>
                      <AtelierBadge tone="jade">Đồng bộ tức thì</AtelierBadge>
                    </div>

                    <dl
                      className="divide-y divide-tk-stone/60 text-xs sm:text-sm"
                      data-testid="onboarding-preference-review"
                    >
                      <div className="py-2.5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                        <dt className="font-bold text-tk-muted">Quy mô bữa ăn</dt>
                        <dd className="font-extrabold text-tk-ink sm:text-right">
                          {householdSizeLabel(householdSize)}
                        </dd>
                      </div>
                      <div className="py-2.5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                        <dt className="font-bold text-tk-muted">Ẩm thực yêu thích</dt>
                        <dd className="font-semibold text-tk-ink sm:text-right">
                          {selectedCuisines.length === 0
                            ? 'Không có lựa chọn'
                            : selectedCuisines
                                .map(
                                  (value) =>
                                    CUISINE_TAGS.find(({ id }) => id === value)?.label ??
                                    `${value} (hồ sơ cũ, chưa áp dụng)`,
                                )
                                .join(', ')}
                        </dd>
                      </div>
                      <div className="py-2.5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                        <dt className="font-bold text-tk-muted">Mức độ cay</dt>
                        <dd className="font-semibold text-tk-ink sm:text-right">
                          {SPICY_LABELS[spicyLevel]}
                        </dd>
                      </div>
                      <div className="py-2.5 flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
                        <dt className="font-bold text-tk-muted">Hạn chế từ hồ sơ cũ</dt>
                        <dd className="font-semibold text-tk-ink sm:text-right">
                          {restrictions.length === 0
                            ? 'Không có lựa chọn'
                            : restrictions
                                .map(
                                  (value) =>
                                    RESTRICTION_TAGS.find(({ id }) => id === value)?.label ?? value,
                                )
                                .join(', ')}
                        </dd>
                      </div>
                    </dl>

                    {family && (
                      <div className="border-t border-tk-stone/60">
                        <FamilyPreferenceSummary value={{ ...family, householdSize }} />
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 pt-1">
                    {error && (
                      <p
                        role="alert"
                        className="rounded-2xl border border-tk-berry/25 bg-tk-berry-soft p-3.5 text-sm font-semibold text-tk-berry-deep"
                      >
                        {error}
                      </p>
                    )}
                    {profileConflict && (
                      <ActionButton
                        variant="ceramic"
                        size="md"
                        fullWidth
                        type="button"
                        onClick={async () => {
                          const result = await familyQuery.refetch();
                          if (result.data) {
                            setFamily(result.data.preferences);
                            setHouseholdSize(result.data.preferences.householdSize);
                            setSelectedCuisines(result.data.preferences.preferredCuisines);
                            setDraftRevision(result.data.revision);
                            setProfileConflict(false);
                            setError(null);
                          }
                        }}
                      >
                        Tải lại và xem thói quen mới nhất
                      </ActionButton>
                    )}
                    <ActionButton
                      variant="flame"
                      size="xl"
                      fullWidth
                      type="button"
                      disabled={
                        profileConflict || (!isOfflineGuestSession() && draftRevision === null)
                      }
                      loading={isSaving}
                      onClick={() => void commitOnboarding()}
                      trailingIcon={<ArrowRight className="h-5 w-5" aria-hidden="true" />}
                    >
                      Bắt đầu với Takolio
                    </ActionButton>
                    <p className="text-center text-xs font-medium text-tk-muted">
                      {isOfflineGuestSession()
                        ? 'Bản trải nghiệm ngoại tuyến trên thiết bị. Mọi thiết lập có thể cập nhật sau.'
                        : 'Thói quen được lưu cho hộ gia đình và có thể thay đổi bất cứ lúc nào.'}
                    </p>
                  </div>
                </section>
              </BentoCard>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};
