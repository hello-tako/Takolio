import React from 'react';
import clsx from 'clsx';
import { CulinaryCinemaStage } from './CulinaryCinemaStage';
import {
  ChopsticksBowlIcon,
  FlameMediumIcon,
  HouseholdTrayIcon,
} from '../../design-system/icons';

export interface OnboardingMamCom3DProps {
  householdSize: number;
  spicyLevel?: number;
  mealStyle?: string;
  step: 1 | 2 | 3;
  showControls?: boolean;
  className?: string;
}

const STEP_CAPTIONS: Record<1 | 2 | 3, string> = {
  1: 'Bước 01 · Định lượng chén đũa & khẩu phần mâm cơm',
  2: 'Bước 02 · Cân chỉnh độ cay & phong cách vị giác gia đình',
  3: 'Bước 03 · Hoàn thiện nhịp mâm cơm Việt ấm lửa mỗi chiều',
};

export const OnboardingMamCom3D: React.FC<OnboardingMamCom3DProps> = ({
  householdSize,
  spicyLevel = 1,
  mealStyle,
  step,
  showControls = true,
  className,
}) => {
  const safeSize = Math.max(1, Math.round(householdSize || 1));
  const clampedTokens = Math.min(5, safeSize);
  const normalizedSpice = Math.max(0, Math.min(3, spicyLevel));

  return (
    <CulinaryCinemaStage
      videoSrc="/takolio/v5/videos/mam-com-hearth-loop.mp4"
      posterSrc="/takolio/v5/posters/mamcom-poster.webp"
      ariaLabel={`Không gian mâm cơm gia đình cho ${safeSize} người`}
      studioBadgeLabel="MÂM CƠM · HEARTH"
      liveLabel="MÂM CƠM"
      showControls={showControls}
      ambientRimTone={step === 3 ? 'amber' : normalizedSpice >= 2 ? 'ember' : 'jade'}
      className={clsx('min-h-[270px] w-full sm:min-h-[320px]', className)}
    >
      {/* Top-Left Live Mâm Cơm Telemetry Pills */}
      <div className="pointer-events-none absolute left-3.5 top-3.5 right-36 sm:right-56 z-20 flex flex-wrap items-center gap-1.5">
        <span className="tk-glass-dark inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold text-white tk-tabular">
          <HouseholdTrayIcon size={15} tone="cream" active />
          <span>{safeSize} chén đũa</span>
        </span>

        {spicyLevel !== undefined && spicyLevel > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-tk-flame/50 bg-tk-flame/85 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-xs">
            <FlameMediumIcon size={13} tone="cream" active />
            <span>Cay mức {spicyLevel}</span>
            <span aria-hidden="true" className="inline-flex items-center gap-0.5 pl-0.5">
              {[1, 2, 3].map((lvl) => (
                <span
                  key={lvl}
                  className={clsx(
                    'h-2 w-1 rounded-full',
                    lvl <= normalizedSpice ? 'bg-white' : 'bg-white/30',
                  )}
                />
              ))}
            </span>
          </span>
        )}

        {mealStyle && (
          <span className="inline-flex items-center gap-1 rounded-full border border-tk-jade-mint/40 bg-tk-jade/85 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-xs">
            <ChopsticksBowlIcon size={13} tone="cream" active />
            <span>{mealStyle}</span>
          </span>
        )}
      </div>

      {/* Bottom Frosted Dark-Glass Bát Tràng Place-Setting Tokens */}
      <div className="pointer-events-none absolute inset-x-3.5 bottom-3.5 z-20 rounded-2xl tk-glass-dark px-3.5 py-2.5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((seatIdx) => {
              const activeSeat = seatIdx <= clampedTokens;
              const isPlusToken = seatIdx === 5 && safeSize > 5;
              return (
                <span
                  key={seatIdx}
                  className={clsx(
                    'inline-flex h-7 min-w-[28px] items-center justify-center rounded-xl border px-1.5 text-[11px] font-extrabold tk-tabular transition-transform duration-300',
                    activeSeat
                      ? 'scale-100 border-tk-flame-glow/60 bg-tk-flame/85 text-white shadow-xs'
                      : 'scale-95 border-white/12 bg-white/6 text-white/35',
                  )}
                >
                  {isPlusToken ? `${safeSize}+` : seatIdx}
                </span>
              );
            })}
            <span className="ml-1 text-xs font-bold text-white/90">
              {safeSize >= 5 ? '5+' : safeSize} Bát đũa gốm Bát Tràng
            </span>
          </div>

          <span className="text-[11px] font-semibold text-tk-jade-mint">
            {STEP_CAPTIONS[step]}
          </span>
        </div>
      </div>
    </CulinaryCinemaStage>
  );
};
