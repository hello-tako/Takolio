import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { clsx } from 'clsx';
import '../styles/tokens.css';
import { useAuthStore } from '../../stores/useAuthStore';
import { api } from '../../services/api';
import { guardPrivateSession } from '../../services/http';
import { capturePrivateSession, isOfflineGuestSession } from '../../lib/private-session';
import {
  DEFAULT_FAMILY_PREFERENCES,
  familyPreferencesApi,
  type FamilyPreferences,
} from '../../services/family-preferences';
import { familyPreferencesKey, useFamilyPreferences } from '../../features/family/useFamilyPreferences';
import { useBrandDirection } from '../feature';
import { G02DirectionPreviewBar } from '../components/Shells';
import { BrandLockup, MascotIllustration } from '../components/VNextMedia';
import { TkvBadge, TkvButton, TkvIconButton, TkvSurface } from '../components/Primitives';
import { VNextIcon } from '../components/VNextIcons';

const VISIBLE_BUCKETS = [1, 2, 3, 4, 5] as const;

/**
 * O03 — Gia đình và khẩu phần (G02 Live Pilot).
 * Matches `O03.png` anatomy:
 * - Top bar with Brand Lockup + "Bỏ qua" + 6-segment progress indicator (step 3 of 6 active)
 * - Circular mint studio medallion with original guide mascot
 * - "Gia đình bạn có bao nhiêu người?" 5 choice pills (`1`, `2`, `3`, `4`, `5+`)
 * - Exact `5..20` server-truth stepper when `5+` is chosen (no fake household members!)
 * - Wired to `familyPreferencesApi.save` + `api.completeOnboarding` / `/onboarding/preferences`
 */
export const O03HouseholdPilot: React.FC = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  const [direction, setDirection] = useBrandDirection(search);
  const auth = useAuthStore();
  const queryClient = useQueryClient();
  const familyQuery = useFamilyPreferences();

  const [family, setFamily] = useState<FamilyPreferences | null>(() =>
    isOfflineGuestSession() ? DEFAULT_FAMILY_PREFERENCES : null,
  );
  const [draftRevision, setDraftRevision] = useState<number | null>(null);
  const [householdSize, setHouseholdSize] = useState<number>(() => {
    const stored = auth.householdSize;
    return Number.isInteger(stored) && stored >= 1 && stored <= 20 ? stored : 3;
  });
  const editedRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (familyQuery.data && !family) {
      setFamily(familyQuery.data.preferences);
      setDraftRevision(familyQuery.data.revision);
      if (familyQuery.data.revision > 0 && !editedRef.current) {
        setHouseholdSize(familyQuery.data.preferences.householdSize);
      }
    }
  }, [familyQuery.data, family]);

  const selectBucket = (bucket: number) => {
    editedRef.current = true;
    setErrorMessage(null);
    if (bucket === 5 && householdSize > 5) return;
    setHouseholdSize(bucket);
  };

  const adjustExactSize = (delta: number) => {
    editedRef.current = true;
    setErrorMessage(null);
    setHouseholdSize((prev) => Math.max(1, Math.min(20, prev + delta)));
  };

  const persistAndAdvance = async (completeImmediately: boolean) => {
    setErrorMessage(null);
    const normalizedSpicy =
      auth.spicyLevel === 'none' || auth.spicyLevel === 'mild' || auth.spicyLevel === 'hot'
        ? auth.spicyLevel
        : 'medium';
    // Preview-only visitor without active session can still test interaction safely
    if (!auth.userId || !auth.householdId) {
      auth.setOnboardingFromServer(completeImmediately, { householdSize });
      navigate(completeImmediately ? '/vnext/c01' : '/onboarding/preferences');
      return;
    }

    const isCurrent = capturePrivateSession();
    setIsSaving(true);
    try {
      const assertCurrent = guardPrivateSession();
      const key = familyPreferencesKey();
      if (!isOfflineGuestSession() && family && draftRevision !== null) {
        const saved = await familyPreferencesApi.save(draftRevision, {
          ...family,
          householdSize,
        });
        assertCurrent();
        queryClient.setQueryData(key, saved);
        setDraftRevision(saved.revision);
      }
      if (completeImmediately && !isOfflineGuestSession()) {
        await api.completeOnboarding({
          householdSize,
          spicyLevel: normalizedSpicy,
          favoriteCuisines: auth.favoriteCuisines,
          dietaryRestrictions: auth.dietaryRestrictions,
        });
        assertCurrent();
        if (!isCurrent()) return;
        auth.setOnboardingData({
          householdSize,
          spicyLevel: normalizedSpicy,
          favoriteCuisines: auth.favoriteCuisines,
          dietaryRestrictions: auth.dietaryRestrictions,
        });
        navigate('/?vnext=1', { replace: true });
        return;
      }
      if (!isCurrent()) return;
      auth.setOnboardingFromServer(auth.isOnboarded, { householdSize });
      navigate('/onboarding/preferences');
    } catch (err) {
      if (!isCurrent()) return;
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Chưa lưu được khẩu phần hộ gia đình. Vui lòng thử lại.',
      );
    } finally {
      if (isCurrent()) setIsSaving(false);
    }
  };

  return (
    <div className="tkv-root min-h-dvh flex flex-col" data-tkv-direction={direction} data-tkv-screen="O03">
      <a href="#tkv-o03-main" className="tkv-skip-link">
        Đến lựa chọn quy mô gia đình
      </a>
      <G02DirectionPreviewBar direction={direction} onDirectionChange={setDirection} screenId="O03" />

      <main
        id="tkv-o03-main"
        tabIndex={-1}
        className="flex-1 max-w-[980px] w-full mx-auto px-4 sm:px-6 py-5 sm:py-10 flex items-center justify-center"
      >
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Primary Onboarding Card — matches O03.png structure 1:1 on 390×844 */}
          <TkvSurface className="lg:col-span-7 p-6 sm:p-8 space-y-6">
            <div className="flex items-center justify-between gap-3">
              <Link to="/landing?vnext=1" className="tkv-focusable rounded-xl py-1">
                <BrandLockup direction={direction} />
              </Link>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void persistAndAdvance(true)}
                className="tkv-focusable min-h-[44px] px-3 rounded-xl text-sm font-bold text-[var(--tkv-primary)] hover:bg-[var(--tkv-surface-mint)]"
              >
                Bỏ qua
              </button>
            </div>

            {/* 6-Step Progress Rail (O01..O06; step 3 active for O03) */}
            <div aria-label="Tiến độ thiết lập căn bếp: bước 3 trên 6" role="progressbar" aria-valuenow={3} aria-valuemin={1} aria-valuemax={6} className="grid grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6].map((idx) => (
                <span
                  key={idx}
                  className={clsx(
                    'h-2 rounded-full transition-colors',
                    idx <= 3 ? 'bg-[var(--tkv-primary)]' : 'bg-[var(--tkv-surface-mint)]',
                  )}
                />
              ))}
            </div>

            <div className="flex flex-col items-center text-center space-y-3 pt-1">
              <div className="w-32 h-32 rounded-full bg-[var(--tkv-surface-mint)] p-2.5 flex items-center justify-center border border-[var(--tkv-border)]">
                <MascotIllustration pose="guide" size={108} decorative />
              </div>
              <h1 className="tkv-heading text-2xl sm:text-[1.85rem] font-extrabold text-[var(--tkv-ink)]">
                Gia đình và khẩu phần
              </h1>
              <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)] max-w-md">
                Chọn số người ăn thường xuyên để Takolio quy đổi lượng nguyên liệu và khẩu phần hợp lý.
              </p>
            </div>

            {errorMessage && (
              <div
                role="alert"
                className="p-3.5 rounded-2xl bg-[var(--tkv-surface-coral)] border border-[var(--tkv-danger)]/30 text-sm font-semibold text-[var(--tkv-danger)] flex items-center gap-2"
              >
                <VNextIcon name="error" size={18} />
                <span>{errorMessage}</span>
              </div>
            )}

            <fieldset className="space-y-3">
              <legend className="text-base font-extrabold text-[var(--tkv-ink)] mb-2">
                Gia đình bạn có bao nhiêu người?
              </legend>

              <div className="grid grid-cols-5 gap-2.5">
                {VISIBLE_BUCKETS.map((bucket) => {
                  const selected = bucket === 5 ? householdSize >= 5 : householdSize === bucket;
                  return (
                    <button
                      key={bucket}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => selectBucket(bucket)}
                      data-testid={`o03-bucket-${bucket}`}
                      className={clsx(
                        'tkv-focusable min-h-[54px] rounded-2xl font-extrabold text-base transition-colors border',
                        selected
                          ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)] shadow-sm'
                          : 'bg-[var(--tkv-surface-mint)]/65 text-[var(--tkv-primary)] border-[var(--tkv-border)] hover:border-[var(--tkv-primary)]',
                      )}
                    >
                      {bucket === 5 ? '5+' : bucket}
                    </button>
                  );
                })}
              </div>

              {/* Exact 1..20 server-truth adjuster when 5+ is active */}
              {householdSize >= 5 && (
                <div className="mt-3 p-3.5 rounded-2xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-[var(--tkv-ink)]">
                    Số khẩu phần chính xác (tối đa 20):
                  </span>
                  <div className="inline-flex items-center gap-2">
                    <TkvIconButton
                      icon="minus"
                      label="Giảm số người ăn"
                      onClick={() => adjustExactSize(-1)}
                      disabled={householdSize <= 5}
                    />
                    <span className="min-w-[68px] text-center font-extrabold text-base text-[var(--tkv-primary)]">
                      {householdSize} người
                    </span>
                    <TkvIconButton
                      icon="plus"
                      label="Tăng số người ăn"
                      onClick={() => adjustExactSize(1)}
                      disabled={householdSize >= 20}
                    />
                  </div>
                </div>
              )}
            </fieldset>

            <div className="pt-2 space-y-3">
              <TkvButton
                variant="primary"
                size="lg"
                fullWidth
                isLoading={isSaving}
                onClick={() => void persistAndAdvance(false)}
                data-testid="o03-continue-btn"
              >
                Tiếp tục
              </TkvButton>
              <p className="text-xs text-center text-[var(--tkv-ink-muted)]">
                Chỉ dùng để tính khẩu phần món ăn — không tự tạo tài khoản thành viên giả định (U06).
              </p>
            </div>
          </TkvSurface>

          {/* Desktop Portion Preview Workbench (>=1024px) */}
          <aside
            aria-label="Minh họa quy đổi khẩu phần"
            className="hidden lg:flex lg:col-span-5 flex-col gap-4 p-6 rounded-[24px] bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border)]"
          >
            <TkvBadge tone="success" icon="users">
              Khẩu phần mặc định: {householdSize} người
            </TkvBadge>
            <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink)]">
              Định lượng tự động nhân chia theo bàn ăn nhà bạn
            </h2>
            <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">
              Ví dụ với món <strong>Thịt kho tàu nước dừa trứng</strong> chuẩn 4 người (400g thịt ba chỉ, 4 quả trứng), Takolio sẽ quy đổi sang khẩu phần <strong>{householdSize} người</strong>:
            </p>
            <TkvSurface className="p-4 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-[var(--tkv-ink-secondary)]">Thịt ba chỉ</span>
                <span className="font-extrabold text-[var(--tkv-ink)]">
                  {Math.round((400 * householdSize) / 4)} g
                </span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-[var(--tkv-border)] pt-2">
                <span className="font-semibold text-[var(--tkv-ink-secondary)]">Trứng gà ta</span>
                <span className="font-extrabold text-[var(--tkv-ink)]">
                  {Number(((4 * householdSize) / 4).toFixed(1))} quả
                </span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-[var(--tkv-border)] pt-2">
                <span className="font-semibold text-[var(--tkv-ink-secondary)]">Nước mắm Phú Quốc</span>
                <span className="font-extrabold text-[var(--tkv-ink)]">
                  {Math.round((40 * householdSize) / 4)} ml
                </span>
              </div>
            </TkvSurface>
            <p className="text-xs text-[var(--tkv-ink-muted)]">
              Bạn có thể thay đổi lại con số này bất cứ lúc nào tại mục <strong>Tôi → Cài đặt thực đơn</strong>.
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
};
