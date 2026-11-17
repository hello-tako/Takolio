import React, { useCallback } from 'react';
import clsx from 'clsx';
import { CulinaryCinemaStage, type CinemaAmbientRimTone } from './CulinaryCinemaStage';
import {
  ExpiryRescueBellIcon,
  FreshnessShieldIcon,
  ZoneCoolIcon,
  ZoneFreezeIcon,
  ZonePantryIcon,
} from '../../design-system/icons';

export type FridgeZoneFilter = 'all' | 'cool' | 'freeze' | 'pantry';

export interface SmartFridge3DProps {
  activeZone: FridgeZoneFilter;
  onSelectZone: (zone: FridgeZoneFilter) => void;
  zoneCounts: {
    cool: number;
    freeze: number;
    pantry: number;
    expiring: number;
  };
  className?: string;
}

const ZONE_RIM_TONE: Record<FridgeZoneFilter, CinemaAmbientRimTone> = {
  all: 'jade',
  cool: 'jade',
  freeze: 'cool',
  pantry: 'amber',
};

const ZONE_TELEMETRY_VI: Record<FridgeZoneFilter, string> = {
  all: 'Khoang tủ lạnh Graphite · Xếp lô hạn dùng FEFO tự động',
  cool: 'Ngăn mát tươi 3°C · Rau xanh đẫm sương, trứng gà ta & đậu non',
  freeze: 'Ngăn đá cấp đông -18°C · Bảo toàn độ ngọt thịt cá dài ngày',
  pantry: 'Tủ đồ khô 22°C · Gạo thơm, nước mắm nhĩ & gia vị truyền thống',
};

export const SmartFridge3D: React.FC<SmartFridge3DProps> = ({
  activeZone,
  onSelectZone,
  zoneCounts,
  className,
}) => {
  const handleToggleZone = useCallback(
    (zone: Exclude<FridgeZoneFilter, 'all'>) => {
      onSelectZone(activeZone === zone ? 'all' : zone);
    },
    [activeZone, onSelectZone],
  );

  const totalItems = zoneCounts.cool + zoneCounts.freeze + zoneCounts.pantry;

  return (
    <CulinaryCinemaStage
      videoSrc="/takolio/v5/videos/fridge-vault-loop.mp4"
      posterSrc="/takolio/v5/posters/fridge-poster.webp"
      ariaLabel="Khoang Tủ Lạnh Thông Minh FEFO Takolio"
      studioBadgeLabel="VAULT · FEFO"
      liveLabel="VAULT"
      ambientRimTone={zoneCounts.expiring > 0 && activeZone === 'all' ? 'amber' : ZONE_RIM_TONE[activeZone]}
      className={clsx('min-h-[300px] w-full sm:min-h-[350px]', className)}
    >
      {/* Top-Left Freshness & Expiring-Soon Amber Pulse Indicator */}
      <div className="pointer-events-none absolute left-3 top-11 right-3 z-20 flex flex-wrap items-center gap-1.5">
        <span className="tk-glass-dark inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold text-white tk-tabular">
          <FreshnessShieldIcon size={14} tone="cream" active />
          <span>{totalItems} món trong bếp</span>
        </span>

        {zoneCounts.expiring > 0 && (
          <span className="relative inline-flex items-center gap-1.5 rounded-full border border-tk-turmeric bg-tk-turmeric px-2.5 py-1 text-[11px] font-extrabold text-white shadow-xs tk-tabular">
            <span className="relative flex h-2 w-2">
              <span
                aria-hidden="true"
                className="tk-pulse-ring absolute inset-0 rounded-full bg-white"
              />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
            </span>
            <ExpiryRescueBellIcon size={13} tone="cream" active />
            <span>{zoneCounts.expiring} sắp hết hạn</span>
          </span>
        )}
      </div>

      {/* Bottom Interactive Dark-Glass Compartment Selector Overlay */}
      <div className="pointer-events-auto absolute inset-x-3 bottom-3 z-20 space-y-2 rounded-2xl tk-glass-dark p-2 text-white">
        <div className="flex items-center justify-between gap-2 px-1.5 pt-0.5 text-[11px] font-semibold text-white/75">
          <span className="truncate">{ZONE_TELEMETRY_VI[activeZone]}</span>
          <span className="shrink-0 font-extrabold text-tk-jade-mint tk-tabular">FEFO</span>
        </div>

        <div
          role="tablist"
          aria-label="Chọn khoang bảo quản tủ lạnh"
          className="grid grid-cols-2 sm:grid-cols-4 gap-1.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeZone === 'all'}
            onClick={() => onSelectZone('all')}
            className={clsx(
              'flex flex-col items-center justify-center rounded-xl px-2 py-1.5 text-[11px] font-extrabold transition-colors cursor-pointer tk-tabular',
              activeZone === 'all'
                ? 'bg-tk-jade text-white shadow-xs'
                : 'bg-white/6 text-white/80 hover:bg-white/14 hover:text-white',
            )}
          >
            <span className="truncate">Tất cả khoang</span>
            <span className="text-[10px] opacity-80">{totalItems} lô</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeZone === 'cool'}
            onClick={() => handleToggleZone('cool')}
            className={clsx(
              'flex flex-col items-center justify-center rounded-xl px-2 py-1.5 text-[11px] font-extrabold transition-colors cursor-pointer tk-tabular',
              activeZone === 'cool'
                ? 'bg-tk-jade text-white shadow-xs'
                : 'bg-white/6 text-white/80 hover:bg-white/14 hover:text-white',
            )}
          >
            <span className="inline-flex items-center gap-1 max-w-full">
              <ZoneCoolIcon size={13} tone="cream" active={activeZone === 'cool'} />
              <span className="truncate">Ngăn mát tươi</span>
            </span>
            <span className="text-[10px] opacity-80">({zoneCounts.cool})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeZone === 'freeze'}
            onClick={() => handleToggleZone('freeze')}
            className={clsx(
              'flex flex-col items-center justify-center rounded-xl px-2 py-1.5 text-[11px] font-extrabold transition-colors cursor-pointer tk-tabular',
              activeZone === 'freeze'
                ? 'bg-tk-ocean text-white shadow-xs'
                : 'bg-white/6 text-white/80 hover:bg-white/14 hover:text-white',
            )}
          >
            <span className="inline-flex items-center gap-1 max-w-full">
              <ZoneFreezeIcon size={13} tone="cream" active={activeZone === 'freeze'} />
              <span className="truncate">Ngăn đá</span>
            </span>
            <span className="text-[10px] opacity-80">({zoneCounts.freeze})</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeZone === 'pantry'}
            onClick={() => handleToggleZone('pantry')}
            className={clsx(
              'flex flex-col items-center justify-center rounded-xl px-2 py-1.5 text-[11px] font-extrabold transition-colors cursor-pointer tk-tabular',
              activeZone === 'pantry'
                ? 'bg-tk-turmeric text-white shadow-xs'
                : 'bg-white/6 text-white/80 hover:bg-white/14 hover:text-white',
            )}
          >
            <span className="inline-flex items-center gap-1 max-w-full">
              <ZonePantryIcon size={13} tone="cream" active={activeZone === 'pantry'} />
              <span className="truncate">Tủ đồ khô</span>
            </span>
            <span className="text-[10px] opacity-80">({zoneCounts.pantry})</span>
          </button>
        </div>
      </div>
    </CulinaryCinemaStage>
  );
};
