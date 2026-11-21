import React, { useEffect, useId, useState } from 'react';
import { clsx } from 'clsx';

export interface FridgeZoneCounts {
  cool?: number;
  crisper?: number;
  chiller?: number;
  freezer?: number;
}

export interface InteractiveFridgeCutawaySvgProps {
  countsByZone?: FridgeZoneCounts;
  expiringCount?: number;
  selectedZone?: string;
  onSelectZone?: (zoneId: string) => void;
  className?: string;
}

interface FridgeCompartmentSpec {
  id: 'cool' | 'crisper' | 'chiller' | 'freezer';
  title: string;
  tempBadge: string;
  subtitle: string;
  fullLine: string;
  tip: string;
  y: number;
  height: number;
  glowFill: string;
  glowStroke: string;
  badgeFill: string;
}

const COMPARTMENTS: FridgeCompartmentSpec[] = [
  {
    id: 'cool',
    title: 'Ngăn mát trên',
    tempBadge: '4°C',
    subtitle: 'Trứng, đậu phụ, đồ chín',
    fullLine: 'Ngăn mát trên (4°C) — Trứng, đậu phụ, đồ chín',
    tip: 'Đặt hộp đồ chín ở tầng mắt nhìn để ưu tiên dùng trong 24h; thay nước ngâm đậu phụ mỗi ngày.',
    y: 52,
    height: 92,
    glowFill: '#FCF5E6',
    glowStroke: '#C68634',
    badgeFill: '#C68634',
  },
  {
    id: 'crisper',
    title: 'Ngăn rau củ ẩm',
    tempBadge: '90% RH',
    subtitle: 'Rau ăn lá, hành ngò, cà chua',
    fullLine: 'Ngăn rau củ ẩm (90% RH) — Rau ăn lá, hành ngò, cà chua',
    tip: 'Giữ độ ẩm 90% RH kèm khăn giấy lót đáy giúp rau cải, hành ngò tươi giòn thêm 3–4 ngày.',
    y: 154,
    height: 96,
    glowFill: '#EEF5F0',
    glowStroke: '#4E7A5B',
    badgeFill: '#4E7A5B',
  },
  {
    id: 'chiller',
    title: 'Ngăn tươi sống',
    tempBadge: '0°C',
    subtitle: 'Thịt cá dùng trong 24–48h',
    fullLine: 'Ngăn tươi sống (0°C) — Thịt cá dùng trong 24–48h',
    tip: 'Nhiệt độ 0°C giữ thớ thịt cá mềm tươi để nấu ngay mà không mất thời gian rã đông.',
    y: 260,
    height: 90,
    glowFill: '#FDF0EA',
    glowStroke: '#D86A43',
    badgeFill: '#D86A43',
  },
  {
    id: 'freezer',
    title: 'Ngăn đông',
    tempBadge: '-18°C',
    subtitle: 'Trữ đông dài ngày theo lô',
    fullLine: 'Ngăn đông (-18°C) — Trữ đông dài ngày theo lô',
    tip: 'Chia sẵn từng phần 200g–300g kèm nhãn ngày cấp đông để lấy đúng khẩu phần mỗi tối.',
    y: 364,
    height: 96,
    glowFill: '#EEF5F0',
    glowStroke: '#4E7A5B',
    badgeFill: '#5F524A',
  },
];

function renderShelfContentsSvg(zoneId: FridgeCompartmentSpec['id']): React.ReactNode {
  switch (zoneId) {
    case 'cool':
      return (
        <g transform="translate(88, 102)">
          {/* Ceramic Egg Tray with 4 Farm Eggs */}
          <rect x="0" y="14" width="84" height="16" rx="6" fill="#EADAC8" stroke="#D5C3B3" strokeWidth="1.2" />
          <ellipse cx="16" cy="11" rx="8" ry="10" fill="#F4C79E" />
          <ellipse cx="34" cy="11" rx="8" ry="10" fill="#F0BE90" />
          <ellipse cx="52" cy="11" rx="8" ry="10" fill="#F4C79E" />
          <ellipse cx="70" cy="11" rx="8" ry="10" fill="#EBB483" />

          {/* Silken Tofu in Ceramic Water Dish */}
          <g transform="translate(106, 6)">
            <path d="M0 14 C4 26, 64 26, 68 14 Z" fill="#FFFDF9" stroke="#D5C3B3" strokeWidth="1.4" />
            <rect x="14" y="2" width="40" height="14" rx="3" fill="#FFFDF9" stroke="#EAE0D5" strokeWidth="1.2" />
            <circle cx="34" cy="5" r="2.5" fill="#4E7A5B" />
          </g>

          {/* Covered Ceramic Leftover Cocotte */}
          <g transform="translate(194, 4)">
            <rect x="0" y="8" width="58" height="18" rx="6" fill="#D86A43" />
            <path d="M4 8 C12 -2, 46 -2, 54 8 Z" fill="#E67F5C" />
            <circle cx="29" cy="1" r="3" fill="#C68634" />
          </g>
        </g>
      );
    case 'crisper':
      return (
        <g transform="translate(88, 206)">
          {/* Lush Bok Choy / Leafy Greens */}
          <g transform="translate(8, -8)">
            <path d="M12 34 C2 16, 6 -2, 18 0 C28 2, 26 20, 20 34 Z" fill="#4E7A5B" />
            <path d="M26 34 C22 14, 34 -4, 44 2 C52 8, 42 24, 34 34 Z" fill="#639371" />
            <path d="M14 34 C16 22, 28 22, 32 34 Z" fill="#EEF5F0" />
          </g>

          {/* Ripe Vine Tomatoes */}
          <g transform="translate(88, 6)">
            <circle cx="14" cy="14" r="13" fill="#D86A43" />
            <path d="M10 3 L14 6 L18 3 M14 1 V6" stroke="#4E7A5B" strokeWidth="2" strokeLinecap="round" />
            <circle cx="42" cy="15" r="12" fill="#E0754E" />
            <path d="M38 5 L42 8 L46 5" stroke="#4E7A5B" strokeWidth="2" strokeLinecap="round" />
            <circle cx="67" cy="16" r="11" fill="#C95B35" />
          </g>

          {/* Fresh Scallions & Ginger */}
          <g transform="translate(184, 8)">
            <path d="M0 18 L58 6 M2 21 L62 11 M4 24 L56 17" stroke="#4E7A5B" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M0 18 L14 15 M2 21 L15 19" stroke="#FFFDF9" strokeWidth="3.4" strokeLinecap="round" />
            <ellipse cx="72" cy="18" rx="11" ry="7" fill="#D8B384" stroke="#C68634" strokeWidth="1.2" />
          </g>
        </g>
      );
    case 'chiller':
      return (
        <g transform="translate(88, 308)">
          {/* Chilled Fish Fillet Ceramic Tray */}
          <rect x="4" y="14" width="106" height="14" rx="5" fill="#FFFDF9" stroke="#D5C3B3" strokeWidth="1.3" />
          <path d="M18 14 C34 2, 76 2, 94 14 Z" fill="#E99A82" stroke="#D86A43" strokeWidth="1.2" />
          <path d="M36 7 L42 13 M54 6 L60 13 M72 7 L78 13" stroke="#FFF8F0" strokeWidth="1.5" strokeLinecap="round" />

          {/* Marinated Protein Prep Box */}
          <g transform="translate(132, 2)">
            <rect x="0" y="6" width="112" height="20" rx="6" fill="#FDF0EA" stroke="#EBCBB9" strokeWidth="1.4" />
            <rect x="6" y="3" width="100" height="5" rx="2.5" fill="#D86A43" />
            <circle cx="28" cy="16" r="5" fill="#C95B35" />
            <circle cx="48" cy="16" r="5" fill="#C95B35" />
            <circle cx="68" cy="16" r="5" fill="#D86A43" />
            <circle cx="86" cy="16" r="4" fill="#4E7A5B" />
          </g>
        </g>
      );
    default:
      return (
        <g transform="translate(88, 412)">
          {/* Stacked Batch Meal-Prep Containers */}
          <rect x="6" y="8" width="78" height="22" rx="5" fill="#FFFDF9" stroke="#CFE2D5" strokeWidth="1.5" />
          <rect x="4" y="5" width="82" height="5" rx="2.5" fill="#4E7A5B" />
          <rect x="14" y="-12" width="62" height="17" rx="4" fill="#FFFDF9" stroke="#CFE2D5" strokeWidth="1.5" />
          <rect x="12" y="-14" width="66" height="4" rx="2" fill="#4E7A5B" />

          <rect x="104" y="6" width="82" height="24" rx="5" fill="#FFFDF9" stroke="#EAE0D5" strokeWidth="1.5" />
          <rect x="102" y="3" width="86" height="5" rx="2.5" fill="#C68634" />

          {/* Delicate Frost Crystal Vector Star */}
          <g transform="translate(226, 10)" stroke="#4E7A5B" strokeWidth="1.6" strokeLinecap="round" opacity="0.7">
            <line x1="-10" y1="0" x2="10" y2="0" />
            <line x1="0" y1="-10" x2="0" y2="10" />
            <line x1="-7" y1="-7" x2="7" y2="7" />
            <line x1="-7" y1="7" x2="7" y2="-7" />
          </g>
        </g>
      );
  }
}

export const InteractiveFridgeCutawaySvg: React.FC<InteractiveFridgeCutawaySvgProps> = ({
  countsByZone,
  expiringCount = 0,
  selectedZone,
  onSelectZone,
  className,
}) => {
  const uid = useId().replace(/:/g, '');
  const [internalZone, setInternalZone] = useState<string>('crisper');
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [airDash, setAirDash] = useState<number>(0);

  const activeZoneId = selectedZone ?? internalZone;
  const highlightedZoneId = hoveredZone ?? activeZoneId;

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let reduced = false;
    try {
      reduced = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    } catch {
      reduced = false;
    }
    if (reduced) return undefined;

    let rafId: number | null = null;
    let prev = typeof performance !== 'undefined' ? performance.now() : 0;
    const step = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - prev) / 1000));
      prev = now;
      setAirDash((d) => (d - dt * 28) % 120);
      rafId = window.requestAnimationFrame(step);
    };
    rafId = window.requestAnimationFrame(step);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const counts: Record<FridgeCompartmentSpec['id'], number> = {
    cool: Math.max(0, countsByZone?.cool ?? 5),
    crisper: Math.max(0, countsByZone?.crisper ?? 7),
    chiller: Math.max(0, countsByZone?.chiller ?? 2),
    freezer: Math.max(0, countsByZone?.freezer ?? 4),
  };

  const totalCount = counts.cool + counts.crisper + counts.chiller + counts.freezer;

  const handleTriggerZone = (zoneId: string) => {
    setInternalZone(zoneId);
    onSelectZone?.(zoneId);
  };

  const focusedSpec =
    COMPARTMENTS.find((c) => c.id === highlightedZoneId) ?? COMPARTMENTS[0];

  return (
    <div
      className={clsx(
        'flex flex-col gap-3.5 rounded-[var(--tkv-radius-card)] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-4 sm:p-5 shadow-[var(--tkv-shadow-card)]',
        className,
      )}
    >
      {/* Header & Expiring Alert Pill */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--tkv-ink-muted)]">
            Mặt cắt tủ lạnh gốm sứ · {totalCount} món
          </span>
          <h3 className="tkv-heading text-base font-bold text-[var(--tkv-ink)]">
            Chạm vào từng ngăn để lọc theo vùng nhiệt độ
          </h3>
        </div>

        {expiringCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tkv-border-coral)] bg-[var(--tkv-surface-coral)] px-3 py-1 text-xs font-semibold text-[var(--tkv-coral-ink)] tabular-nums">
            <span
              aria-hidden="true"
              className="h-2 w-2 rounded-full bg-[var(--tkv-primary)]"
            />
            <span>{expiringCount} món cần nấu sớm</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tkv-border-mint)] bg-[var(--tkv-surface-mint)] px-3 py-1 text-xs font-semibold text-[var(--tkv-success-ink)]">
            <span>Độ tươi ổn định</span>
          </span>
        )}
      </div>

      {/* Architectural Cutaway SVG */}
      <div className="w-full overflow-hidden rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)]">
        <svg
          viewBox="0 0 600 492"
          role="group"
          aria-label="Mặt cắt 4 ngăn nhiệt độ tủ lạnh Takolio"
          className="block h-auto w-full select-none"
        >
          <defs>
            <linearGradient id={`body-ceramic-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFFDFB" />
              <stop offset="100%" stopColor="#F5ECE2" />
            </linearGradient>
            <linearGradient id={`led-top-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFF7EB" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#FFFDFB" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Ground shadow */}
          <ellipse cx="300" cy="478" rx="236" ry="9" fill="#5F524A" fillOpacity="0.1" />

          {/* Outer Sunlit Ceramic Refrigerator Cabinet */}
          <rect
            x="54"
            y="18"
            width="492"
            height="456"
            rx="28"
            fill={`url(#body-ceramic-${uid})`}
            stroke="#D5C3B3"
            strokeWidth="2.5"
          />

          {/* Insulated gasket inner frame */}
          <rect
            x="68"
            y="32"
            width="464"
            height="430"
            rx="20"
            fill="#FAF5EE"
            stroke="#EAE0D5"
            strokeWidth="2"
          />

          {/* Warm Interior Top LED Strip */}
          <rect x="210" y="36" width="180" height="6" rx="3" fill="#FFF3DC" stroke="#EDD9B4" strokeWidth="1" />
          <rect x="80" y="42" width="440" height="44" fill={`url(#led-top-${uid})`} />

          {/* Freezer insulated divider bar between Chiller and Freezer */}
          <rect x="68" y="354" width="464" height="7" fill="#E5D6C5" />

          {/* External brass/oak vertical handle accent on right frame */}
          <rect x="536" y="112" width="6" height="156" rx="3" fill="#D8B384" />
          <rect x="536" y="376" width="6" height="72" rx="3" fill="#D8B384" />

          {/* 4 Interactive Clickable Compartments */}
          {COMPARTMENTS.map((comp) => {
            const isHighlighted = highlightedZoneId === comp.id;
            const itemCount = counts[comp.id];

            return (
              <g
                key={comp.id}
                onPointerEnter={() => setHoveredZone(comp.id)}
                onPointerLeave={() => setHoveredZone(null)}
                onClick={() => handleTriggerZone(comp.id)}
                className="cursor-pointer"
              >
                {/* Compartment interior cavity */}
                <rect
                  x="76"
                  y={comp.y}
                  width="448"
                  height={comp.height}
                  rx="14"
                  fill={isHighlighted ? comp.glowFill : '#FFFFFF'}
                  stroke={isHighlighted ? comp.glowStroke : '#EAE0D5'}
                  strokeWidth={isHighlighted ? 2.4 : 1.3}
                />

                {/* Tempered ceramic-glass shelf ledge */}
                <line
                  x1="82"
                  y1={comp.y + comp.height - 6}
                  x2="518"
                  y2={comp.y + comp.height - 6}
                  stroke={isHighlighted ? comp.glowStroke : '#D5C3B3'}
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />

                {/* Animated Laminar Airflow Arrows when active/hovered */}
                <g opacity={isHighlighted ? 0.85 : 0.22}>
                  <path
                    d={`M 92 ${comp.y + 20} C 168 ${comp.y + 10}, 264 ${comp.y + 28}, 344 ${comp.y + 16}`}
                    fill="none"
                    stroke={comp.glowStroke}
                    strokeWidth="1.8"
                    strokeDasharray="7 6"
                    strokeDashoffset={airDash}
                    strokeLinecap="round"
                  />
                  <path
                    d={`M 339 ${comp.y + 12} L 347 ${comp.y + 16} L 340 ${comp.y + 21}`}
                    fill="none"
                    stroke={comp.glowStroke}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>

                {/* Sculpted Vector Ingredients on Left Half */}
                {renderShelfContentsSvg(comp.id)}

                {/* Right-side Architectural Label & Live Count Pill */}
                <g transform={`translate(356, ${comp.y + 16})`}>
                  <rect
                    x="0"
                    y="0"
                    width="154"
                    height={comp.height - 30}
                    rx="10"
                    fill={isHighlighted ? '#FFFFFF' : '#FCF9F5'}
                    stroke={isHighlighted ? comp.glowStroke : '#EAE0D5'}
                    strokeWidth="1.2"
                  />
                  <text x="12" y="20" fill="#2C221E" fontSize="12.5" fontWeight="700">
                    {comp.title}
                  </text>

                  {/* Temperature / Humidity Badge */}
                  <rect
                    x="104"
                    y="7"
                    width="42"
                    height="18"
                    rx="9"
                    fill={comp.glowFill}
                    stroke={comp.glowStroke}
                    strokeWidth="1"
                  />
                  <text
                    x="125"
                    y="19"
                    textAnchor="middle"
                    fill="#2C221E"
                    fontSize="9.5"
                    fontWeight="700"
                  >
                    {comp.tempBadge}
                  </text>

                  <text x="12" y="37" fill="#5F524A" fontSize="10.2" fontWeight="500">
                    {comp.subtitle}
                  </text>

                  {/* Live Item Count Pill */}
                  <rect
                    x="12"
                    y="43"
                    width="64"
                    height="16"
                    rx="8"
                    fill={isHighlighted ? comp.badgeFill : '#F7EFE6'}
                  />
                  <text
                    x="44"
                    y="54"
                    textAnchor="middle"
                    fill={isHighlighted ? '#FFFFFF' : '#2C221E'}
                    fontSize="10"
                    fontWeight="700"
                  >
                    {itemCount} món
                  </text>
                </g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Quick Zone Selector Buttons & Storage Tip Readout */}
      <div className="flex flex-wrap items-center gap-1.5">
        {COMPARTMENTS.map((comp) => {
          const isSelected = activeZoneId === comp.id;
          return (
            <button
              key={comp.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => handleTriggerZone(comp.id)}
              className={clsx(
                'tkv-focusable tkv-tactile inline-flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold tabular-nums',
                isSelected
                  ? 'border-[var(--tkv-primary)] bg-[var(--tkv-primary)] text-white'
                  : 'border-[var(--tkv-border)] bg-[var(--tkv-surface-subtle)] text-[var(--tkv-ink-secondary)] hover:bg-[var(--tkv-surface)] hover:text-[var(--tkv-ink)]',
              )}
            >
              <span>{comp.title}</span>
              <span className="opacity-85">({counts[comp.id]})</span>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-surface-subtle)] px-3.5 py-2.5 text-xs text-[var(--tkv-ink-secondary)]">
        <span className="font-bold text-[var(--tkv-ink)]">{focusedSpec.fullLine}: </span>
        <span>{focusedSpec.tip}</span>
      </div>
    </div>
  );
};

export default InteractiveFridgeCutawaySvg;
