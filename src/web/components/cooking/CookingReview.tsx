import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RecipeScoringContext } from '@frigo/recipes';
import { ArrowLeft, Check, Minus, Plus, RefreshCw, Star } from 'lucide-react';
import { clsx } from 'clsx';
import { useCookingStore } from '../../stores/useCookingStore';
import { cookingQuantityText, cookingUnitLabel } from '../../lib/cooking-review';
import { submitCookingCompletion } from '../../lib/cooking-completion';
import { fetchJson } from '../../services/http';
import { inventoryApi } from '../../services/inventory';
import { capturePrivateSession } from '../../lib/private-session';
import { getIngredientImage } from '../../lib/ingredient-images';
import { playCookingCelebrationChord } from '../../lib/audio-effects';
import { resolveRecipeImageV4 } from '../../lib/recipe-media';
import {
  ActionButton,
  AtelierBadge,
  BentoCard,
} from '../../design-system/v4/AtelierPrimitives';
import {
  FreshnessShieldIcon,
  LeftoverBoxIcon,
  NavFridgeIcon,
  PlatingSparkleIcon,
  TakolioWordmarkLockup,
} from '../../design-system/icons';
import { TakoChef3D } from '../3d';

const RATING_LABELS_VI: Record<number, string> = {
  1: 'Chưa hợp khẩu vị',
  2: 'Tạm ổn, cần chỉnh lửa/vị',
  3: 'Ngon vừa miệng',
  4: 'Rất ngon, cả nhà khen!',
  5: 'Xuất sắc chuẩn Bếp Trưởng!',
};

const QUICK_TASTE_CHIPS = [
  'Vừa miệng cả nhà',
  'Sốt sánh đậm đà bắt cơm',
  'Nguyên liệu tươi ngọt',
  'Lần sau giảm nhẹ lửa',
] as const;

function computeTwoDayExpiryIso(): string {
  const target = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
  return target.toISOString().slice(0, 10);
}

export function CookingReview() {
  const state = useCookingStore();
  const {
    activeRecipe: recipe,
    deductions,
    deductionInputs,
    deductionErrors,
    attempt,
    leftoverPortions,
    rating,
    cookingNotes,
  } = state;

  const heading = useRef<HTMLHeadingElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const mounted = useRef(false);
  const refreshing = useRef(false);
  const leftoverSavedForRunRef = useRef<string | null>(null);

  const [refreshStatus, setRefreshStatus] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [leftoverSavedBanner, setLeftoverSavedBanner] = useState<string | null>(null);

  const locked = Boolean(attempt);
  const done = attempt?.status === 'saved' || attempt?.status === 'queued';

  useEffect(() => {
    mounted.current = true;
    useCookingStore.getState().clearTimer();
    playCookingCelebrationChord();
    heading.current?.focus();
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (done) {
      heading.current?.focus();
    }
  }, [done]);

  // Persist leftover portions into Fridge automatically when user opted in and cooking succeeded
  useEffect(() => {
    if (!done || !recipe || leftoverPortions <= 0 || !state.runId) return;
    if (leftoverSavedForRunRef.current === state.runId) return;
    leftoverSavedForRunRef.current = state.runId;

    const expiryDate = computeTwoDayExpiryIso();
    void inventoryApi
      .addInventoryItem({
        name: `Phần ăn dư: ${recipe.title}`,
        quantity: leftoverPortions,
        unit: 'piece',
        category: 'other',
        storage: 'fridge',
        expiryDate,
        dataSource: 'manual',
      })
      .then(() => {
        if (mounted.current) {
          setLeftoverSavedBanner(
            `Đã cất ${leftoverPortions} phần “${recipe.title}” vào Ngăn mát Tủ lạnh (hạn dùng ${expiryDate}).`,
          );
        }
      })
      .catch(() => {
        // Best-effort secondary convenience write; never mask primary completion receipt
      });
  }, [done, recipe, leftoverPortions, state.runId]);

  useEffect(() => {
    if (attempt?.error) errorRef.current?.focus();
  }, [attempt?.error]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!done) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [done]);

  if (!recipe) return null;

  const dishPhoto = resolveRecipeImageV4(recipe);

  const refresh = async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    setIsRefreshing(true);
    setRefreshStatus('Đang tải lượng trong tủ…');
    const isCurrent = capturePrivateSession();
    const runId = state.runId;
    const current = () =>
      mounted.current && isCurrent() && useCookingStore.getState().runId === runId;
    try {
      const result = await fetchJson<{ items: RecipeScoringContext['inventory'] }>('/inventory');
      if (!Array.isArray(result.items)) throw new Error('Invalid inventory');
      if (!current()) return;
      state.refreshStock(result.items);
      setRefreshStatus(
        'Đã tải lại lượng trong tủ. Lượng đã dùng của bạn được giữ nguyên; kiểm tra trước khi gửi lại.',
      );
    } catch {
      if (current()) {
        setRefreshStatus(
          'Chưa tải lại được lượng trong tủ. Hãy kiểm tra kết nối rồi thử tải lại; lượng đã gửi vẫn khóa.',
        );
      }
    } finally {
      refreshing.current = false;
      if (current()) setIsRefreshing(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const invalid = deductionErrors.findIndex(Boolean);
    if (invalid >= 0) {
      document.getElementById(`cooking-use-${invalid}`)?.focus();
      return;
    }
    void submitCookingCompletion();
  };

  const adjust = (index: number, direction: number) => {
    const line = deductions[index];
    if (!line) return;
    const step = ['kg', 'l'].includes(line.unit) ? 0.1 : ['g', 'ml'].includes(line.unit) ? 10 : 1;
    const input = deductionInputs[index] ?? '';
    if (input.trim() === '' || !Number.isFinite(Number(input))) return;
    state.editDeduction(
      index,
      String(Math.max(0, Number((Number(input) + direction * step).toFixed(9)))),
    );
  };

  const appendQuickNote = (chip: string) => {
    if (locked) return;
    const existing = cookingNotes.trim();
    if (existing.includes(chip)) return;
    state.setCookingNotes(existing ? `${existing} · ${chip}` : chip);
  };

  return (
    <div className="cooking-review min-h-dvh bg-tk-canvas text-tk-ink pb-16">
      {/* Studio Top Bar */}
      <header className="cooking-review-header sticky top-0 z-30 border-b border-tk-stone/85 bg-tk-canvas/92 backdrop-blur-md px-4 sm:px-6 py-3">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3">
          {!locked ? (
            <Link
              className="cooking-control inline-flex items-center gap-2 rounded-2xl border border-tk-stone bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-tk-ink shadow-2xs hover:bg-tk-sunken transition-colors"
              to={`/cook/${recipe.slug}?servings=${recipe.servings}${
                state.contentFingerprint ? `&contentFingerprint=${state.contentFingerprint}` : ''
              }`}
            >
              <ArrowLeft aria-hidden="true" size={17} />
              <span>Quay lại bước nấu</span>
            </Link>
          ) : (
            <span />
          )}

          <TakolioWordmarkLockup size={30} tone="ink" />
        </div>
      </header>

      <form
        onSubmit={submit}
        noValidate
        className="cooking-review-grid mx-auto max-w-[1200px] px-4 sm:px-6 pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
      >
        {/* Left Column: 3D Celebration + Leftover Saver + 5-Star Culinary Rating */}
        <div className="cooking-review-intro lg:col-span-5 space-y-5">
          <BentoCard
            tone={done ? 'jade' : 'flame'}
            padding="md"
            className="space-y-4 overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="shrink-0">
                <TakoChef3D pose="celebrate" size={160} interactive={false} />
              </div>

              <div className="space-y-1.5 text-center sm:text-left min-w-0">
                <AtelierBadge
                  tone={done ? 'jade' : 'flame'}
                  icon={<PlatingSparkleIcon size={13} tone={done ? 'jade' : 'flame'} />}
                >
                  {done ? 'Ghi nhận bữa nấu hoàn tất' : 'Bước cuối · Hoàn thành món ngon'}
                </AtelierBadge>

                <h1
                  ref={heading}
                  tabIndex={-1}
                  className="font-heading text-2xl sm:text-[26px] font-extrabold tracking-tight text-tk-ink focus:outline-none"
                >
                  {done
                    ? attempt?.status === 'queued'
                      ? 'Đã lưu trên thiết bị'
                      : 'Đã cập nhật tủ lạnh'
                    : 'Món ăn hoàn tất!'}
                </h1>

                <p className="cooking-dish-title text-sm sm:text-base font-bold text-tk-flame-deep">
                  {recipe.title}
                </p>
              </div>
            </div>

            {/* Dish Photo Preview Banner */}
            <div className="relative h-36 w-full overflow-hidden rounded-2xl border border-tk-stone/70">
              <img
                src={dishPhoto.src}
                alt={recipe.title}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <span className="absolute left-3 bottom-2.5 text-xs font-extrabold text-white tk-tabular">
                {recipe.servings} khẩu phần · Chu trình bếp khép kín FEFO
              </span>
            </div>

            <p className="text-xs sm:text-sm leading-relaxed text-tk-secondary">
              {done
                ? attempt?.status === 'queued'
                  ? 'Yêu cầu đang chờ đồng bộ. Chưa xác nhận kết quả trên máy chủ; hãy kiểm tra trạng thái đồng bộ trong Tủ lạnh khi có mạng.'
                  : 'Máy chủ đã ghi nhận bữa nấu và khấu trừ chính xác lô nguyên liệu theo chuẩn FEFO.'
                : 'Kiểm tra lượng bạn thực sự đã dùng bên phải. Tủ lạnh chỉ được cập nhật sau khi bạn xác nhận.'}
            </p>

            <div className="cooking-review-note flex items-start gap-2.5 rounded-2xl border border-tk-stone/80 bg-white/85 p-3 text-xs text-tk-secondary">
              <NavFridgeIcon size={18} tone="jade" active className="mt-0.5" />
              <p>
                Lượng còn lại là dự kiến từ dữ liệu lúc mở món. Máy chủ kiểm tra lại số lượng khi nhận yêu cầu.
              </p>
            </div>

            {leftoverSavedBanner && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-2xl border border-tk-jade/30 bg-tk-jade-soft p-3 text-xs font-bold text-tk-jade-deep"
              >
                <FreshnessShieldIcon size={16} tone="jade" className="mt-0.5" />
                <span>{leftoverSavedBanner}</span>
              </div>
            )}

            {attempt?.error && (
              <p
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                className="cooking-error rounded-2xl border border-tk-berry/35 bg-tk-berry-soft p-3.5 text-xs sm:text-sm font-bold text-tk-berry-deep focus:outline-none"
              >
                {attempt.error}
              </p>
            )}

            {refreshStatus && (
              <p role="status" className="cooking-feedback text-xs font-semibold text-tk-secondary">
                {refreshStatus}
              </p>
            )}

            {attempt?.status === 'rejected' && (
              <ActionButton
                variant="ceramic"
                fullWidth
                disabled={isRefreshing}
                icon={<RefreshCw size={15} className={clsx(isRefreshing && 'animate-spin')} />}
                onClick={() => void refresh()}
              >
                {isRefreshing ? 'Đang tải lại…' : 'Tải lại lượng trong tủ để kiểm tra'}
              </ActionButton>
            )}

            {attempt?.status === 'restricted' && (
              <ActionButton
                variant="ceramic"
                fullWidth
                to="/recipes"
                onClick={() => state.resetCooking()}
              >
                Kết thúc và chọn món khác
              </ActionButton>
            )}

            {attempt?.status === 'blocked' && (
              <ActionButton variant="ceramic" fullWidth to="/fridge">
                Kiểm tra Tủ lạnh
              </ActionButton>
            )}

            {attempt?.status === 'uncertain' && (
              <ActionButton type="submit" variant="flame" fullWidth>
                Thử lại cùng yêu cầu
              </ActionButton>
            )}

            {attempt?.status === 'sending' && (
              <p role="status" className="text-sm font-bold text-tk-flame animate-pulse">
                Đang gửi yêu cầu hoàn tất…
              </p>
            )}

            {done && (
              <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                <ActionButton
                  variant="jade"
                  size="lg"
                  fullWidth
                  icon={<Check aria-hidden="true" size={18} />}
                  to="/fridge"
                  onClick={() => state.resetCooking()}
                >
                  Xem Tủ lạnh
                </ActionButton>
                <ActionButton
                  variant="ceramic"
                  size="lg"
                  to="/recipes"
                  onClick={() => state.resetCooking()}
                >
                  Khám phá món mới
                </ActionButton>
              </div>
            )}
          </BentoCard>

          {/* Closed-Loop Leftover Saver Card */}
          <BentoCard tone="ceramic" padding="md" className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-tk-jade-soft">
                  <LeftoverBoxIcon size={22} tone="jade" active={leftoverPortions > 0} />
                </span>
                <div>
                  <h2 className="text-sm sm:text-base font-extrabold text-tk-ink">
                    Cất phần ăn dư vào Tủ lạnh
                  </h2>
                  <p className="text-xs text-tk-secondary mt-0.5">
                    Tự động gắn nhãn +2 ngày hạn dùng để nhắc hâm nóng cho bữa mai.
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  aria-label="Giảm phần ăn dư"
                  disabled={locked || leftoverPortions <= 0}
                  onClick={() => state.setLeftoverPortions(Math.max(0, leftoverPortions - 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-tk-stone bg-tk-canvas text-tk-ink hover:bg-tk-sunken disabled:opacity-40 cursor-pointer"
                >
                  <Minus size={15} aria-hidden="true" />
                </button>
                <span className="min-w-[56px] text-center text-sm font-extrabold text-tk-ink tk-tabular">
                  {leftoverPortions} phần
                </span>
                <button
                  type="button"
                  aria-label="Tăng phần ăn dư"
                  disabled={locked || leftoverPortions >= 12}
                  onClick={() => state.setLeftoverPortions(Math.min(12, leftoverPortions + 1))}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-tk-stone bg-tk-canvas text-tk-ink hover:bg-tk-sunken disabled:opacity-40 cursor-pointer"
                >
                  <Plus size={15} aria-hidden="true" />
                </button>
              </div>
            </div>

            {leftoverPortions > 0 && (
              <p className="rounded-xl bg-tk-jade-soft/70 px-3 py-2 text-xs font-bold text-tk-jade-deep">
                Sẽ lưu {leftoverPortions} phần dư “{recipe.title}” vào Ngăn mát (+2 ngày hạn dùng) ngay khi xác nhận!
              </p>
            )}
          </BentoCard>

          {/* 5-Star Culinary Rating & Household Taste Notes */}
          <BentoCard tone="ceramic" padding="md" className="space-y-3.5">
            <div className="space-y-1">
              <h2 className="text-sm sm:text-base font-extrabold text-tk-ink">
                Đánh giá hương vị bữa ăn
              </h2>
              <p className="text-xs text-tk-secondary">
                Giúp Takolio tinh chỉnh gợi ý món hợp khẩu vị gia đình bạn hơn mỗi tuần.
              </p>
            </div>

            <div className="flex items-center gap-1.5" role="group" aria-label="Chấm điểm món ăn từ 1 đến 5 sao">
              {[1, 2, 3, 4, 5].map((star) => {
                const active = (rating ?? 0) >= star;
                return (
                  <button
                    key={star}
                    type="button"
                    disabled={locked}
                    aria-label={`${star} sao`}
                    aria-pressed={rating === star}
                    onClick={() => state.setRating(rating === star ? null : star)}
                    className={clsx(
                      'flex h-11 w-11 items-center justify-center rounded-2xl border transition-tap cursor-pointer',
                      active
                        ? 'border-amber-400 bg-tk-turmeric-soft text-amber-500 shadow-2xs'
                        : 'border-tk-stone bg-tk-canvas text-tk-muted hover:text-amber-400',
                    )}
                  >
                    <Star size={22} fill={active ? 'currentColor' : 'none'} aria-hidden="true" />
                  </button>
                );
              })}
              {rating && (
                <span className="ml-2 text-xs font-extrabold text-tk-turmeric-deep">
                  {RATING_LABELS_VI[rating]}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {QUICK_TASTE_CHIPS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  disabled={locked}
                  onClick={() => appendQuickNote(chip)}
                  className="rounded-full border border-tk-stone bg-tk-canvas px-2.5 py-1 text-[11px] font-bold text-tk-secondary hover:border-tk-flame/40 hover:text-tk-ink cursor-pointer"
                >
                  + {chip}
                </button>
              ))}
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-bold text-tk-secondary">Ghi chú bếp nhà (tùy chọn)</span>
              <textarea
                rows={2}
                disabled={locked}
                value={cookingNotes}
                onChange={(e) => state.setCookingNotes(e.target.value)}
                placeholder="Ví dụ: Gia đình thích kho thêm 5 phút cho keo sốt…"
                className="w-full rounded-2xl border border-tk-stone bg-tk-canvas px-3.5 py-2 text-xs sm:text-sm text-tk-ink placeholder:text-tk-muted focus:border-tk-flame focus:bg-white focus:outline-none"
              />
            </label>
          </BentoCard>
        </div>

        {/* Right Column: Precision FEFO Stock Deduction Table */}
        <section
          className="cooking-use-list lg:col-span-7 space-y-4"
          aria-labelledby="cooking-use-title"
        >
          <BentoCard tone="ceramic" padding="md" className="space-y-4">
            <div className="border-b border-tk-stone/80 pb-3 space-y-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="cooking-use-title" className="text-lg sm:text-xl font-extrabold text-tk-ink">
                  Lượng thực dùng khấu trừ Tủ lạnh
                </h2>
                <AtelierBadge tone="jade">Chuẩn FEFO tự động</AtelierBadge>
              </div>
              <p className="text-xs sm:text-sm text-tk-secondary">
                Nhập 0 cho nguyên liệu không dùng. Có thể chỉnh số lẻ chính xác theo thực tế nấu.
              </p>
            </div>

            {deductions.length === 0 && (
              <p className="rounded-2xl bg-tk-sunken p-4 text-sm text-tk-secondary">
                Món này chưa có danh sách nguyên liệu; xác nhận chỉ ghi nhận bữa nấu.
              </p>
            )}

            <div className="space-y-3">
              {deductions.map((line, index) => {
                const err = deductionErrors[index];
                const rawVal = deductionInputs[index] ?? '';
                return (
                  <div
                    className={clsx(
                      'cooking-use-row rounded-2xl border p-3.5 space-y-2.5 transition-colors',
                      err
                        ? 'border-tk-berry/45 bg-tk-berry-soft/35'
                        : 'border-tk-stone/85 bg-tk-canvas/75',
                    )}
                    key={`${line.ingredientId}-${index}`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="cooking-use-item-head flex min-w-0 items-center gap-3">
                        <img
                          src={getIngredientImage(line.ingredientId, line.name)}
                          alt=""
                          width={40}
                          height={40}
                          loading="lazy"
                          className="cooking-use-item-icon h-10 w-10 shrink-0 rounded-xl border border-tk-stone/70 bg-white p-1 object-contain"
                        />
                        <div className="min-w-0 flex-1">
                          <label
                            htmlFor={`cooking-use-${index}`}
                            className="block text-sm sm:text-base font-extrabold text-tk-ink cursor-pointer"
                          >
                            {line.name}
                          </label>
                          <p className="text-xs text-tk-secondary tk-tabular mt-0.5">
                            Trong tủ:{' '}
                            <strong className="text-tk-ink">
                              {cookingQuantityText(line.currentQuantity, line.unit)}
                            </strong>{' '}
                            · Còn dự kiến:{' '}
                            <strong className={clsx(err ? 'text-tk-berry' : 'text-tk-jade-deep')}>
                              {err
                                ? 'Chưa xác định'
                                : cookingQuantityText(line.remainingQuantity, line.unit)}
                            </strong>
                          </p>
                        </div>
                      </div>

                      <div className="cooking-use-controls inline-flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        <button
                          type="button"
                          aria-label={`Giảm lượng ${line.name}`}
                          disabled={locked || rawVal.trim() === '' || Number(rawVal) <= 0}
                          onClick={() => adjust(index, -1)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-tk-stone bg-white text-tk-ink shadow-2xs hover:bg-tk-sunken disabled:opacity-40 cursor-pointer"
                        >
                          <Minus aria-hidden="true" size={16} />
                        </button>

                        <div className="flex items-center rounded-xl border border-tk-stone bg-white px-2.5 h-10 focus-within:border-tk-flame focus-within:ring-2 focus-within:ring-tk-flame/20">
                          <input
                            id={`cooking-use-${index}`}
                            name={`quantity-${index}`}
                            type="number"
                            inputMode="decimal"
                            autoComplete="off"
                            min="0"
                            max="100000"
                            step="any"
                            disabled={locked}
                            aria-label={`Lượng đã dùng: ${line.name}`}
                            aria-invalid={Boolean(err)}
                            aria-describedby={`cooking-use-hint-${index}`}
                            value={rawVal}
                            onChange={(event) => state.editDeduction(index, event.target.value)}
                            className="w-20 bg-transparent text-right text-sm font-extrabold text-tk-ink tk-tabular focus:outline-none"
                          />
                          <span className="ml-1.5 text-xs font-bold text-tk-muted">
                            {cookingUnitLabel(line.unit)}
                          </span>
                        </div>

                        <button
                          type="button"
                          aria-label={`Tăng lượng ${line.name}`}
                          disabled={
                            locked ||
                            rawVal.trim() === '' ||
                            Number(rawVal) >= Math.min(100000, line.currentQuantity)
                          }
                          onClick={() => adjust(index, 1)}
                          className="flex h-10 w-10 items-center justify-center rounded-xl border border-tk-stone bg-white text-tk-ink shadow-2xs hover:bg-tk-sunken disabled:opacity-40 cursor-pointer"
                        >
                          <Plus aria-hidden="true" size={16} />
                        </button>
                      </div>
                    </div>

                    <p
                      id={`cooking-use-hint-${index}`}
                      className={clsx(
                        'text-xs',
                        err ? 'cooking-error font-bold text-tk-berry-deep' : 'cooking-use-hint text-tk-muted',
                      )}
                      aria-live="polite"
                    >
                      {err ?? 'Lượng đã dùng tính theo đơn vị của công thức.'}
                    </p>
                  </div>
                );
              })}
            </div>

            {!attempt && (
              <div className="cooking-review-action pt-2 space-y-2">
                <ActionButton
                  type="submit"
                  variant="flame"
                  size="xl"
                  fullWidth
                  disabled={deductionErrors.some(Boolean)}
                  icon={<Check aria-hidden="true" size={20} />}
                >
                  Xác nhận &amp; Cập nhật tủ lạnh
                </ActionButton>
                <p className="text-center text-xs text-tk-muted">
                  Bạn xác nhận đúng lượng thực dùng ở trên để Takolio cập nhật tồn kho chính xác.
                </p>
              </div>
            )}
          </BentoCard>
        </section>
      </form>
    </div>
  );
}
