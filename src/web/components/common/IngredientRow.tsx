import React from 'react';
import { Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { FreshnessStatus } from '@frigo/domain';
import { getIngredientImage } from '../../lib/ingredient-images';
import { StatusChip } from './StatusChip';
import { QuantityStepper } from './QuantityStepper';
import { presentExpiry } from '../../lib/inventory-truth';
import { inventoryQuantityStep } from '../../lib/inventory-quantity';
import {
  CatDairyEggIcon,
  CatFruitIcon,
  CatGrainDryIcon,
  CatMeatIcon,
  CatOtherIcon,
  CatSeafoodIcon,
  CatSpiceSauceIcon,
  CatVegetableIcon,
  ZoneCoolIcon,
  ZoneFreezeIcon,
  ZonePantryIcon,
  type TakolioIconProps,
} from '../../design-system/icons';

export function resolveCategoryIcon(category?: string): {
  Icon: React.FC<TakolioIconProps>;
  tone: TakolioIconProps['tone'];
  labelVi: string;
} {
  switch (category) {
    case 'vegetable':
      return { Icon: CatVegetableIcon, tone: 'jade', labelVi: 'Rau củ' };
    case 'meat':
      return { Icon: CatMeatIcon, tone: 'flame', labelVi: 'Thịt' };
    case 'seafood':
      return { Icon: CatSeafoodIcon, tone: 'ink', labelVi: 'Hải sản' };
    case 'egg':
    case 'dairy':
    case 'dairy_egg':
      return { Icon: CatDairyEggIcon, tone: 'turmeric', labelVi: 'Trứng & Sữa' };
    case 'fruit':
      return { Icon: CatFruitIcon, tone: 'flame', labelVi: 'Trái cây' };
    case 'grain':
      return { Icon: CatGrainDryIcon, tone: 'turmeric', labelVi: 'Ngũ cốc & Đồ khô' };
    case 'spice':
    case 'spice_sauce':
    case 'condiment':
      return { Icon: CatSpiceSauceIcon, tone: 'flame', labelVi: 'Gia vị & Sốt' };
    default:
      return { Icon: CatOtherIcon, tone: 'ink', labelVi: 'Khác' };
  }
}

export function resolveStorageZoneBadge(storage?: string): {
  Icon: React.FC<TakolioIconProps>;
  tone: TakolioIconProps['tone'];
  labelVi: string;
} {
  if (storage === 'freezer' || storage === 'freeze') {
    return { Icon: ZoneFreezeIcon, tone: 'ink', labelVi: 'Ngăn đông' };
  }
  if (storage === 'pantry') {
    return { Icon: ZonePantryIcon, tone: 'turmeric', labelVi: 'Tủ đồ khô' };
  }
  return { Icon: ZoneCoolIcon, tone: 'jade', labelVi: 'Ngăn mát' };
}

interface IngredientRowProps {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  storage?: string;
  freshness: FreshnessStatus;
  ingredientId?: string;
  expiryDate?: string;
  /** Inventory Truth expiry semantics; absent for legacy projection rows. */
  expiryKind?: string | null;
  estimatedExpiryDate?: string | null;
  onClick?: () => void;
  onUpdateQuantity?: (delta: number) => void;
  onDelete?: () => void;
}

export const IngredientRow: React.FC<IngredientRowProps> = ({
  id,
  name,
  quantity,
  unit,
  category,
  storage,
  freshness,
  ingredientId,
  expiryDate,
  expiryKind,
  estimatedExpiryDate,
  onClick,
  onUpdateQuantity,
  onDelete,
}) => {
  const imgSrc = getIngredientImage(ingredientId, name);
  const quantityStep = inventoryQuantityStep(unit);
  const expiry = presentExpiry({ expiryKind, expiryDate, estimatedExpiryDate });
  const catMeta = resolveCategoryIcon(category);
  const zoneMeta = resolveStorageZoneBadge(storage);
  const CategoryIcon = catMeta.Icon;
  const ZoneIcon = zoneMeta.Icon;

  const daysRemaining =
    expiry.date === null
      ? null
      : Math.ceil((new Date(expiry.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const barPercent =
    daysRemaining === null
      ? 35
      : daysRemaining <= 0
        ? 100
        : Math.max(14, Math.min(100, Math.round((daysRemaining / 10) * 100)));

  const barColorClass =
    expiry.tone === 'unknown'
      ? 'bg-tk-stone'
      : daysRemaining !== null && daysRemaining < 0
        ? 'bg-tk-berry'
        : freshness === 'expiring' || (daysRemaining !== null && daysRemaining <= 1)
          ? 'bg-tk-flame'
          : freshness === 'use_soon' || (daysRemaining !== null && daysRemaining <= 3)
            ? 'bg-tk-turmeric'
            : 'bg-tk-jade';

  return (
    <div
      data-testid="inventory-row"
      data-item-id={id}
      className="relative flex flex-wrap items-center justify-between gap-y-2 rounded-[20px] border border-tk-stone/85 bg-white p-3.5 sm:p-4 shadow-card transition-tap hover:border-tk-jade/40 hover:shadow-elevated active:scale-[0.99] cursor-pointer"
    >
      <div className="flex min-w-0 flex-[1_1_200px] flex-wrap items-center gap-3.5">
        {/* Tactile Ceramic Thumbnail + Duotone Category Icon Pill */}
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-visible rounded-2xl border border-tk-stone/75 bg-tk-sunken/70 p-2">
          <img
            src={imgSrc}
            alt={name}
            className="h-full w-full object-contain"
            loading="lazy"
          />
          <span
            aria-hidden="true"
            className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-tk-stone bg-white shadow-xs"
          >
            <CategoryIcon size={14} tone={catMeta.tone} active />
          </span>
        </div>

        <div className="min-w-0 flex-[1_1_150px]">
          <div className="mb-1 flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="min-w-0 flex-[1_1_80px] truncate font-heading text-[15px] font-extrabold text-tk-ink">
              {onClick ? (
                <button
                  type="button"
                  onClick={onClick}
                  className="tap-target text-left after:absolute after:inset-0 after:rounded-[20px]"
                >
                  {name}
                </button>
              ) : (
                name
              )}
            </h2>
            <StatusChip
              status={
                expiry.tone === 'unknown'
                  ? 'unknown'
                  : expiry.tone === 'estimated'
                    ? 'estimated'
                    : freshness
              }
              className="max-w-full"
            />
          </div>

          <p className="flex flex-wrap items-center gap-1.5 truncate text-xs font-semibold text-tk-secondary tk-tabular">
            <span className="font-extrabold text-tk-ink">
              {quantity} {unit}
            </span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-tk-muted">
              <ZoneIcon size={12} tone={zoneMeta.tone} />
              <span>{zoneMeta.labelVi}</span>
            </span>
            <span>
              {expiry.date === null
                ? ' · Chưa rõ hạn'
                : (() => {
                    const days = daysRemaining ?? 0;
                    const prefix = expiry.estimated ? ' · Ước tính' : ' ·';
                    return days < 0 ? `${prefix} đã quá hạn` : `${prefix} còn ${days} ngày`;
                  })()}
            </span>
          </p>

          {/* Honest Freshness Progress Bar */}
          <div
            aria-hidden="true"
            className="mt-2 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-tk-sunken"
          >
            <span
              className={clsx('block h-full rounded-full transition-opacity', barColorClass)}
              style={{ width: `${barPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Quantity Stepper & Delete Action */}
      <div
        className="relative z-10 ml-auto flex flex-wrap items-center justify-end gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        {onUpdateQuantity && (
          <QuantityStepper
            quantity={quantity}
            unit={unit}
            min={quantityStep}
            onIncrement={() => onUpdateQuantity(quantityStep)}
            onDecrement={() => onUpdateQuantity(-quantityStep)}
          />
        )}

        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="tap-target flex items-center justify-center rounded-xl p-2 text-tk-muted transition-colors hover:bg-tk-berry-soft hover:text-tk-berry active:scale-95"
            aria-label="Xóa nguyên liệu"
          >
            <Trash2 className="h-4.5 w-4.5 stroke-[2]" />
          </button>
        )}
      </div>
    </div>
  );
};
