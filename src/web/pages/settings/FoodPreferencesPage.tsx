import { AccountPage } from '../../components/common/AccountPage';
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../../services/auth';
import { queryKeys } from '../../lib/queryKeys';
import { isOfflineGuestSession } from '../../lib/private-session';
import { useAuthStore } from '../../stores/useAuthStore';
import { InlineError, InlineLoading } from '../../components/common/AsyncState';
import { Button } from '../../components/common/Button';
import { StickyActions } from '../../design-system/primitives';
import { BentoCard, AtelierBadge } from '../../design-system/v4/AtelierPrimitives';
import {
  AllergenShieldIcon,
  HouseholdTrayIcon,
  ChopsticksBowlIcon,
  FlameMediumIcon,
} from '../../design-system/icons';

const CUISINE_TAGS = [
  { id: 'vietnamese', label: 'Việt Nam' },
  { id: 'korean', label: 'Hàn Quốc' },
  { id: 'japanese', label: 'Nhật Bản' },
  { id: 'western', label: 'Âu - Mỹ' },
  { id: 'chinese', label: 'Trung Hoa' },
  { id: 'thai', label: 'Thái Lan' },
  { id: 'other', label: 'Khác' },
];

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
];

const SPICY_LEVELS = [
  { id: 'none', label: 'Không cay' },
  { id: 'mild', label: 'Ít cay' },
  { id: 'medium', label: 'Trung bình' },
  { id: 'hot', label: 'Rất cay' },
] as const;

interface Draft {
  householdSize: number;
  spicyLevel: 'none' | 'mild' | 'medium' | 'hot';
  favoriteCuisines: string[];
  dietaryRestrictions: string[];
}

const SPICY_IDS = ['none', 'mild', 'medium', 'hot'] as const;
type SpicyLevel = (typeof SPICY_IDS)[number];
const asSpicyLevel = (v: unknown, fallback: SpicyLevel = 'medium'): SpicyLevel =>
  SPICY_IDS.includes(v as SpicyLevel) ? (v as SpicyLevel) : fallback;

export const FoodPreferencesPage: React.FC = () => {
  const queryClient = useQueryClient();
  const auth = useAuthStore();
  const isGuestOffline = isOfflineGuestSession();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

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
  }, [
    draft,
    isGuestOffline,
    prefsQuery.data,
    auth.householdSize,
    auth.spicyLevel,
    auth.favoriteCuisines,
    auth.dietaryRestrictions,
  ]);

  const toggleTag = (id: string, list: 'favoriteCuisines' | 'dietaryRestrictions') =>
    setDraft((prev) => {
      if (!prev) return prev;
      const values = prev[list];
      return {
        ...prev,
        [list]: values.includes(id) ? values.filter((v) => v !== id) : [...values, id],
      };
    });

  useEffect(() => {
    setSavedAt(null);
  }, [draft]);

  const save = async () => {
    if (!draft) return;
    setError(null);
    setSaving(true);
    try {
      if (!isGuestOffline) {
        await authApi.updateFoodPreferences(draft);
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.foodPreferences() }),
          queryClient.invalidateQueries({ queryKey: ['familyPreferences'] }),
        ]);
      }
      auth.setOnboardingFromServer(auth.isOnboarded, draft);
      setSavedAt(Date.now());
    } catch {
      setError('Chưa thể lưu sở thích. Vui lòng kiểm tra kết nối và thử lại.');
    } finally {
      setSaving(false);
    }
  };

  const chip = (selected: boolean, tone: 'action' | 'warning' = 'action') =>
    `min-h-11 px-4 rounded-pill text-sm font-bold border transition-colors cursor-pointer focus-visible:outline-none focus-visible:shadow-t17-focus ${
      selected
        ? tone === 'action'
          ? 'bg-tk-jade-soft text-tk-jade-deep border-tk-jade/35'
          : 'bg-tk-flame-soft text-tk-flame-deep border-tk-flame/35'
        : 'bg-white text-tk-secondary border-tk-stone hover:border-tk-ink/25'
    }`;

  return (
    <AccountPage
      title="Sở thích & hạn chế"
      description="Gu ẩm thực và danh sách kiêng kỵ được đồng bộ hai chiều trên toàn bộ Takolio."
    >
      {/* Unified Two-Way Sync Banner */}
      <BentoCard tone="jade" padding="sm" className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <AllergenShieldIcon size={20} tone="jade" active className="mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-wider text-tk-jade-deep">
              Đồng bộ Khám phá Món &amp; Thực đơn Mâm Cơm
            </p>
            <p className="text-xs text-tk-secondary leading-relaxed mt-0.5">
              Số người ăn, độ cay và nguyên liệu kiêng kỵ lưu tại đây sẽ tự động cập nhật sang gợi ý
              công thức hàng ngày và Thực đơn 7 ngày.
            </p>
          </div>
        </div>
        <Link
          to="/settings/planning"
          className="shrink-0 text-xs font-extrabold text-tk-jade-deep hover:underline self-center"
        >
          Thói quen bữa
        </Link>
      </BentoCard>

      {isGuestOffline && (
        <p className="rounded-2xl border border-tk-turmeric/30 bg-tk-turmeric-soft px-4 py-2.5 text-xs font-semibold text-tk-turmeric-deep">
          Phiên dùng thử ngoại tuyến: thay đổi chỉ áp dụng trong phiên này và sẽ mất khi tải lại ứng
          dụng.
        </p>
      )}

      {prefsQuery.isPending && !draft && <InlineLoading label="Đang tải sở thích…" />}
      {prefsQuery.isError && (
        <InlineError error={prefsQuery.error} onRetry={() => void prefsQuery.refetch()} />
      )}

      {draft && (
        <fieldset disabled={saving} className="account-editor space-y-4 pb-8">
          <legend className="sr-only">Chọn cài đặt</legend>

          <BentoCard tone="ceramic" padding="md">
            <fieldset>
              <legend className="font-heading font-extrabold text-sm text-tk-ink flex items-center gap-2 mb-3">
                <HouseholdTrayIcon size={18} tone="jade" active />
                <span>Số người thường ăn</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((n) => {
                  const selected = n === 5 ? draft.householdSize >= 5 : draft.householdSize === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => setDraft({ ...draft, householdSize: n })}
                      className={`min-h-11 min-w-12 px-4 rounded-2xl text-sm font-extrabold border transition-colors cursor-pointer tk-tabular focus-visible:outline-none focus-visible:shadow-t17-focus ${
                        selected
                          ? 'bg-tk-flame text-white border-tk-flame shadow-xs'
                          : 'bg-white text-tk-secondary border-tk-stone hover:border-tk-ink/25'
                      }`}
                    >
                      {n === 5 ? '5+' : n}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          </BentoCard>

          <BentoCard tone="ceramic" padding="md">
            <fieldset>
              <legend className="font-heading font-extrabold text-sm text-tk-ink flex items-center gap-2 mb-3">
                <ChopsticksBowlIcon size={18} tone="jade" active />
                <span>Món ưa thích</span>
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
                    {tag.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </BentoCard>

          <BentoCard tone="ceramic" padding="md">
            <fieldset>
              <div className="flex items-center justify-between gap-2 mb-3">
                <legend className="font-heading font-extrabold text-sm text-tk-ink flex items-center gap-2">
                  <AllergenShieldIcon size={18} tone="flame" active />
                  <span>Nguyên liệu hạn chế</span>
                </legend>
                {draft.dietaryRestrictions.length > 0 && (
                  <AtelierBadge tone="flame">
                    Đang tránh {draft.dietaryRestrictions.length} nhóm
                  </AtelierBadge>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {RESTRICTION_TAGS.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    aria-pressed={draft.dietaryRestrictions.includes(tag.id)}
                    onClick={() => toggleTag(tag.id, 'dietaryRestrictions')}
                    className={chip(draft.dietaryRestrictions.includes(tag.id), 'warning')}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-tk-muted mt-3">
                Giới hạn này giúp lọc gợi ý món và thực đơn tự động, không thay thế tư vấn y tế.
              </p>
            </fieldset>
          </BentoCard>

          <BentoCard tone="ceramic" padding="md">
            <fieldset>
              <legend className="font-heading font-extrabold text-sm text-tk-ink flex items-center gap-2 mb-3">
                <FlameMediumIcon size={18} tone="flame" active />
                <span>Mức độ cay</span>
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
                    {level.label}
                  </button>
                ))}
              </div>
            </fieldset>
          </BentoCard>

          {error && (
            <p
              ref={errorRef}
              tabIndex={-1}
              role="alert"
              className="rounded-2xl border border-tk-berry/25 bg-tk-berry-soft px-4 py-3 text-sm font-semibold text-tk-berry-deep"
            >
              {error}
            </p>
          )}
          {savedAt && !error && (
            <p
              role="status"
              className="rounded-2xl border border-tk-jade/30 bg-tk-jade-soft px-4 py-3 text-sm font-bold text-tk-jade-deep"
            >
              {isGuestOffline ? 'Đã áp dụng sở thích cho phiên dùng thử này.' : 'Đã lưu sở thích.'}
            </p>
          )}

          <StickyActions>
            <Button variant="primary" fullWidth onClick={save} disabled={saving} isLoading={saving}>
              Lưu sở thích
            </Button>
          </StickyActions>
        </fieldset>
      )}
    </AccountPage>
  );
};
