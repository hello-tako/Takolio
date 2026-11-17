import React, { useCallback, useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { Pause, Play } from 'lucide-react';
import { usePrefersReducedMotion } from './TakolioGLBStage';

export type CinemaAmbientRimTone = 'none' | 'cool' | 'amber' | 'ember' | 'jade';

export interface CulinaryCinemaStageProps {
  videoSrc: string;
  posterSrc: string;
  ariaLabel: string;
  studioBadgeLabel?: string;
  liveLabel?: string;
  interactive?: boolean;
  showControls?: boolean;
  ambientRimTone?: CinemaAmbientRimTone;
  className?: string;
  videoClassName?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

const RIM_TONE_CLASSES: Record<CinemaAmbientRimTone, string> = {
  none: '',
  cool: 'ring-2 ring-tk-ocean/70',
  amber: 'ring-2 ring-tk-turmeric/75',
  ember: 'ring-2 ring-tk-flame/85 shadow-float',
  jade: 'ring-2 ring-tk-jade-mint/55',
};

function safeSyncVideoPlayback(videoEl: HTMLVideoElement | null, shouldPlay: boolean): void {
  if (!videoEl) return;
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent ?? '')) {
    return;
  }
  try {
    if (shouldPlay) {
      const maybePromise = videoEl.play?.();
      if (maybePromise && typeof maybePromise.catch === 'function') {
        maybePromise.catch(() => {
          // Ignore autoplay restrictions
        });
      }
    } else {
      videoEl.pause?.();
    }
  } catch {
    // Ignore unsupported media playback environments
  }
}

export const CulinaryCinemaStage: React.FC<CulinaryCinemaStageProps> = ({
  videoSrc,
  posterSrc,
  ariaLabel,
  studioBadgeLabel = 'FILM · 35MM HEARTH',
  liveLabel = 'LIVE STUDIO',
  interactive = true,
  showControls = true,
  ambientRimTone = 'none',
  className,
  videoClassName,
  style,
  children,
}) => {
  const reducedMotion = usePrefersReducedMotion();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [userPaused, setUserPaused] = useState(false);
  const [pointerOffset, setPointerOffset] = useState<{ x: number; y: number } | null>(null);

  const isPlaying = !reducedMotion && !userPaused;

  useEffect(() => {
    safeSyncVideoPlayback(videoRef.current, isPlaying);
  }, [isPlaying, videoSrc]);

  const handleTogglePlay = useCallback(() => {
    setUserPaused((prev) => {
      const nextPaused = !prev;
      safeSyncVideoPlayback(videoRef.current, !nextPaused && !reducedMotion);
      return nextPaused;
    });
  }, [reducedMotion]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!interactive || reducedMotion) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      setPointerOffset({ x: nx, y: ny });
    },
    [interactive, reducedMotion],
  );

  const handlePointerLeave = useCallback(() => {
    setPointerOffset(null);
  }, []);

  const parallaxTransform =
    pointerOffset && interactive && !reducedMotion
      ? `scale(1.045) translate3d(${(-pointerOffset.x * 10).toFixed(1)}px, ${(-pointerOffset.y * 8).toFixed(1)}px, 0)`
      : undefined;

  return (
    <div
      role="region"
      aria-label={ariaLabel}
      style={style}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={clsx(
        'tk-cinema-stage select-none group',
        RIM_TONE_CLASSES[ambientRimTone],
        className,
      )}
    >
      {/* Crisp High-Res Poster Backdrop (prevents black flashes on chapter swap & renders in jsdom) */}
      <img
        src={posterSrc}
        alt=""
        aria-hidden="true"
        loading="eager"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-90"
      />

      {/* Seamless H.264 35mm Live-Action Cinema Loop */}
      <video
        key={videoSrc}
        ref={videoRef}
        src={videoSrc}
        poster={posterSrc}
        autoPlay={!reducedMotion && !userPaused}
        loop
        muted
        playsInline
        preload="metadata"
        aria-label={ariaLabel}
        style={parallaxTransform ? { transform: parallaxTransform } : undefined}
        className={clsx(
          'relative z-[1] h-full w-full object-cover transition-transform duration-700 ease-out',
          interactive && !reducedMotion && !pointerOffset && 'group-hover:scale-[1.025]',
          videoClassName,
        )}
      />

      {/* Multi-Stop Obsidian Theater Vignette & Specular Inner Rim */}
      <div
        aria-hidden="true"
        className="tk-cinema-vignette pointer-events-none absolute inset-0 z-[2]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[3] rounded-[inherit] ring-1 ring-inset ring-white/14"
      />

      {/* Top-Right Studio Telemetry Pill + Accessible Play/Pause Control */}
      <div className="pointer-events-none absolute right-3 top-3 z-20 flex items-center gap-1.5">
        <span className="tk-glass-dark inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/90">
          <span
            aria-hidden="true"
            className={clsx(
              'h-1.5 w-1.5 rounded-full',
              isPlaying ? 'bg-tk-flame-glow animate-pulse' : 'bg-white/45',
            )}
          />
          <span className="hidden sm:inline">{studioBadgeLabel}</span>
          <span className="sm:hidden">{liveLabel}</span>
        </span>

        {showControls && !reducedMotion && (
          <button
            type="button"
            onClick={handleTogglePlay}
            aria-pressed={userPaused}
            aria-label={userPaused ? 'Phát cảnh quay bếp' : 'Tạm dừng cảnh quay bếp'}
            className="tk-glass-dark pointer-events-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tk-flame cursor-pointer"
          >
            {userPaused ? (
              <Play size={12} fill="currentColor" aria-hidden="true" />
            ) : (
              <Pause size={12} aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Stage HUD & Interactive Overlays */}
      <div className="pointer-events-none absolute inset-0 z-10">{children}</div>
    </div>
  );
};
