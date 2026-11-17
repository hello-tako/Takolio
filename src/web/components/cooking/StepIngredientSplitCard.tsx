import React, { useState } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { StepIngredientAllocationV4 } from '@frigo/recipes';
import type { StandardUnit } from '@frigo/domain';
import { getIngredientImage } from '../../lib/ingredient-images';
import {
  aiCopilotApi,
  type CulinaryFridgeItem,
  type DishRole,
  type SmartSubstitutionResponse,
} from '../../services/ai-copilot';
import {
  FreshnessShieldIcon,
  IngredientSwapIcon,
} from '../../design-system/icons';

export interface StepIngredientSplitItem {
  ingredientId: string;
  name: string;
  formattedAmountVi: string;
  roleLabelVi: string;
  allocatedQuantity: number;
  totalRecipeQuantity: number;
  unit: StandardUnit;
  isSplitPortion: boolean;
}

export function mapAllocationsToSplitItems(
  allocations: StepIngredientAllocationV4[],
): StepIngredientSplitItem[] {
  return allocations.map((alloc) => ({
    ingredientId: alloc.ingredientId,
    name: alloc.name,
    formattedAmountVi: alloc.formattedAmountVi,
    roleLabelVi: alloc.roleLabelVi,
    allocatedQuantity: alloc.allocatedQuantity,
    totalRecipeQuantity: alloc.totalRecipeQuantity,
    unit: alloc.unit,
    isSplitPortion: alloc.usageKind === 'split_portion' && alloc.allocationRatio < 0.99,
  }));
}

interface StepIngredientSplitCardProps {
  stepKeyPrefix: string;
  items: StepIngredientSplitItem[];
  checkedMap: Record<string, boolean>;
  swappedMap?: Record<string, { name: string }>;
  onToggleChecked: (key: string) => void;
  onApplySwap?: (
    originalIngredientId: string,
    replacement: { ingredientId: string; name: string; requiredQuantity?: number; unit?: StandardUnit },
  ) => void;
  recipeTitle?: string;
  dishRole?: DishRole;
  fridgeItems?: CulinaryFridgeItem[];
  householdAllergens?: string[];
  dark?: boolean;
}

export const StepIngredientSplitCard: React.FC<StepIngredientSplitCardProps> = ({
  stepKeyPrefix,
  items,
  checkedMap,
  swappedMap,
  onToggleChecked,
  onApplySwap,
  recipeTitle,
  dishRole,
  fridgeItems,
  householdAllergens,
  dark = true,
}) => {
  const [activeSwapId, setActiveSwapId] = useState<string | null>(null);
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapResult, setSwapResult] = useState<SmartSubstitutionResponse | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);

  if (items.length === 0) return null;

  const openSwapFor = async (item: StepIngredientSplitItem) => {
    if (activeSwapId === item.ingredientId) {
      setActiveSwapId(null);
      return;
    }
    setActiveSwapId(item.ingredientId);
    setSwapLoading(true);
    setSwapError(null);
    setSwapResult(null);
    try {
      const response = await aiCopilotApi.recommendSubstitutions({
        ingredientName: item.name,
        ingredientId: item.ingredientId,
        requiredQuantity: item.allocatedQuantity,
        unit: item.unit,
        dishRole,
        recipeTitle,
        fridgeItems,
        householdAllergens,
      });
      setSwapResult(response);
    } catch {
      setSwapError('Chưa tải được gợi ý thay thế lúc này. Vui lòng thử lại.');
    } finally {
      setSwapLoading(false);
    }
  };

  return (
    <div
      aria-label="Định lượng nguyên liệu dùng riêng cho bước này"
      className={clsx(
        'rounded-2xl border p-4 space-y-3',
        dark
          ? 'border-white/12 bg-tk-sanctuary/70 text-white'
          : 'border-tk-stone/85 bg-tk-canvas/90 text-tk-ink',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={clsx(
              'inline-flex h-6 w-6 items-center justify-center rounded-lg text-xs font-extrabold tk-tabular',
              dark ? 'bg-tk-jade/30 text-tk-jade-mint' : 'bg-tk-jade-soft text-tk-jade-deep',
            )}
          >
            {items.length}
          </span>
          <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider">
            Định lượng chuẩn riêng bước này
          </h3>
        </div>
        <span
          className={clsx(
            'text-[11px] font-medium',
            dark ? 'text-white/60' : 'text-tk-muted',
          )}
        >
          Chạm để gạch xong · Bấm Đổi nếu thiếu
        </span>
      </div>

      <ul className="space-y-2">
        {items.map((item, idx) => {
          const checkKey = `${stepKeyPrefix}:${item.ingredientId}:${idx}`;
          const isChecked = Boolean(checkedMap[checkKey]);
          const wasSwapped = Boolean(swappedMap?.[item.ingredientId]);
          const swapOpen = activeSwapId === item.ingredientId;

          return (
            <li key={checkKey} className="space-y-2">
              <div
                className={clsx(
                  'flex items-center justify-between gap-2.5 rounded-2xl border p-2.5 sm:p-3 transition-tap',
                  isChecked
                    ? dark
                      ? 'border-tk-jade/35 bg-tk-jade-deep/35 opacity-75'
                      : 'border-tk-jade/30 bg-tk-jade-soft/50 opacity-75'
                    : dark
                      ? 'border-white/10 bg-tk-sanctuary-elevated/80 hover:border-white/20'
                      : 'border-tk-stone bg-white shadow-2xs hover:border-tk-ink/20',
                )}
              >
                <button
                  type="button"
                  onClick={() => onToggleChecked(checkKey)}
                  aria-pressed={isChecked}
                  aria-label={`${isChecked ? 'Bỏ đánh dấu' : 'Đánh dấu đã chuẩn bị'} ${item.name}`}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer tap-target"
                >
                  <span
                    className={clsx(
                      'flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border transition-colors',
                      isChecked
                        ? 'border-tk-jade bg-tk-jade text-white'
                        : dark
                          ? 'border-white/25 bg-white/5 text-transparent'
                          : 'border-tk-stone bg-tk-canvas text-transparent',
                    )}
                  >
                    <Check size={15} strokeWidth={3} aria-hidden="true" />
                  </span>

                  <img
                    src={getIngredientImage(item.ingredientId, item.name)}
                    alt=""
                    width={32}
                    height={32}
                    loading="lazy"
                    className="h-8 w-8 shrink-0 rounded-lg bg-white/90 p-0.5 object-contain"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={clsx(
                          'text-sm sm:text-base font-extrabold leading-snug',
                          isChecked && 'line-through opacity-75',
                        )}
                      >
                        {item.name}
                      </span>
                      {wasSwapped && (
                        <span className="rounded-full bg-tk-turmeric/20 px-2 py-0.5 text-[10px] font-bold text-tk-turmeric-glow border border-tk-turmeric/30">
                          Đã đổi thông minh
                        </span>
                      )}
                      {item.isSplitPortion && (
                        <span
                          className={clsx(
                            'rounded-full px-2 py-0.5 text-[10px] font-extrabold',
                            dark
                              ? 'bg-tk-flame/25 text-tk-flame-soft border border-tk-flame/35'
                              : 'bg-tk-flame-soft text-tk-flame-deep border border-tk-flame/20',
                          )}
                        >
                          Chia phần cho bước này
                        </span>
                      )}
                    </div>

                    <p
                      className={clsx(
                        'mt-0.5 text-xs sm:text-sm font-bold tk-tabular',
                        dark ? 'text-tk-turmeric-glow' : 'text-tk-jade-deep',
                      )}
                    >
                      {item.formattedAmountVi}
                      {item.roleLabelVi ? (
                        <span
                          className={clsx(
                            'font-medium',
                            dark ? 'text-white/65' : 'text-tk-secondary',
                          )}
                        >
                          {' '}
                          — {item.roleLabelVi}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </button>

                {onApplySwap && (
                  <button
                    type="button"
                    onClick={() => void openSwapFor(item)}
                    aria-expanded={swapOpen}
                    aria-label={`Đổi nguyên liệu thay thế cho ${item.name}`}
                    className={clsx(
                      'shrink-0 inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-bold transition-tap cursor-pointer min-h-[40px]',
                      swapOpen
                        ? 'border-tk-flame bg-tk-flame text-white'
                        : dark
                          ? 'border-white/15 bg-white/8 text-white/90 hover:bg-white/15'
                          : 'border-tk-stone bg-tk-canvas text-tk-secondary hover:bg-tk-sunken hover:text-tk-ink',
                    )}
                  >
                    <IngredientSwapIcon size={15} tone={swapOpen || dark ? 'cream' : 'flame'} />
                    <span className="hidden sm:inline">Đổi nguyên liệu</span>
                  </button>
                )}
              </div>

              {/* Inline Smart AI Substitution Panel */}
              {swapOpen && (
                <div
                  className={clsx(
                    'rounded-2xl border p-3.5 space-y-2.5 animate-slide-up',
                    dark
                      ? 'border-tk-flame/35 bg-tk-sanctuary-card text-white'
                      : 'border-tk-flame/25 bg-tk-flame-soft/45 text-tk-ink',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-tk-flame">
                      <Sparkles size={14} aria-hidden="true" />
                      Gợi ý thay thế cho {item.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveSwapId(null)}
                      aria-label="Đóng gợi ý thay thế"
                      className="rounded-lg p-1 opacity-70 hover:opacity-100 cursor-pointer"
                    >
                      <X size={15} aria-hidden="true" />
                    </button>
                  </div>

                  {swapLoading ? (
                    <p className="text-xs opacity-75 py-2">
                      Đang kiểm tra nguyên liệu tương đương trong tủ lạnh…
                    </p>
                  ) : swapError ? (
                    <p className="text-xs text-tk-berry font-semibold">{swapError}</p>
                  ) : swapResult ? (
                    <div className="space-y-2.5">
                      {swapResult.safetyAlertVi && (
                        <p className="rounded-xl bg-tk-berry/20 border border-tk-berry/35 px-3 py-2 text-xs font-semibold text-tk-berry-glow">
                          {swapResult.safetyAlertVi}
                        </p>
                      )}
                      <div className="space-y-2">
                        {swapResult.substitutions.map((cand) => (
                          <div
                            key={cand.replacementName}
                            className={clsx(
                              'flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-xl border p-2.5',
                              dark
                                ? 'border-white/10 bg-white/5'
                                : 'border-tk-stone bg-white',
                            )}
                          >
                            <div className="space-y-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-xs sm:text-sm font-extrabold">
                                  {cand.replacementName}
                                </span>
                                {cand.inFridge && (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-tk-jade px-2 py-0.5 text-[10px] font-extrabold text-white">
                                    <FreshnessShieldIcon size={11} tone="cream" />
                                    Sẵn trong tủ lạnh
                                  </span>
                                )}
                              </div>
                              <p
                                className={clsx(
                                  'text-xs font-semibold',
                                  dark ? 'text-tk-turmeric-glow' : 'text-tk-jade-deep',
                                )}
                              >
                                {cand.conversionRatioVi}
                                {cand.convertedQuantityVi ? ` · ${cand.convertedQuantityVi}` : ''}
                              </p>
                              <p
                                className={clsx(
                                  'text-[11px] leading-relaxed',
                                  dark ? 'text-white/70' : 'text-tk-secondary',
                                )}
                              >
                                {cand.flavorImpactVi}
                              </p>
                              {cand.fridgeStockNoteVi && (
                                <p className="text-[11px] font-semibold text-tk-jade-mint">
                                  {cand.fridgeStockNoteVi}
                                </p>
                              )}
                            </div>

                            {onApplySwap && (
                              <button
                                type="button"
                                onClick={() => {
                                  onApplySwap(item.ingredientId, {
                                    ingredientId:
                                      cand.replacementCanonicalId ?? item.ingredientId,
                                    name: cand.replacementName,
                                  });
                                  setActiveSwapId(null);
                                }}
                                className="shrink-0 rounded-xl bg-tk-flame px-3 py-2 text-xs font-extrabold text-white shadow-xs hover:bg-tk-flame-hover cursor-pointer min-h-[38px]"
                              >
                                Đổi sang món này
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      <p
                        className={clsx(
                          'text-[11px] italic',
                          dark ? 'text-white/65' : 'text-tk-muted',
                        )}
                      >
                        Mẹo Bếp Trưởng: {swapResult.chefTipVi}
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
