import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Calendar, Check, Flame, Sparkles, Users, Utensils } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError, guardPrivateSession } from '../services/http';
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
import { clsx } from 'clsx';
import { Button } from '../components/common/Button';
import { TAKOSAN_KITCHEN } from '../lib/takosan-kitchen';
import { capturePrivateSession, isOfflineGuestSession } from '../lib/private-session';
import { api } from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';

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

// Client-only planning goal: it steers post-onboarding navigation and is never
// sent to `/preferences`, which does not persist it.
const GOAL_OPTIONS = [
  {
    id: 'today',
    title: 'Hôm nay ăn gì?',
    description: 'Gợi ý món ngay từ nguyên liệu đang có.',
    icon: Utensils,
  },
  {
    id: 'week',
    title: 'Lên thực đơn tuần',
    description: 'Chuẩn bị bữa ăn và danh sách đi chợ.',
    icon: Calendar,
  },
  {
    id: 'both',
    title: 'Kết hợp cả hai',
    description: 'Linh hoạt hôm nay, chủ động cả tuần.',
    icon: Sparkles,
  },
] as const;

// Visible household choices; 5 doubles as the "5+" bucket. Server truth is 1..20.
const HOUSEHOLD_CHOICES = [1, 2, 3, 4, 5] as const;
const HOUSEHOLD_PLUS_CHOICE = 5;

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
  // Stored values above the visible buckets (6..20) are kept verbatim until the
  // user explicitly picks a size; only the presentation buckets them as "5+".
  const [householdSize, setHouseholdSize] = useState(() => {
    const stored = auth.householdSize;
    return Number.isInteger(stored) && stored >= 1 ? stored : 2;
  });
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>(() => [
    ...auth.favoriteCuisines,
  ]);
  const [restrictions] = useState<string[]>(() => [...auth.dietaryRestrictions]);
  const spicyLevel = supportedSpicyLevel(auth.spicyLevel);
  const [primaryGoal, setPrimaryGoal] = useState<PrimaryGoal>(() =>
    supportedPrimaryGoal(auth.primaryGoal),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!step) return <Navigate to={ONBOARDING_PATHS[1]} replace />;

  const finish = async () => {
    const isCurrent = capturePrivateSession();
    setError(null);
    setIsSaving(true);
    // Only server-supported preference fields; primaryGoal stays client-side.
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
        if (!family || draftRevision === null || profileConflict)
          throw new Error('Family preferences not ready');
        const saved = await familyPreferencesApi.save(draftRevision, { ...family, householdSize });
        assertCurrent();
        client.setQueryData(key, saved);
        setDraftRevision(saved.revision);
        const result = await api.completeOnboarding(preferences);
        if (!result.success || result.onboardingCompleted !== true) {
          throw new Error('Onboarding completion was not confirmed');
        }
      }
      assertCurrent();
      auth.setOnboardingData({ ...preferences, primaryGoal });
      navigate(
        primaryGoal === 'week'
          ? isMealPlannerEnabled() && isMealCompositionEnabled()
            ? '/planner/new'
            : '/week/setup'
          : '/',
        { replace: true },
      );
    } catch (failure) {
      if (!isCurrent()) return;
      if (failure instanceof ApiError && failure.code === 'REVISION_CONFLICT') {
        setProfileConflict(true);
        setError('Thói quen vừa thay đổi trên thiết bị khác. Tải lại và xem trước khi hoàn tất.');
      } else {
        setError('Chưa thể lưu sở thích. Vui lòng kiểm tra kết nối và thử lại.');
      }
    } finally {
      if (isCurrent()) setIsSaving(false);
    }
  };

  return (
    <main className="takosan-rebuild entry-page onboarding-page">
      <div className="onboarding-workspace">
        <header className="mb-7 flex items-center justify-between">
          <img
            src={TAKOSAN_KITCHEN.logo}
            alt="Takolio"
            translate="no"
            width={300}
            height={72}
            className="entry-logo"
          />
          <span className="rounded-full border border-takosan-mint-deep bg-white px-3 py-1 text-xs font-bold text-takosan-green">
            {step} / 3
          </span>
        </header>

        <div
          className="mb-7 grid grid-cols-3 gap-2"
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
                'h-1.5 rounded-full',
                item <= step ? 'bg-takosan-green' : 'bg-semantic-border',
              )}
            />
          ))}
        </div>

        {step === 1 && (
          <section
            className="flex flex-1 flex-col animate-fade-in"
            aria-labelledby="onboarding-household-title"
          >
            <div className="mb-7">
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-takosan-green">
                Khẩu phần gia đình
              </p>
              <h1
                id="onboarding-household-title"
                className="font-heading text-3xl font-extrabold leading-tight"
              >
                Nhà mình thường có bao nhiêu người ăn?
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-semantic-text-secondary">
                Takolio dùng số người để tính khẩu phần phù hợp cho mỗi bữa.
              </p>
            </div>

            <fieldset className="mb-8 rounded-3xl border border-takosan-cream-line bg-white p-5 shadow-sm">
              <legend className="px-1 text-xs font-bold uppercase tracking-wider text-semantic-text-secondary">
                Số người thường ăn
              </legend>
              <div className="onboarding-household-choices">
                {HOUSEHOLD_CHOICES.map((number) => {
                  const selected =
                    number === HOUSEHOLD_PLUS_CHOICE
                      ? householdSize >= HOUSEHOLD_PLUS_CHOICE
                      : householdSize === number;
                  const label = householdSizeLabel(number);
                  return (
                    <label key={number} className="min-w-0 flex-1 cursor-pointer">
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
                          'flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-3 text-center text-sm font-bold transition-tap peer-focus-visible:ring-2 peer-focus-visible:ring-takosan-green peer-focus-visible:ring-offset-2',
                          selected
                            ? 'border-takosan-green bg-takosan-green text-white shadow-sm'
                            : 'border-semantic-border bg-semantic-background-subtle text-semantic-text-secondary',
                        )}
                      >
                        {selected ? (
                          <Check className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Users className="h-4 w-4" aria-hidden="true" />
                        )}
                        <span>{number === HOUSEHOLD_PLUS_CHOICE ? '5+' : number}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <Button
              fullWidth
              size="lg"
              type="button"
              onClick={() => navigate(ONBOARDING_PATHS[2])}
              className="mt-auto rounded-2xl"
            >
              Tiếp tục
            </Button>
          </section>
        )}

        {step === 2 && (
          <section
            className="flex flex-1 flex-col animate-fade-in"
            aria-labelledby="onboarding-preferences-title"
          >
            <div className="mb-7">
              <button
                type="button"
                onClick={() => navigate(ONBOARDING_PATHS[1])}
                className="mb-5 text-sm font-semibold text-takosan-green"
              >
                ← Quay lại
              </button>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-takosan-green">
                Bữa nhà & hạn chế thực phẩm
              </p>
              <h1
                id="onboarding-preferences-title"
                className="font-heading text-3xl font-extrabold leading-tight"
              >
                Nhà mình thường nấu thế nào?
              </h1>
              <p className="mt-2 text-sm text-semantic-text-secondary">
                Chọn nhiều mục nếu phù hợp. Bạn có thể thay đổi trong hồ sơ sau này.
              </p>
            </div>

            <div className="mb-8 space-y-7">
              {familyQuery.isPending && !isOfflineGuestSession() ? (
                <InlineLoading label="Đang tải thói quen bữa nhà…" />
              ) : familyQuery.isError ? (
                <InlineError error={familyQuery.error} onRetry={() => void familyQuery.refetch()} />
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
                <p className="planning-note">
                  Hạn chế từ hồ sơ cũ:{' '}
                  {restrictions
                    .map(
                      (value) => RESTRICTION_TAGS.find((tag) => tag.id === value)?.label ?? value,
                    )
                    .join(', ')}
                  . Các giá trị cũ chưa được chuyển thành ràng buộc cho thực đơn; hãy chọn dị ứng và
                  nguyên liệu bắt buộc tránh ở trên.
                </p>
              )}
            </div>

            <Button
              fullWidth
              size="lg"
              type="button"
              onClick={() => navigate(ONBOARDING_PATHS[3])}
              className="mt-auto rounded-2xl"
            >
              Tiếp tục
            </Button>
          </section>
        )}

        {step === 3 && (
          <section
            className="flex flex-1 flex-col animate-fade-in"
            aria-labelledby="onboarding-goals-title"
          >
            <div className="mb-7">
              <button
                type="button"
                onClick={() => navigate(ONBOARDING_PATHS[2])}
                className="mb-5 text-sm font-semibold text-takosan-green"
              >
                ← Quay lại
              </button>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-takosan-green">
                Mục tiêu lên kế hoạch
              </p>
              <h1
                id="onboarding-goals-title"
                className="font-heading text-3xl font-extrabold leading-tight"
              >
                Bạn muốn Takolio giúp việc gì trước?
              </h1>
              <p className="mt-2 text-sm text-semantic-text-secondary">
                Lựa chọn này chỉ quyết định màn hình bắt đầu trên thiết bị này; các sở thích bên
                dưới được lưu sau khi máy chủ xác nhận hoàn tất.
              </p>
            </div>

            <fieldset className="mb-7" data-testid="onboarding-goal-group">
              <legend className="mb-3 text-xs font-bold uppercase tracking-wider text-semantic-text-secondary">
                Ưu tiên trước
              </legend>
              <div className="space-y-3">
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
                          'flex w-full items-center gap-4 rounded-3xl border bg-white p-4 text-left shadow-sm transition-tap peer-focus-visible:ring-2 peer-focus-visible:ring-takosan-green peer-focus-visible:ring-offset-2',
                          selected
                            ? 'border-takosan-green ring-2 ring-takosan-green/20'
                            : 'border-semantic-border',
                        )}
                      >
                        <span
                          className={clsx(
                            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl',
                            selected
                              ? 'bg-takosan-mint text-takosan-green'
                              : 'bg-semantic-border/60 text-semantic-text-muted',
                          )}
                        >
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="flex-1">
                          <strong className="block font-heading text-base">{goal.title}</strong>
                          <span className="mt-1 block text-xs text-semantic-text-muted">
                            {goal.description}
                          </span>
                        </span>
                        {selected && (
                          <Check className="h-5 w-5 text-takosan-green" aria-hidden="true" />
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {family && <FamilyPreferenceSummary value={{ ...family, householdSize }} />}
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-semantic-text-secondary">
              Sở thích sẽ được lưu
            </h2>
            <div className="space-y-3" data-testid="onboarding-preference-review">
              <div className="flex items-center gap-4 rounded-3xl border border-semantic-border bg-white p-4 shadow-sm">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-takosan-mint text-takosan-green">
                  <Users className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <strong className="block font-heading text-base">Quy mô bữa ăn</strong>
                  <span className="mt-1 block text-xs text-semantic-text-muted">
                    {householdSizeLabel(householdSize)}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-4 rounded-3xl border border-semantic-border bg-white p-4 shadow-sm">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-takosan-mint text-takosan-green">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <strong className="block font-heading text-base">Ẩm thực yêu thích</strong>
                  <span className="mt-1 block text-xs text-semantic-text-muted">
                    {selectedCuisines.length === 0
                      ? 'Không có lựa chọn'
                      : selectedCuisines
                          .map(
                            (value) =>
                              CUISINE_TAGS.find(({ id }) => id === value)?.label ??
                              `${value} (hồ sơ cũ, chưa áp dụng)`,
                          )
                          .join(', ')}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-4 rounded-3xl border border-semantic-border bg-white p-4 shadow-sm">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-takosan-mint text-takosan-green">
                  <Flame className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <strong className="block font-heading text-base">Mức độ cay</strong>
                  <span className="mt-1 block text-xs text-semantic-text-muted">
                    {SPICY_LABELS[spicyLevel]}
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-4 rounded-3xl border border-semantic-border bg-white p-4 shadow-sm">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-takosan-mint text-takosan-green">
                  <Check className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>
                  <strong className="block font-heading text-base">Hạn chế từ hồ sơ cũ</strong>
                  <span className="mt-1 block text-xs text-semantic-text-muted">
                    {restrictions.length === 0
                      ? 'Không có lựa chọn'
                      : restrictions
                          .map(
                            (value) =>
                              RESTRICTION_TAGS.find(({ id }) => id === value)?.label ?? value,
                          )
                          .join(', ')}
                  </span>
                </span>
              </div>
            </div>

            <div className="mt-auto pt-7">
              {error && (
                <p
                  role="alert"
                  className="mb-3 rounded-xl border border-semantic-danger/30 bg-semantic-danger-soft p-3 text-sm text-semantic-danger-strong"
                >
                  {error}
                </p>
              )}
              {profileConflict && (
                <Button
                  variant="outline"
                  fullWidth
                  className="mb-3"
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
                </Button>
              )}
              <Button
                fullWidth
                size="lg"
                type="button"
                disabled={profileConflict || (!isOfflineGuestSession() && draftRevision === null)}
                onClick={() => void finish()}
                isLoading={isSaving}
                className="flex items-center justify-center gap-2 rounded-2xl"
              >
                Bắt đầu với Takolio <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Button>
              <p className="mt-3 text-center text-xs text-semantic-text-muted">
                {isOfflineGuestSession()
                  ? 'Bản trải nghiệm khách trên thiết bị. Đăng nhập để lưu thói quen gia đình.'
                  : 'Thói quen được lưu cho gia đình và có thể thay đổi sau.'}
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
};
