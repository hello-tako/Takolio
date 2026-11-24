import { AccountPage } from '../../components/common/AccountPage';
import React, { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Flame, Heart, Utensils, Users } from 'lucide-react';
import { authApi } from '../../services/auth';
import { queryKeys } from '../../lib/queryKeys';
import { isOfflineGuestSession } from '../../lib/private-session';
import { useAuthStore } from '../../stores/useAuthStore';
import { InlineError, InlineLoading } from '../../components/common/AsyncState';
import { Button } from '../../components/common/Button';
import { StickyActions } from '../../design-system/primitives';
import { useLocaleText } from '../../i18n/app-i18n';

const CUISINE_TAGS = [
  { id: 'vietnamese', labelVi: 'Việt Nam', labelEn: 'Vietnamese' },
  { id: 'korean', labelVi: 'Hàn Quốc', labelEn: 'Korean' },
  { id: 'japanese', labelVi: 'Nhật Bản', labelEn: 'Japanese' },
  { id: 'western', labelVi: 'Âu - Mỹ', labelEn: 'Western' },
  { id: 'chinese', labelVi: 'Trung Hoa', labelEn: 'Chinese' },
  { id: 'thai', labelVi: 'Thái Lan', labelEn: 'Thai' },
  { id: 'other', labelVi: 'Khác', labelEn: 'Other' },
] as const;

const RESTRICTION_TAGS = [
  { id: 'vegetarian', labelVi: 'Ăn chay linh hoạt', labelEn: 'Flexitarian / Vegetarian' },
  { id: 'more_greens', labelVi: 'Nhiều rau', labelEn: 'More greens' },
  { id: 'quick_meals', labelVi: 'Nấu nhanh', labelEn: 'Quick meals' },
  { id: 'beef', labelVi: 'Thịt bò', labelEn: 'Beef' },
  { id: 'seafood', labelVi: 'Hải sản', labelEn: 'Seafood' },
  { id: 'peanuts', labelVi: 'Đậu phộng', labelEn: 'Peanuts' },
  { id: 'spicy', labelVi: 'Đồ cay', labelEn: 'Spicy food' },
  { id: 'mushroom', labelVi: 'Nấm', labelEn: 'Mushrooms' },
  { id: 'onion_garlic', labelVi: 'Hành tỏi', labelEn: 'Onion & garlic' },
  { id: 'milk', labelVi: 'Sữa', labelEn: 'Milk / Dairy' },
  { id: 'gluten', labelVi: 'Gluten', labelEn: 'Gluten' },
  { id: 'other', labelVi: 'Khác', labelEn: 'Other' },
] as const;

const SPICY_LEVELS = [
  { id: 'none', labelVi: 'Không cay', labelEn: 'No spice' },
  { id: 'mild', labelVi: 'Ít cay', labelEn: 'Mild' },
  { id: 'medium', labelVi: 'Trung bình', labelEn: 'Medium' },
  { id: 'hot', labelVi: 'Rất cay', labelEn: 'Spicy' },
] as const;

interface Draft {
  householdSize: number;
  spicyLevel: 'none' | 'mild' | 'medium' | 'hot';
  favoriteCuisines: string[];
  dietaryRestrictions: string[];
}

const SPICY_IDS = ['none', 'mild', 'medium', 'hot'] as const;
type SpicyLevel = (typeof SPICY_IDS)[number];
const asSpicyLevel = (v: unknown, fallback: SpicyLevel = 'medium'): SpicyLevel => {
  if (v === 'spicy') return 'hot';
  return SPICY_IDS.includes(v as SpicyLevel) ? (v as SpicyLevel) : fallback;
};

/**
 * T17 screen 20 — dedicated food-preferences editor over the real
 * GET/PATCH /preferences contract. Values round-trip to the server
 * representation without lossy conversion; no client-side fake truth.
 */
export const FoodPreferencesPage: React.FC = () => {
  const { l } = useLocaleText();
  const queryClient = useQueryClient();
  const auth = useAuthStore();
  const isGuestOffline = isOfflineGuestSession();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  const prefsQuery = useQuery({
    queryKey: queryKeys.foodPreferences(),
    queryFn: () => authApi.getFoodPreferences(),
    enabled: !isGuestOffline,
  });

  useEffect(() => {
    if (draft) return;
    if (!isGuestOffline && prefsQuery.data) {
      const p = prefsQuery.data;
      setDraft({
        householdSize: p.householdSize ?? auth.householdSize ?? 2,
        spicyLevel: asSpicyLevel(p.spicyLevel ?? auth.spicyLevel),
        favoriteCuisines: p.favoriteCuisines ?? auth.favoriteCuisines ?? ['vietnamese'],
        dietaryRestrictions: p.dietaryRestrictions ?? auth.dietaryRestrictions ?? [],
      });
    } else if (isGuestOffline) {
      setDraft({
        householdSize: auth.householdSize ?? 2,
        spicyLevel: asSpicyLevel(auth.spicyLevel),
        favoriteCuisines: auth.favoriteCuisines ?? ['vietnamese'],
        dietaryRestrictions: auth.dietaryRestrictions ?? [],
      });
    }
  }, [draft, isGuestOffline, prefsQuery.data, auth.householdSize, auth.spicyLevel, auth.favoriteCuisines, auth.dietaryRestrictions]);

  const toggleTag = (id: string, list: 'favoriteCuisines' | 'dietaryRestrictions') =>
    setDraft((prev) => {
      if (!prev) return prev;
      const values = prev[list];
      return { ...prev, [list]: values.includes(id) ? values.filter((v) => v !== id) : [...values, id] };
    });

  useEffect(() => { setSavedAt(null); }, [draft]);

  const save = async () => {
    if (!draft) return;
    setError(null);
    setSaving(true);
    try {
      if (!isGuestOffline) {
        await authApi.updateFoodPreferences(draft);
        // Server is the authority for the saved profile; drop the stale read.
        await queryClient.invalidateQueries({ queryKey: queryKeys.foodPreferences() });
      }
      // Preference-only store update: never flips onboarding completion,
      // which is server truth (screen 20 acceptance).
      auth.setOnboardingFromServer(auth.isOnboarded, draft);
      setSavedAt(Date.now());
    } catch {
      setError(
        l(
          'Chưa thể lưu sở thích. Vui lòng kiểm tra kết nối và thử lại.',
          'Could not save preferences. Please check your connection and try again.',
        ),
      );
    } finally {
      setSaving(false);
    }
  };

  const chip = (selected: boolean, _tone: 'action' | 'warning' = 'action') =>
    `min-h-[44px] px-4 py-2 rounded-pill text-sm font-medium border transition-colors focus-visible:outline-none focus-visible:shadow-t17-focus ${
      selected
        ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] font-semibold'
        : 'bg-white text-[var(--tkv-ink)] border-[var(--tkv-border)] hover:border-[var(--tkv-border-strong)]'
    }`;

  return (
    <AccountPage
      title={l('Sở thích & hạn chế', 'Food preferences & restrictions')}
      description={l(
        'Gu món ăn giúp Takolio gợi ý món sát hơn',
        'Your taste profile helps Takolio suggest better dishes',
      )}
    >

      {isGuestOffline && (
        <p className="text-xs text-[var(--tkv-ink-muted)] mb-3">
          {l(
            'Phiên dùng thử ngoại tuyến: thay đổi chỉ áp dụng trong phiên này và sẽ mất khi tải lại ứng dụng.',
            'Offline guest session: changes only apply to this session and will be lost on reload.',
          )}
        </p>
      )}

      {prefsQuery.isPending && !draft && (
        <InlineLoading label={l('Đang tải sở thích…', 'Loading preferences…')} />
      )}
      {prefsQuery.isError && (
        <InlineError error={prefsQuery.error} onRetry={() => prefsQuery.refetch()} />
      )}

      {draft && (
        <fieldset disabled={saving} className="account-editor space-y-5 pb-8">
          <legend className="sr-only">{l('Chọn cài đặt', 'Choose settings')}</legend>
          <fieldset>
            <legend className="text-type-label text-[var(--tkv-ink)] flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-[var(--tkv-primary)] shrink-0" aria-hidden="true" />{' '}
              {l('Số người thường ăn', 'Household size')}
            </legend>
            <div className="flex flex-wrap items-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={n === 5 ? draft.householdSize >= 5 : draft.householdSize === n}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      householdSize: n === 5 ? Math.max(5, draft.householdSize) : n,
                    })
                  }
                  className={`min-h-[44px] min-w-[44px] px-4 rounded-pill text-sm font-semibold tabular-nums border transition-colors focus-visible:outline-none focus-visible:shadow-t17-focus ${
                    (n === 5 ? draft.householdSize >= 5 : draft.householdSize === n)
                      ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)]'
                      : 'bg-white text-[var(--tkv-ink)] border-[var(--tkv-border)] hover:border-[var(--tkv-border-strong)]'
                  }`}
                >
                  {n === 5 ? '5+' : n}
                </button>
              ))}
              {draft.householdSize >= 5 && (
                <div
                  role="group"
                  aria-label={l(
                    'Điều chỉnh khẩu phần gia đình đông người',
                    'Adjust portions for a larger household',
                  )}
                  className="inline-flex items-center gap-1.5 rounded-pill bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] px-2 py-1"
                >
                  <button
                    type="button"
                    aria-label={l('Giảm số người', 'Decrease household size')}
                    disabled={draft.householdSize <= 5}
                    onClick={() =>
                      setDraft({ ...draft, householdSize: Math.max(5, draft.householdSize - 1) })
                    }
                    className="w-11 h-11 min-h-0 p-0 inline-flex items-center justify-center rounded-full bg-white border border-[var(--tkv-border)] text-base font-bold text-[var(--tkv-ink)] disabled:opacity-40 transition-colors"
                  >
                    −
                  </button>
                  <span
                    data-testid="u02-household-stepper-value"
                    className="min-w-[68px] text-center text-sm font-semibold tabular-nums text-[var(--tkv-ink)]"
                  >
                    {l(`${draft.householdSize} người`, `${draft.householdSize} people`)}
                  </span>
                  <button
                    type="button"
                    aria-label={l('Tăng số người', 'Increase household size')}
                    disabled={draft.householdSize >= 20}
                    onClick={() =>
                      setDraft({ ...draft, householdSize: Math.min(20, draft.householdSize + 1) })
                    }
                    className="w-11 h-11 min-h-0 p-0 inline-flex items-center justify-center rounded-full bg-white border border-[var(--tkv-border)] text-base font-bold text-[var(--tkv-ink)] disabled:opacity-40 transition-colors"
                  >
                    +
                  </button>
                </div>
              )}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-type-label text-[var(--tkv-ink)] flex items-center gap-2 mb-2">
              <Utensils className="w-4 h-4 text-[var(--tkv-primary)] shrink-0" aria-hidden="true" />{' '}
              {l('Món ưa thích', 'Favorite cuisines')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {CUISINE_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={draft.favoriteCuisines.includes(tag.id)}
                  onClick={() => toggleTag(tag.id, 'favoriteCuisines')}
                  className={chip(draft.favoriteCuisines.includes(tag.id))}
                >
                  {l(tag.labelVi, tag.labelEn)}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-type-label text-[var(--tkv-ink)] flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-[var(--tkv-primary)] shrink-0" aria-hidden="true" />{' '}
              {l('Nguyên liệu hạn chế', 'Ingredients to avoid')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {RESTRICTION_TAGS.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={draft.dietaryRestrictions.includes(tag.id)}
                  onClick={() => toggleTag(tag.id, 'dietaryRestrictions')}
                  className={chip(draft.dietaryRestrictions.includes(tag.id), 'warning')}
                >
                  {l(tag.labelVi, tag.labelEn)}
                </button>
              ))}
            </div>
            <p className="text-xs text-[var(--tkv-ink-muted)] mt-2">
              {l(
                'Giới hạn này giúp lọc gợi ý, không thay thế tư vấn y tế.',
                'These restrictions help filter suggestions and do not replace medical advice.',
              )}
            </p>
          </fieldset>

          <fieldset>
            <legend className="text-type-label text-[var(--tkv-ink)] flex items-center gap-2 mb-2">
              <Flame className="w-4 h-4 text-[var(--tkv-primary)] shrink-0" aria-hidden="true" />{' '}
              {l('Mức độ cay', 'Spice tolerance')}
            </legend>
            <div className="flex flex-wrap gap-2">
              {SPICY_LEVELS.map((level) => (
                <button
                  key={level.id}
                  type="button"
                  aria-pressed={draft.spicyLevel === level.id}
                  onClick={() => setDraft({ ...draft, spicyLevel: level.id })}
                  className={chip(draft.spicyLevel === level.id)}
                >
                  {l(level.labelVi, level.labelEn)}
                </button>
              ))}
            </div>
          </fieldset>

          {error && (
            <p ref={errorRef} tabIndex={-1} role="alert" className="text-sm text-semantic-danger">
              {error}
            </p>
          )}
          {savedAt && !error && (
            <p role="status" className="text-sm text-semantic-success">
              {isGuestOffline
                ? l(
                    'Đã áp dụng sở thích cho phiên dùng thử này.',
                    'Preferences applied for this guest session.',
                  )
                : l('Đã lưu sở thích.', 'Preferences saved.')}
            </p>
          )}

          <StickyActions>
            <Button variant="primary" fullWidth onClick={save} disabled={saving} isLoading={saving}>
              {l('Lưu sở thích', 'Save preferences')}
            </Button>
          </StickyActions>
        </fieldset>
      )}
    </AccountPage>
  );
};
