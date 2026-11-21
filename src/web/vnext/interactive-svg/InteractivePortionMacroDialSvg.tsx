import React, { useEffect, useId, useState } from 'react';
import { clsx } from 'clsx';

export interface PortionSampleIngredient {
  name: string;
  baseQty: number;
  unit: string;
}

export interface InteractivePortionMacroDialSvgProps {
  initialServings?: number;
  baseServings?: number;
  baseTimeMinutes?: number;
  sampleIngredients?: Array<PortionSampleIngredient>;
  onServingsChange?: (servings: number) => void;
  className?: string;
}

const DEFAULT_SAMPLE_INGREDIENTS: PortionSampleIngredient[] = [
  { name: 'Thịt ba chỉ / Đậu phụ non', baseQty: 240, unit: 'g' },
  { name: 'Cải thìa & cà chua chín', baseQty: 320, unit: 'g' },
  { name: 'Trứng gà ta', baseQty: 2, unit: 'quả' },
  { name: 'Gạo tám thơm dẻo', baseQty: 180, unit: 'g' },
  { name: 'Nước mắm nhĩ & hành tím', baseQty: 2, unit: 'muỗng' },
];

const QUICK_PRESETS = [1, 2, 4, 6] as const;

function clampServings(n: number): number {
  if (!Number.isFinite(n)) return 2;
  return Math.max(1, Math.min(8, Math.round(n)));
}

function formatScaledQuantity(raw: number): string {
  if (raw >= 20) {
    return String(Math.round(raw / 5) * 5);
  }
  const rounded = Math.round(raw * 2) / 2;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeWedgePath(
  cx: number,
  cy: number,
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
): string {
  const p1 = polarToCartesian(cx, cy, outerR, startDeg);
  const p2 = polarToCartesian(cx, cy, outerR, endDeg);
  const p3 = polarToCartesian(cx, cy, innerR, endDeg);
  const p4 = polarToCartesian(cx, cy, innerR, startDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;

  return [
    `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
    `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
    'Z',
  ].join(' ');
}

export const InteractivePortionMacroDialSvg: React.FC<InteractivePortionMacroDialSvgProps> = ({
  initialServings = 2,
  baseServings = 2,
  baseTimeMinutes = 25,
  sampleIngredients = DEFAULT_SAMPLE_INGREDIENTS,
  onServingsChange,
  className,
}) => {
  const uid = useId().replace(/:/g, '');
  const [servings, setServings] = useState<number>(() => clampServings(initialServings));

  useEffect(() => {
    setServings(clampServings(initialServings));
  }, [initialServings]);

  const safeBaseServings = Math.max(1, baseServings);
  const scaleFactor = servings / safeBaseServings;
  const estimatedMinutes = Math.max(
    10,
    Math.round(baseTimeMinutes * (0.76 + 0.24 * scaleFactor)),
  );
  const totalKcal = servings * 540;

  const updateServings = (next: number) => {
    const clamped = clampServings(next);
    setServings(clamped);
    onServingsChange?.(clamped);
  };

  // Harmonic Macro Balance Ring (r = 104)
  // Đạm 32% · Rau xanh 38% · Tinh bột 30%
  const ringR = 104;
  const circumference = 2 * Math.PI * ringR;
  const gapPx = 7;
  const proteinLen = circumference * 0.32 - gapPx;
  const greensLen = circumference * 0.38 - gapPx;
  const carbsLen = circumference * 0.30 - gapPx;

  const greensOffset = -(circumference * 0.32);
  const carbsOffset = -(circumference * 0.70);

  // Build ceramic plate wedges (1..8 portions)
  const cx = 140;
  const cy = 140;
  const wedges = Array.from({ length: servings }, (_, idx) => {
    const stepDeg = 360 / servings;
    const pad = servings === 1 ? 0 : 2.4;
    const startDeg = idx * stepDeg + pad;
    const endDeg = (idx + 1) * stepDeg - pad;
    const midDeg = (startDeg + endDeg) / 2;
    const garnishPos = polarToCartesian(cx, cy, 56, midDeg);
    return { idx, startDeg, endDeg, garnishPos };
  });

  return (
    <div
      className={clsx(
        'flex flex-col gap-4 rounded-[var(--tkv-radius-card)] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-4 sm:p-5 shadow-[var(--tkv-shadow-card)]',
        className,
      )}
    >
      {/* Header & Stepper Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--tkv-ink-muted)]">
            Đĩa gốm cân bằng dinh dưỡng
          </span>
          <h3 className="tkv-heading text-base font-bold text-[var(--tkv-ink)]">
            Xoay khẩu phần tự động tính lại định lượng bếp
          </h3>
        </div>

        {/* Tactile - / + Stepper */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tkv-border)] bg-[var(--tkv-surface-subtle)] p-1">
          <button
            type="button"
            aria-label="Giảm khẩu phần"
            disabled={servings <= 1}
            onClick={() => updateServings(servings - 1)}
            className="tkv-focusable tkv-tactile inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--tkv-border)] bg-[var(--tkv-surface)] text-base font-bold text-[var(--tkv-ink)] hover:bg-[var(--tkv-bg)] disabled:opacity-40"
          >
            −
          </button>
          <span
            aria-live="polite"
            className="min-w-[74px] text-center text-sm font-bold tabular-nums text-[var(--tkv-ink)]"
          >
            {servings} người
          </span>
          <button
            type="button"
            aria-label="Tăng khẩu phần"
            disabled={servings >= 8}
            onClick={() => updateServings(servings + 1)}
            className="tkv-focusable tkv-tactile inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--tkv-border)] bg-[var(--tkv-surface)] text-base font-bold text-[var(--tkv-ink)] hover:bg-[var(--tkv-bg)] disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>

      {/* Quick Presets (1, 2, 4, 6 người) */}
      <div
        role="group"
        aria-label="Chọn nhanh số người ăn"
        className="flex flex-wrap items-center justify-between gap-2"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {QUICK_PRESETS.map((preset) => {
            const active = servings === preset;
            return (
              <button
                key={preset}
                type="button"
                aria-pressed={active}
                onClick={() => updateServings(preset)}
                className={clsx(
                  'tkv-focusable tkv-tactile inline-flex min-h-[44px] min-w-[44px] items-center rounded-full border px-3.5 py-1 text-xs font-semibold tabular-nums',
                  active
                    ? 'border-[var(--tkv-primary)] bg-[var(--tkv-primary)] text-white'
                    : 'border-[var(--tkv-border)] bg-[var(--tkv-surface)] text-[var(--tkv-ink-secondary)] hover:bg-[var(--tkv-surface-subtle)] hover:text-[var(--tkv-ink)]',
                )}
              >
                {preset} người
              </button>
            );
          })}
        </div>

        <span className="text-xs font-medium tabular-nums text-[var(--tkv-ink-secondary)]">
          Ước tính ~{estimatedMinutes} phút nấu · {totalKcal.toLocaleString('vi-VN')} kcal
        </span>
      </div>

      {/* Main Split: Radial Ceramic Plate SVG + Scaled Gram/Unit Table */}
      <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-12">
        {/* Radial Ceramic Plate & Macro Ring SVG */}
        <div className="flex flex-col items-center gap-2 rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] p-3 md:col-span-5">
          <svg
            viewBox="0 0 280 280"
            role="img"
            aria-label={`Đĩa gốm ${servings} khẩu phần: Đạm 32%, Rau xanh 38%, Tinh bột 30%`}
            className="h-auto w-full max-w-[248px] select-none"
          >
            <defs>
              <radialGradient id={`plate-glaze-${uid}`} cx="0.45" cy="0.4" r="0.6">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="80%" stopColor="#FCF8F2" />
                <stop offset="100%" stopColor="#EFE4D7" />
              </radialGradient>
            </defs>

            {/* Outer track */}
            <circle
              cx={cx}
              cy={cy}
              r={ringR}
              fill="none"
              stroke="#EAE0D5"
              strokeWidth="12"
            />

            {/* Harmonic Macro Arcs (rotated -90deg so Protein starts at 12 o'clock) */}
            <g transform={`rotate(-90 ${cx} ${cy})`}>
              {/* Đạm 32% (#D86A43 Terracotta) */}
              <circle
                cx={cx}
                cy={cy}
                r={ringR}
                fill="none"
                stroke="#D86A43"
                strokeWidth={11 + servings * 0.35}
                strokeLinecap="round"
                strokeDasharray={`${proteinLen} ${circumference}`}
                strokeDashoffset={0}
              />
              {/* Rau xanh 38% (#4E7A5B Botanical Sage) */}
              <circle
                cx={cx}
                cy={cy}
                r={ringR}
                fill="none"
                stroke="#4E7A5B"
                strokeWidth={11 + servings * 0.35}
                strokeLinecap="round"
                strokeDasharray={`${greensLen} ${circumference}`}
                strokeDashoffset={greensOffset}
              />
              {/* Tinh bột 30% (#C68634 Toasted Honey) */}
              <circle
                cx={cx}
                cy={cy}
                r={ringR}
                fill="none"
                stroke="#C68634"
                strokeWidth={11 + servings * 0.35}
                strokeLinecap="round"
                strokeDasharray={`${carbsLen} ${circumference}`}
                strokeDashoffset={carbsOffset}
              />
            </g>

            {/* Sunlit Ceramic Dinner Plate */}
            <circle
              cx={cx}
              cy={cy}
              r="84"
              fill={`url(#plate-glaze-${uid})`}
              stroke="#D5C3B3"
              strokeWidth="2"
            />
            <circle
              cx={cx}
              cy={cy}
              r="76"
              fill="none"
              stroke="#EAE0D5"
              strokeWidth="1.2"
            />

            {/* Dynamic Portion Wedges on Ceramic Plate */}
            {servings === 1 ? (
              <g>
                <circle
                  cx={cx}
                  cy={cy}
                  r="69"
                  fill="#FDF0EA"
                  stroke="#EBCBB9"
                  strokeWidth="1.4"
                />
                <circle cx={cx - 24} cy={cy - 36} r="5" fill="#4E7A5B" />
                <circle cx={cx + 28} cy={cy + 34} r="5" fill="#C68634" />
              </g>
            ) : (
              wedges.map((w) => {
                const wedgeTones = ['#FDF0EA', '#EEF5F0', '#FCF5E6'];
                const dotTones = ['#D86A43', '#4E7A5B', '#C68634'];
                return (
                  <g key={w.idx}>
                    <path
                      d={describeWedgePath(cx, cy, 34, 71, w.startDeg, w.endDeg)}
                      fill={wedgeTones[w.idx % wedgeTones.length]}
                      stroke="#E5D6C5"
                      strokeWidth="1.2"
                    />
                    <circle
                      cx={w.garnishPos.x}
                      cy={w.garnishPos.y}
                      r="4.2"
                      fill={dotTones[w.idx % dotTones.length]}
                    />
                  </g>
                );
              })
            )}

            {/* Central Ceramic Portion Medallion */}
            <circle
              cx={cx}
              cy={cy}
              r="31"
              fill="#FFFDF9"
              stroke="#EAE0D5"
              strokeWidth="2"
            />
            <text
              x={cx}
              y={cy - 2}
              textAnchor="middle"
              fill="#2C221E"
              fontSize="18"
              fontWeight="800"
            >
              {servings}
            </text>
            <text
              x={cx}
              y={cy + 13}
              textAnchor="middle"
              fill="#5F524A"
              fontSize="9.5"
              fontWeight="700"
            >
              NGƯỜI ĂN
            </text>
          </svg>

          {/* Macro Balance Legend */}
          <div className="flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-[var(--tkv-ink-secondary)]">
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: '#D86A43' }}
              />
              Đạm 32%
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: '#4E7A5B' }}
              />
              Rau xanh 38%
            </span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <span
                aria-hidden="true"
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: '#C68634' }}
              />
              Tinh bột 30%
            </span>
          </div>
        </div>

        {/* Live Scaled Ingredient Gram/Unit Table */}
        <div className="flex flex-col gap-2 rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-surface-subtle)] p-3.5 md:col-span-7">
          <div className="flex items-center justify-between border-b border-[var(--tkv-border)] pb-2 text-xs font-bold text-[var(--tkv-ink-secondary)]">
            <span>Nguyên liệu định lượng</span>
            <span className="tabular-nums">Khẩu phần {servings} người</span>
          </div>

          <div className="flex flex-col gap-2">
            {sampleIngredients.map((ing) => {
              const scaledQty = ing.baseQty * scaleFactor;
              return (
                <div
                  key={ing.name}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--tkv-border)] bg-[var(--tkv-surface)] px-3 py-2 text-xs"
                >
                  <span className="font-semibold text-[var(--tkv-ink)]">{ing.name}</span>
                  <span className="rounded-full bg-[var(--tkv-surface-coral)] px-2.5 py-0.5 font-bold tabular-nums text-[var(--tkv-coral-ink)]">
                    {formatScaledQuantity(scaledQty)} {ing.unit}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractivePortionMacroDialSvg;
