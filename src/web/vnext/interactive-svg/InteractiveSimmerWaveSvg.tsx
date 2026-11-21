import React, { useEffect, useId, useState } from 'react';
import { clsx } from 'clsx';

export type SimmerHeatLevel = 'low' | 'medium' | 'high';

export interface InteractiveSimmerWaveSvgProps {
  progress: number;
  isRunning: boolean;
  totalSeconds: number;
  remainingSeconds: number;
  heatLevel?: SimmerHeatLevel;
  onHeatChange?: (h: SimmerHeatLevel) => void;
  className?: string;
}

interface HeatSpec {
  id: SimmerHeatLevel;
  label: string;
  subtitle: string;
  accentHex: string;
  brothTopHex: string;
  brothBottomHex: string;
  waveAmp: number;
  waveSpeed: number;
}

const HEAT_SPECS: Record<SimmerHeatLevel, HeatSpec> = {
  low: {
    id: 'low',
    label: 'Lửa riu',
    subtitle: 'Ủ ngọt nước dùng · Sôi lăn tăn nhẹ',
    accentHex: '#4E7A5B',
    brothTopHex: '#E5B26E',
    brothBottomHex: '#C68634',
    waveAmp: 4.2,
    waveSpeed: 1.8,
  },
  medium: {
    id: 'medium',
    label: 'Lửa vừa',
    subtitle: 'Kho thấm gia vị · Sôi đều êm bếp',
    accentHex: '#C68634',
    brothTopHex: '#F09B59',
    brothBottomHex: '#D86A43',
    waveAmp: 6.8,
    waveSpeed: 3.1,
  },
  high: {
    id: 'high',
    label: 'Lửa lớn',
    subtitle: 'Áp chảo & bùng sôi · Giữ màu rau xanh',
    accentHex: '#D86A43',
    brothTopHex: '#E67F5C',
    brothBottomHex: '#B34824',
    waveAmp: 9.6,
    waveSpeed: 4.8,
  },
};

function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function buildSineWaveClosedPath(
  waterY: number,
  amp: number,
  phase: number,
  wavelength = 96,
): string {
  const startX = 36;
  const endX = 244;
  const step = 8;
  const parts: string[] = [];

  for (let x = startX; x <= endX; x += step) {
    const y =
      waterY +
      Math.sin(((x - startX) / wavelength) * Math.PI * 2 + phase) * amp +
      Math.cos(((x - startX) / (wavelength * 0.62)) * Math.PI * 2 - phase * 0.7) * (amp * 0.35);
    parts.push(`${x === startX ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }

  parts.push(`L ${endX} 252 L ${startX} 252 Z`);
  return parts.join(' ');
}

export const InteractiveSimmerWaveSvg: React.FC<InteractiveSimmerWaveSvgProps> = ({
  progress,
  isRunning,
  totalSeconds,
  remainingSeconds,
  heatLevel,
  onHeatChange,
  className,
}) => {
  const uid = useId().replace(/:/g, '');
  const [internalHeat, setInternalHeat] = useState<SimmerHeatLevel>('medium');
  const [phase, setPhase] = useState<number>(0.6);

  const currentHeat = heatLevel ?? internalHeat;
  const spec = HEAT_SPECS[currentHeat];

  // Normalize progress smoothly whether caller supplies 0..1 or 0..100
  const rawNormalized =
    progress > 1.001
      ? progress / 100
      : Number.isFinite(progress)
        ? progress
        : totalSeconds > 0
          ? 1 - remainingSeconds / totalSeconds
          : 0;
  const clampedProgress = Math.max(0, Math.min(1, rawNormalized));

  useEffect(() => {
    if (!isRunning || typeof window === 'undefined') return undefined;
    let reduced = false;
    try {
      reduced = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    } catch {
      reduced = false;
    }
    if (reduced) return undefined;

    let rafId: number | null = null;
    let last = typeof performance !== 'undefined' ? performance.now() : 0;

    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      setPhase((prev) => (prev + dt * spec.waveSpeed) % (Math.PI * 20));
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [isRunning, spec.waveSpeed]);

  const handlePickHeat = (next: SimmerHeatLevel) => {
    setInternalHeat(next);
    onHeatChange?.(next);
  };

  const cx = 140;
  const cy = 140;
  const outerRingR = 112;
  const innerVesselR = 88;
  const circumference = 2 * Math.PI * outerRingR;
  const ringOffset = circumference * (1 - clampedProgress);

  // Liquid level rises from calm base (198) to rich full simmer (86) with progress,
  // while keeping an appetizing visible broth reservoir even at 0%
  const remainingRatio =
    totalSeconds > 0
      ? Math.max(0.16, Math.min(0.86, remainingSeconds / totalSeconds))
      : Math.max(0.22, 1 - clampedProgress * 0.68);
  const meniscusY = 216 - remainingRatio * 124;

  const frontWavePath = buildSineWaveClosedPath(meniscusY, spec.waveAmp, phase, 98);
  const backWavePath = buildSineWaveClosedPath(
    meniscusY - 4,
    spec.waveAmp * 0.78,
    -phase * 0.85 + 1.4,
    112,
  );

  const steamDrift = Math.sin(phase * 0.75) * (currentHeat === 'high' ? 7 : 4);

  return (
    <div
      className={clsx(
        'flex flex-col items-center gap-3.5 rounded-[var(--tkv-radius-card)] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-4 shadow-[var(--tkv-shadow-card)]',
        className,
      )}
    >
      {/* Circular Ceramic Simmer Timer SVG */}
      <svg
        viewBox="0 0 280 280"
        role="img"
        aria-label={`Đồng hồ canh lửa ${spec.label}: còn lại ${formatClock(remainingSeconds)} trên tổng ${formatClock(totalSeconds)}`}
        className="h-auto w-full max-w-[260px] select-none"
      >
        <defs>
          <clipPath id={`vessel-clip-${uid}`}>
            <circle cx={cx} cy={cy} r={innerVesselR} />
          </clipPath>
          <linearGradient id={`broth-fill-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={spec.brothTopHex} stopOpacity="0.92" />
            <stop offset="100%" stopColor={spec.brothBottomHex} stopOpacity="0.98" />
          </linearGradient>
        </defs>

        {/* Ceramic Bowl Rim Shadow & Track */}
        <circle cx={cx} cy={cy + 4} r={outerRingR + 8} fill="#5F524A" fillOpacity="0.06" />
        <circle
          cx={cx}
          cy={cy}
          r={outerRingR}
          fill="#FFFDF9"
          stroke="#EAE0D5"
          strokeWidth="10"
        />

        {/* Progress Arc */}
        <circle
          cx={cx}
          cy={cy}
          r={outerRingR}
          fill="none"
          stroke={spec.accentHex}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={ringOffset}
          transform={`rotate(-90 ${cx} ${cy})`}
        />

        {/* Inner Ceramic Pot Cavity */}
        <circle
          cx={cx}
          cy={cy}
          r={innerVesselR}
          fill="#FAF4EC"
          stroke="#E5D6C5"
          strokeWidth="2.5"
        />

        {/* Clipped Animated Liquid Broth Sine-Wave + Simmering Bubbles & Steam */}
        <g clipPath={`url(#vessel-clip-${uid})`}>
          {/* Rising Steam Curls above the Meniscus */}
          <g
            opacity={isRunning ? (currentHeat === 'high' ? 0.9 : 0.72) : 0.35}
            stroke="#D5C3B3"
            strokeWidth={currentHeat === 'high' ? 3.2 : 2.4}
            strokeLinecap="round"
            fill="none"
          >
            <path
              d={`M ${108 + steamDrift * 0.6} ${meniscusY - 12} C ${98 - steamDrift} ${meniscusY - 32}, ${118 + steamDrift} ${meniscusY - 50}, ${106 + steamDrift * 0.5} ${meniscusY - 70}`}
            />
            <path
              d={`M ${140 - steamDrift * 0.5} ${meniscusY - 14} C ${152 + steamDrift} ${meniscusY - 38}, ${128 - steamDrift} ${meniscusY - 58}, ${142 - steamDrift * 0.4} ${meniscusY - 82}`}
            />
            <path
              d={`M ${172 + steamDrift * 0.5} ${meniscusY - 10} C ${182 - steamDrift} ${meniscusY - 30}, ${162 + steamDrift} ${meniscusY - 48}, ${174 + steamDrift * 0.5} ${meniscusY - 66}`}
            />
          </g>

          {/* Back Secondary Wave */}
          <path d={backWavePath} fill={spec.brothTopHex} fillOpacity="0.48" />

          {/* Primary Broth Wave */}
          <path d={frontWavePath} fill={`url(#broth-fill-${uid})`} />

          {/* Simmering Broth Bubbles */}
          {(currentHeat === 'medium' || currentHeat === 'high') && (
            <g fill="#FFFDF9" fillOpacity={isRunning ? 0.58 : 0.25}>
              <circle
                cx={104 + Math.sin(phase) * 4}
                cy={meniscusY + 22 - ((phase * 8) % 18)}
                r={currentHeat === 'high' ? 4.2 : 3}
              />
              <circle
                cx={142 + Math.cos(phase * 1.2) * 5}
                cy={meniscusY + 30 - ((phase * 11 + 7) % 24)}
                r={currentHeat === 'high' ? 5 : 3.4}
              />
              <circle
                cx={176 + Math.sin(phase * 0.9) * 4}
                cy={meniscusY + 24 - ((phase * 9 + 13) % 20)}
                r={currentHeat === 'high' ? 4 : 2.8}
              />
            </g>
          )}
        </g>

        {/* Central Frosted Ceramic Timer Readout Pill */}
        <g transform={`translate(${cx}, ${cy})`}>
          <rect
            x="-64"
            y="-34"
            width="128"
            height="68"
            rx="20"
            fill="#FFFDF9"
            fillOpacity="0.92"
            stroke="#EAE0D5"
            strokeWidth="1.5"
          />
          <text
            x="0"
            y="-12"
            textAnchor="middle"
            fill={spec.accentHex}
            fontSize="9.8"
            fontWeight="700"
          >
            {isRunning ? `ĐANG NẤU · ${spec.label.toUpperCase()}` : `TẠM DỪNG · ${spec.label.toUpperCase()}`}
          </text>
          <text
            x="0"
            y="14"
            textAnchor="middle"
            fill="#2C221E"
            fontSize="24"
            fontWeight="800"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatClock(remainingSeconds)}
          </text>
          <text
            x="0"
            y="27"
            textAnchor="middle"
            fill="#87776E"
            fontSize="9.2"
            fontWeight="600"
          >
            {Math.round(clampedProgress * 100)}% hoàn tất
          </text>
        </g>
      </svg>

      {/* Clickable Heat-Level Selector Pills (Lửa riu · Lửa vừa · Lửa lớn) */}
      <div
        role="group"
        aria-label="Chọn mức nhiệt bếp"
        className="flex flex-wrap items-center justify-center gap-1.5"
      >
        {(['low', 'medium', 'high'] as const).map((level) => {
          const item = HEAT_SPECS[level];
          const active = currentHeat === level;
          return (
            <button
              key={level}
              type="button"
              aria-pressed={active}
              onClick={() => handlePickHeat(level)}
              className={clsx(
                'tkv-focusable tkv-tactile inline-flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs font-semibold',
                active
                  ? 'border-transparent text-white shadow-xs'
                  : 'border-[var(--tkv-border)] bg-[var(--tkv-surface-subtle)] text-[var(--tkv-ink-secondary)] hover:bg-[var(--tkv-surface)] hover:text-[var(--tkv-ink)]',
              )}
              style={active ? { backgroundColor: item.accentHex } : undefined}
            >
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{
                  backgroundColor: active ? '#FFFFFF' : item.accentHex,
                }}
              />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <p className="text-center text-xs text-[var(--tkv-ink-secondary)]">{spec.subtitle}</p>
    </div>
  );
};

export default InteractiveSimmerWaveSvg;
