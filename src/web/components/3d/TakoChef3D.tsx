import React from 'react';
import clsx from 'clsx';
import {
  AiSousChefSparkIcon,
  FreshnessShieldIcon,
  NavScanApertureIcon,
  PlatingSparkleIcon,
  TakolioLogoMark,
  WokFlameIcon,
} from '../../design-system/icons';

export type TakoChefPose =
  | 'wave'
  | 'scan'
  | 'cook'
  | 'think'
  | 'celebrate'
  | 'nod';

export interface TakoChef3DProps {
  pose?: TakoChefPose;
  size?: number;
  interactive?: boolean;
  className?: string;
}

interface MedallionPoseSpec {
  ariaLabelVi: string;
  badgeCode: string;
  posterSrc: string;
  renderAccentIcon: (iconSize: number) => React.ReactNode;
}

const POSE_SPECS: Record<TakoChefPose, MedallionPoseSpec> = {
  wave: {
    ariaLabelVi: 'Huy hiệu Bếp Trưởng Takolio đang chào đón',
    badgeCode: 'ATELIER',
    posterSrc: '/takolio/v5/posters/mamcom-poster.webp',
    renderAccentIcon: (s) => <FreshnessShieldIcon size={s} tone="cream" active />,
  },
  scan: {
    ariaLabelVi: 'Huy hiệu Bếp Trưởng Takolio đang nhận diện nguyên liệu',
    badgeCode: 'AI SCAN',
    posterSrc: '/takolio/v5/posters/prep-poster.webp',
    renderAccentIcon: (s) => <NavScanApertureIcon size={s} tone="cream" active />,
  },
  cook: {
    ariaLabelVi: 'Huy hiệu Bếp Trưởng Takolio đang canh lửa chế biến',
    badgeCode: 'HEARTH',
    posterSrc: '/takolio/v5/posters/wok-poster.webp',
    renderAccentIcon: (s) => <WokFlameIcon size={s} tone="cream" active />,
  },
  think: {
    ariaLabelVi: 'Huy hiệu Bếp Trưởng Takolio đang phối thực đơn mâm cơm',
    badgeCode: 'SOUS-CHEF',
    posterSrc: '/takolio/v5/posters/claypot-poster.webp',
    renderAccentIcon: (s) => <AiSousChefSparkIcon size={s} tone="cream" active />,
  },
  celebrate: {
    ariaLabelVi: 'Huy hiệu Bếp Trưởng Takolio hoàn tất mâm cơm',
    badgeCode: 'MÂM CƠM',
    posterSrc: '/takolio/v5/posters/mamcom-poster.webp',
    renderAccentIcon: (s) => <PlatingSparkleIcon size={s} tone="cream" active />,
  },
  nod: {
    ariaLabelVi: 'Huy hiệu Bếp Trưởng Takolio xác nhận chuẩn vị',
    badgeCode: 'VERIFIED',
    posterSrc: '/takolio/v5/posters/soup-poster.webp',
    renderAccentIcon: (s) => <FreshnessShieldIcon size={s} tone="cream" active />,
  },
};

export const TakoChef3D: React.FC<TakoChef3DProps> = ({
  pose = 'wave',
  size = 112,
  interactive = true,
  className,
}) => {
  const spec = POSE_SPECS[pose] ?? POSE_SPECS.wave;
  const crestSize = Math.max(24, Math.round(size * 0.36));
  const subIconSize = Math.max(11, Math.round(size * 0.13));
  const isCompact = size < 96;

  return (
    <div
      role="img"
      aria-label={spec.ariaLabelVi}
      style={{ width: size, height: size }}
      className={clsx(
        'tk-cinema-stage relative inline-flex shrink-0 flex-col items-center justify-center rounded-[26px] p-2 select-none',
        interactive && 'transition-transform duration-300 hover:scale-[1.03]',
        className,
      )}
    >
      {/* Ambient 35mm Culinary Still Backdrop */}
      <img
        src={spec.posterSrc}
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
      />
      <div
        aria-hidden="true"
        className="tk-cinema-vignette pointer-events-none absolute inset-0"
      />

      {/* Double Architectural Specular Ring */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-1.5 rounded-[20px] border border-white/14"
      />

      {/* Jewel-Like Obsidian & Terracotta Culinary Crest */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-1">
        <div className="relative flex items-center justify-center rounded-full border border-tk-flame-glow/45 bg-tk-sanctuary-card/92 p-2.5 shadow-float">
          <TakolioLogoMark size={crestSize} tone="flame" />
          <span className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border border-white/20 bg-tk-flame p-1 shadow-xs">
            {spec.renderAccentIcon(subIconSize)}
          </span>
        </div>

        {!isCompact && (
          <span className="mt-0.5 rounded-full border border-white/15 bg-tk-sanctuary/85 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-[0.16em] text-white/90">
            {spec.badgeCode}
          </span>
        )}
      </div>

      <span className="sr-only">{spec.ariaLabelVi}</span>
    </div>
  );
};
