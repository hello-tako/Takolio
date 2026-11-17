import React from 'react';
import clsx from 'clsx';
import { CulinaryCinemaStage, type CinemaAmbientRimTone } from './CulinaryCinemaStage';
import {
  BambooSteamerIcon,
  ChefKnifeBoardIcon,
  ClaypotBraiseIcon,
  FlameHighIcon,
  FlameLowIcon,
  FlameMediumIcon,
  FlameOffIcon,
  MarinateBowlIcon,
  PlatingSparkleIcon,
  StockpotSoupIcon,
  WokFlameIcon,
} from '../../design-system/icons';

export type CulinaryTechnique =
  | 'prep'
  | 'marinate'
  | 'stir_fry'
  | 'braise'
  | 'simmer'
  | 'steam'
  | 'fry'
  | 'plate';

export type BurnerHeatLevel =
  | 'off'
  | 'low'
  | 'medium_low'
  | 'medium'
  | 'medium_high'
  | 'high';

export interface ActiveCookwareStage3DProps {
  technique: CulinaryTechnique;
  heatLevel: BurnerHeatLevel;
  timerRunning?: boolean;
  timerProgress?: number;
  stepTitle?: string;
  className?: string;
}

interface TechniqueCinemaMeta {
  cookwareLabelVi: string;
  techniqueBadgeVi: string;
  videoSrc: string;
  posterSrc: string;
  studioLabel: string;
}

const TECHNIQUE_META: Record<CulinaryTechnique, TechniqueCinemaMeta> = {
  prep: {
    cookwareLabelVi: 'Thớt gỗ & Dao Santoku',
    techniqueBadgeVi: 'Sơ chế chuẩn bếp',
    videoSrc: '/takolio/v5/videos/cook-prep.mp4',
    posterSrc: '/takolio/v5/posters/prep-poster.webp',
    studioLabel: 'PREP · SANTOKU',
  },
  marinate: {
    cookwareLabelVi: 'Tô gốm & Thớt sơ chế',
    techniqueBadgeVi: 'Ướp thấm gia vị',
    videoSrc: '/takolio/v5/videos/cook-prep.mp4',
    posterSrc: '/takolio/v5/posters/prep-poster.webp',
    studioLabel: 'PREP · MARINADE',
  },
  stir_fry: {
    cookwareLabelVi: 'Chảo gang & Xẻng đảo',
    techniqueBadgeVi: 'Xào lửa vượng',
    videoSrc: '/takolio/v5/videos/cook-wok-fire.mp4',
    posterSrc: '/takolio/v5/posters/wok-poster.webp',
    studioLabel: 'WOK · HIGH FLAME',
  },
  fry: {
    cookwareLabelVi: 'Chảo gang chiên vàng',
    techniqueBadgeVi: 'Chiên giòn rụm',
    videoSrc: '/takolio/v5/videos/cook-wok-fire.mp4',
    posterSrc: '/takolio/v5/posters/wok-poster.webp',
    studioLabel: 'WOK · SEAR',
  },
  braise: {
    cookwareLabelVi: 'Nồi đất Bát Tràng',
    techniqueBadgeVi: 'Kho tộ sánh màu',
    videoSrc: '/takolio/v5/videos/cook-claypot.mp4',
    posterSrc: '/takolio/v5/posters/claypot-poster.webp',
    studioLabel: 'CLAYPOT · 96°C',
  },
  simmer: {
    cookwareLabelVi: 'Nồi gốm hầm canh',
    techniqueBadgeVi: 'Ninh hầm ngọt nước',
    videoSrc: '/takolio/v5/videos/cook-soup.mp4',
    posterSrc: '/takolio/v5/posters/soup-poster.webp',
    studioLabel: 'SIMMER · BROTH',
  },
  steam: {
    cookwareLabelVi: 'Xửng hấp & Nồi hơi',
    techniqueBadgeVi: 'Hấp giữ trọn vị',
    videoSrc: '/takolio/v5/videos/cook-soup.mp4',
    posterSrc: '/takolio/v5/posters/soup-poster.webp',
    studioLabel: 'STEAM · VAPOR',
  },
  plate: {
    cookwareLabelVi: 'Bàn ra món hoàn tất',
    techniqueBadgeVi: 'Trình bày & Thưởng thức',
    videoSrc: '/takolio/v5/videos/cook-plate.mp4',
    posterSrc: '/takolio/v5/posters/mamcom-poster.webp',
    studioLabel: 'PLATE · MÂM CƠM',
  },
};

interface HeatVisualSpec {
  bars: number;
  labelVi: string;
  rimTone: CinemaAmbientRimTone;
  pillClass: string;
  barActiveClass: string;
}

const HEAT_SPECS: Record<BurnerHeatLevel, HeatVisualSpec> = {
  off: {
    bars: 0,
    labelVi: 'Tắt bếp',
    rimTone: 'none',
    pillClass: 'border-white/15 bg-tk-sanctuary-card/90 text-white/80',
    barActiveClass: 'bg-white/40',
  },
  low: {
    bars: 1,
    labelVi: 'Lửa nhỏ • Xanh dịu',
    rimTone: 'cool',
    pillClass: 'border-tk-ocean/60 bg-tk-sanctuary-card/92 text-white',
    barActiveClass: 'bg-tk-ocean',
  },
  medium_low: {
    bars: 2,
    labelVi: 'Lửa nhỏ vừa • Xanh ngọc',
    rimTone: 'cool',
    pillClass: 'border-tk-jade-mint/50 bg-tk-sanctuary-card/92 text-tk-jade-mint',
    barActiveClass: 'bg-tk-jade-mint',
  },
  medium: {
    bars: 3,
    labelVi: 'Lửa vừa • Hổ phách',
    rimTone: 'amber',
    pillClass: 'border-tk-turmeric/65 bg-tk-sanctuary-card/92 text-white',
    barActiveClass: 'bg-tk-turmeric',
  },
  medium_high: {
    bars: 4,
    labelVi: 'Lửa khá lớn • Cam ấm',
    rimTone: 'ember',
    pillClass: 'border-tk-flame/65 bg-tk-sanctuary-card/92 text-white',
    barActiveClass: 'bg-tk-flame-glow',
  },
  high: {
    bars: 5,
    labelVi: 'Lửa lớn • Đỏ rực',
    rimTone: 'ember',
    pillClass: 'border-tk-flame-glow/80 bg-tk-flame/90 text-white shadow-float',
    barActiveClass: 'bg-white',
  },
};

function renderTechniqueIcon(technique: CulinaryTechnique): React.ReactNode {
  switch (technique) {
    case 'prep':
      return <ChefKnifeBoardIcon size={16} tone="cream" active />;
    case 'marinate':
      return <MarinateBowlIcon size={16} tone="cream" active />;
    case 'stir_fry':
    case 'fry':
      return <WokFlameIcon size={16} tone="cream" active />;
    case 'braise':
      return <ClaypotBraiseIcon size={16} tone="cream" active />;
    case 'simmer':
      return <StockpotSoupIcon size={16} tone="cream" active />;
    case 'steam':
      return <BambooSteamerIcon size={16} tone="cream" active />;
    case 'plate':
      return <PlatingSparkleIcon size={16} tone="cream" active />;
  }
}

function renderHeatIcon(heat: BurnerHeatLevel): React.ReactNode {
  if (heat === 'off') return <FlameOffIcon size={14} tone="cream" />;
  if (heat === 'low' || heat === 'medium_low') {
    return <FlameLowIcon size={14} tone="cream" active />;
  }
  if (heat === 'medium' || heat === 'medium_high') {
    return <FlameMediumIcon size={14} tone="cream" active />;
  }
  return <FlameHighIcon size={14} tone="cream" active />;
}

export const ActiveCookwareStage3D: React.FC<ActiveCookwareStage3DProps> = ({
  technique,
  heatLevel,
  timerRunning = false,
  timerProgress,
  stepTitle,
  className,
}) => {
  const techMeta = TECHNIQUE_META[technique] ?? TECHNIQUE_META.simmer;
  const effectiveHeat: BurnerHeatLevel =
    technique === 'prep' || technique === 'marinate' || technique === 'plate'
      ? 'off'
      : heatLevel;
  const heatSpec = HEAT_SPECS[effectiveHeat] ?? HEAT_SPECS.off;

  const clampedProgress =
    timerProgress !== undefined
      ? Math.max(0, Math.min(1, timerProgress))
      : undefined;

  const ringRadius = 11;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset =
    clampedProgress !== undefined
      ? ringCircumference * (1 - clampedProgress)
      : ringCircumference;

  return (
    <CulinaryCinemaStage
      videoSrc={techMeta.videoSrc}
      posterSrc={techMeta.posterSrc}
      ariaLabel={`Sân khấu bếp trực tiếp: ${techMeta.cookwareLabelVi} — ${heatSpec.labelVi}`}
      studioBadgeLabel={techMeta.studioLabel}
      liveLabel="HEARTH"
      ambientRimTone={technique === 'plate' ? 'jade' : heatSpec.rimTone}
      className={clsx('min-h-[265px] w-full sm:min-h-[315px]', className)}
    >
      {/* Dynamic Ambient Firelight Bottom Glow synced to heatLevel */}
      {effectiveHeat !== 'off' && (
        <div
          aria-hidden="true"
          className={clsx(
            'pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-60 blur-xl transition-opacity duration-500',
            heatSpec.bars >= 4
              ? 'bg-tk-flame/50'
              : heatSpec.bars === 3
                ? 'bg-tk-turmeric/45'
                : 'bg-tk-ocean/45',
          )}
        />
      )}

      {/* Top-Left Cookware & Technique Dark-Glass HUD Pill */}
      <div className="pointer-events-none absolute left-3.5 top-3.5 right-28 z-20 flex flex-wrap items-center gap-2">
        <div className="tk-glass-dark inline-flex items-center gap-2.5 rounded-full px-3.5 py-1.5 text-white">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tk-flame/85 shadow-xs">
            {renderTechniqueIcon(technique)}
          </span>
          <div className="flex flex-col leading-none">
            <span className="text-[11px] font-extrabold text-white">
              {techMeta.cookwareLabelVi}
            </span>
            <span className="mt-0.5 text-[10px] font-bold text-tk-jade-mint">
              {techMeta.techniqueBadgeVi}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom HUD Telemetry Bar: 5-Bar Flame Intensity Gauge + Radial Timer Sync */}
      <div className="pointer-events-none absolute inset-x-3.5 bottom-3.5 z-20 flex flex-wrap items-center justify-between gap-2">
        <div
          data-testid="cookware-flame-hud"
          className={clsx(
            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-extrabold backdrop-blur-md transition-colors',
            heatSpec.pillClass,
          )}
        >
          {renderHeatIcon(effectiveHeat)}
          <span>{heatSpec.labelVi}</span>
          <span aria-hidden="true" className="ml-0.5 inline-flex items-end gap-0.5">
            {[1, 2, 3, 4, 5].map((bar) => (
              <span
                key={bar}
                style={{ height: `${6 + bar * 2}px` }}
                className={clsx(
                  'w-1 rounded-full transition-colors duration-300',
                  bar <= heatSpec.bars ? heatSpec.barActiveClass : 'bg-white/20',
                )}
              />
            ))}
          </span>
        </div>

        {(stepTitle || timerRunning || clampedProgress !== undefined) && (
          <div className="tk-glass-dark inline-flex max-w-[62%] items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold text-white">
            {timerRunning && (
              <span className="h-2 w-2 shrink-0 animate-ping rounded-full bg-tk-flame-glow" />
            )}
            {stepTitle && <span className="truncate">{stepTitle}</span>}
            {clampedProgress !== undefined && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/12 px-2 py-0.5 text-[10px] font-extrabold text-white tk-tabular">
                <svg
                  width={16}
                  height={16}
                  viewBox="0 0 28 28"
                  className="-rotate-90 shrink-0"
                  aria-hidden="true"
                >
                  <circle
                    cx="14"
                    cy="14"
                    r={ringRadius}
                    fill="none"
                    stroke="rgba(255,255,255,0.22)"
                    strokeWidth="3"
                  />
                  <circle
                    cx="14"
                    cy="14"
                    r={ringRadius}
                    fill="none"
                    stroke="#FF6E52"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={ringCircumference}
                    strokeDashoffset={ringDashOffset}
                  />
                </svg>
                <span>{Math.round(clampedProgress * 100)}%</span>
              </span>
            )}
          </div>
        )}
      </div>
    </CulinaryCinemaStage>
  );
};
