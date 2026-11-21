import React, { useEffect, useId, useState } from 'react';
import { clsx } from 'clsx';

export interface ScannedIngredientItem {
  id: string;
  label: string;
  quantityText: string;
  confidence: number;
  zoneLabel: string;
  shelfLifeLabel: string;
  box: { x: number; y: number; w: number; h: number };
}

export interface InteractiveAiScanHudSvgProps {
  onApproveDraft?: (approvedItems: ScannedIngredientItem[]) => void;
  onToggleItem?: (itemId: string, approved: boolean) => void;
  className?: string;
}

const DETECTED_INGREDIENTS: ScannedIngredientItem[] = [
  {
    id: 'tofu',
    label: 'Đậu phụ non 300g',
    quantityText: '1 hộp · 300g',
    confidence: 99,
    zoneLabel: 'Ngăn mát trên (4°C)',
    shelfLifeLabel: 'Dùng ngon trong 2 ngày',
    box: { x: 54, y: 66, w: 158, h: 120 },
  },
  {
    id: 'eggs',
    label: 'Trứng gà ta 6 quả',
    quantityText: '6 quả · cỡ vừa',
    confidence: 98,
    zoneLabel: 'Ngăn mát trên (4°C)',
    shelfLifeLabel: 'Dùng ngon trong 10 ngày',
    box: { x: 238, y: 58, w: 168, h: 128 },
  },
  {
    id: 'bokchoy',
    label: 'Cải thìa tươi 400g',
    quantityText: '1 bó · 400g',
    confidence: 96,
    zoneLabel: 'Ngăn rau củ ẩm (90% RH)',
    shelfLifeLabel: 'Dùng ngon trong 3 ngày',
    box: { x: 64, y: 212, w: 178, h: 136 },
  },
  {
    id: 'tomatoes',
    label: 'Cà chua chín 3 quả',
    quantityText: '3 quả · ~320g',
    confidence: 97,
    zoneLabel: 'Ngăn rau củ ẩm (90% RH)',
    shelfLifeLabel: 'Dùng ngon trong 4 ngày',
    box: { x: 264, y: 214, w: 154, h: 132 },
  },
  {
    id: 'scallion-ginger',
    label: 'Hành lá & gừng 100g',
    quantityText: '1 cụm · 100g',
    confidence: 94,
    zoneLabel: 'Ngăn rau củ ẩm (90% RH)',
    shelfLifeLabel: 'Dùng ngon trong 5 ngày',
    box: { x: 438, y: 196, w: 164, h: 150 },
  },
];

function renderIngredientArtwork(id: string): React.ReactNode {
  switch (id) {
    case 'tofu':
      return (
        <g transform="translate(133, 132)">
          <ellipse cx="0" cy="14" rx="58" ry="28" fill="#EAE0D5" />
          <ellipse cx="0" cy="10" rx="56" ry="26" fill="#FFFDF9" stroke="#D5C3B3" strokeWidth="1.5" />
          {/* Sculpted Silken Tofu Block */}
          <path
            d="M-32 -8 L8 -20 L34 -4 L-6 10 Z"
            fill="#FFFDF9"
            stroke="#EAE0D5"
            strokeWidth="1.3"
          />
          <path
            d="M-32 -8 L-6 10 L-6 24 L-32 8 Z"
            fill="#F7EFE6"
            stroke="#EAE0D5"
            strokeWidth="1.3"
          />
          <path
            d="M-6 10 L34 -4 L34 10 L-6 24 Z"
            fill="#F3E7DA"
            stroke="#EAE0D5"
            strokeWidth="1.3"
          />
          {/* Botanical Sage Garnish Leaf */}
          <path d="M-2 -6 C6 -14, 16 -10, 10 -2 C4 2, -4 0, -2 -6 Z" fill="#4E7A5B" />
        </g>
      );
    case 'eggs':
      return (
        <g transform="translate(322, 126)">
          <rect
            x="-60"
            y="-28"
            width="120"
            height="64"
            rx="16"
            fill="#EADAC8"
            stroke="#D5C3B3"
            strokeWidth="1.5"
          />
          {[
            [-34, -8],
            [0, -10],
            [34, -8],
            [-32, 16],
            [2, 15],
            [35, 16],
          ].map(([ex, ey], i) => (
            <g key={i} transform={`translate(${ex}, ${ey})`}>
              <ellipse cx="0" cy="2" rx="13" ry="15" fill="#5F524A" fillOpacity="0.12" />
              <ellipse
                cx="0"
                cy="0"
                rx="12.5"
                ry="15"
                fill={i % 2 === 0 ? '#F2C69D' : '#EBB98B'}
                stroke="#DFAD7E"
                strokeWidth="1"
              />
              <ellipse cx="-4" cy="-5" rx="3.5" ry="5" fill="#FFF8F0" fillOpacity="0.55" />
            </g>
          ))}
        </g>
      );
    case 'bokchoy':
      return (
        <g transform="translate(152, 286)">
          {/* Spoon-shaped green leaves */}
          <path
            d="M-48 16 C-68 -16, -42 -48, -12 -32 C10 -20, 4 10, -16 24 Z"
            fill="#4E7A5B"
          />
          <path
            d="M-18 22 C-24 -22, 14 -50, 38 -28 C56 -12, 34 18, 8 28 Z"
            fill="#5C8D6B"
          />
          <path
            d="M2 28 C12 -6, 48 -24, 62 -4 C72 12, 46 32, 18 34 Z"
            fill="#3E684B"
          />
          {/* Crisp porcelain-jade bok choy stems */}
          <path
            d="M-46 28 C-26 20, -14 4, -14 -12 C-6 6, -4 20, -24 34 Z"
            fill="#EEF5F0"
            stroke="#CFE2D5"
            strokeWidth="1.2"
          />
          <path
            d="M-38 34 C-10 28, 8 10, 16 -8 C22 10, 8 30, -18 40 Z"
            fill="#FFFDF9"
            stroke="#CFE2D5"
            strokeWidth="1.2"
          />
        </g>
      );
    case 'tomatoes':
      return (
        <g transform="translate(340, 286)">
          {/* Three glossy terracotta-red ripe tomatoes */}
          <g transform="translate(-28, -8)">
            <circle cx="0" cy="4" r="24" fill="#5F524A" fillOpacity="0.12" />
            <circle cx="0" cy="0" r="24" fill="#D86A43" />
            <ellipse cx="-7" cy="-8" rx="6" ry="4" fill="#FFF5EA" fillOpacity="0.45" />
            <path
              d="M-7 -20 L0 -15 L7 -20 M0 -24 V-14 M-9 -14 L0 -15 L9 -14"
              stroke="#4E7A5B"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </g>
          <g transform="translate(24, -4)">
            <circle cx="0" cy="4" r="22" fill="#5F524A" fillOpacity="0.12" />
            <circle cx="0" cy="0" r="22" fill="#E07750" />
            <ellipse cx="-6" cy="-7" rx="5" ry="3.5" fill="#FFF5EA" fillOpacity="0.45" />
            <path
              d="M-6 -18 L0 -13 L6 -18 M0 -22 V-13"
              stroke="#4E7A5B"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </g>
          <g transform="translate(2, 22)">
            <circle cx="0" cy="4" r="21" fill="#5F524A" fillOpacity="0.12" />
            <circle cx="0" cy="0" r="21" fill="#C95934" />
            <ellipse cx="-6" cy="-6" rx="5" ry="3" fill="#FFF5EA" fillOpacity="0.4" />
            <path
              d="M-6 -17 L0 -12 L6 -17 M0 -20 V-12"
              stroke="#4E7A5B"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </g>
        </g>
      );
    default:
      return (
        <g transform="translate(520, 278)">
          {/* Fresh Scallion Stalks */}
          <path
            d="M-54 32 C-18 14, 18 -8, 52 -32"
            stroke="#4E7A5B"
            strokeWidth="6"
            strokeLinecap="round"
          />
          <path
            d="M-48 40 C-12 24, 22 4, 58 -16"
            stroke="#5D8E6B"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
          <path
            d="M-54 32 L-30 20 M-48 40 L-24 29"
            stroke="#FFFDF9"
            strokeWidth="6.2"
            strokeLinecap="round"
          />
          {/* Sculpted Golden Ginger Rhizome & Slices */}
          <g transform="translate(8, 22)">
            <path
              d="M-24 4 C-28 -10, -8 -16, 4 -8 C14 -16, 30 -8, 26 6 C22 18, -18 18, -24 4 Z"
              fill="#D8B384"
              stroke="#C68634"
              strokeWidth="1.5"
            />
            <ellipse cx="-26" cy="14" rx="10" ry="7" fill="#FCF5E6" stroke="#C68634" strokeWidth="1.4" />
            <ellipse cx="-12" cy="18" rx="9" ry="6.5" fill="#FCF5E6" stroke="#C68634" strokeWidth="1.4" />
          </g>
        </g>
      );
  }
}

function renderReticleCorners(
  x: number,
  y: number,
  w: number,
  h: number,
  stroke: string,
  len = 14,
): React.ReactNode {
  return (
    <path
      d={[
        `M ${x} ${y + len} V ${y} H ${x + len}`,
        `M ${x + w - len} ${y} H ${x + w} V ${y + len}`,
        `M ${x + w} ${y + h - len} V ${y + h} H ${x + w - len}`,
        `M ${x + len} ${y + h} H ${x} V ${y + h - len}`,
      ].join(' ')}
      fill="none"
      stroke={stroke}
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  );
}

export const InteractiveAiScanHudSvg: React.FC<InteractiveAiScanHudSvgProps> = ({
  onApproveDraft,
  onToggleItem,
  className,
}) => {
  const uid = useId().replace(/:/g, '');
  const [selectedId, setSelectedId] = useState<string>(DETECTED_INGREDIENTS[0].id);
  const [approvedMap, setApprovedMap] = useState<Record<string, boolean>>(() => ({
    tofu: true,
    eggs: true,
    bokchoy: true,
    tomatoes: true,
    'scallion-ginger': true,
  }));
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [scanLineY, setScanLineY] = useState<number>(84);
  const [draftSavedNotice, setDraftSavedNotice] = useState<boolean>(false);

  // Animated laser scan sweep respecting prefers-reduced-motion
  useEffect(() => {
    if (!isScanning || typeof window === 'undefined') return undefined;
    let reduced = false;
    try {
      reduced = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    } catch {
      reduced = false;
    }
    if (reduced) return undefined;

    let rafId: number | null = null;
    let start = typeof performance !== 'undefined' ? performance.now() : 0;

    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      // Smooth harmonic ping-pong sweep across y = 44..356
      const normalized = 0.5 - 0.5 * Math.cos(elapsed * 1.45);
      setScanLineY(44 + normalized * 312);
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, [isScanning]);

  const toggleApproval = (id: string, nextValue?: boolean) => {
    setApprovedMap((prev) => {
      const resolved = nextValue ?? !prev[id];
      onToggleItem?.(id, resolved);
      return { ...prev, [id]: resolved };
    });
    setDraftSavedNotice(false);
  };

  const activeItem =
    DETECTED_INGREDIENTS.find((item) => item.id === selectedId) ?? DETECTED_INGREDIENTS[0];
  const isActiveApproved = Boolean(approvedMap[activeItem.id]);
  const approvedList = DETECTED_INGREDIENTS.filter((item) => approvedMap[item.id]);

  // Radial confidence gauge geometry (r = 28 -> circumference = 175.93)
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - activeItem.confidence / 100);

  return (
    <div
      className={clsx(
        'flex flex-col gap-3.5 rounded-[var(--tkv-radius-card)] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-4 sm:p-5 shadow-[var(--tkv-shadow-card)]',
        className,
      )}
    >
      {/* Header & Scan Sweep Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--tkv-ink-muted)]">
            Mô phỏng thị giác AI · Duyệt nháp chủ động
          </span>
          <h3 className="tkv-heading text-base font-bold text-[var(--tkv-ink)]">
            Chạm vào từng khung nguyên liệu để kiểm tra & duyệt vào nháp
          </h3>
        </div>

        <button
          type="button"
          aria-pressed={!isScanning}
          onClick={() => setIsScanning((prev) => !prev)}
          className="tkv-focusable tkv-tactile inline-flex min-h-[44px] min-w-[44px] items-center gap-2 rounded-full border border-[var(--tkv-border)] bg-[var(--tkv-surface-subtle)] px-3.5 py-1 text-xs font-semibold text-[var(--tkv-ink)] hover:bg-[var(--tkv-surface)]"
        >
          <span
            aria-hidden="true"
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: isScanning ? 'var(--tkv-primary)' : 'var(--tkv-ink-muted)',
            }}
          />
          <span>{isScanning ? 'Tạm dừng tia quét' : 'Tiếp tục tia quét'}</span>
        </button>
      </div>

      {/* Pure Inline AI Vision Scanner SVG (viewBox 0 0 640 400) */}
      <div className="w-full overflow-hidden rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)]">
        <svg
          viewBox="0 0 640 400"
          role="group"
          aria-label="Khung quét nguyên liệu AI Takolio trên mặt bàn gốm"
          className="block h-auto w-full select-none"
        >
          <defs>
            <linearGradient id={`board-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFFDFB" />
              <stop offset="55%" stopColor="#FAF3EB" />
              <stop offset="100%" stopColor="#F2E5D7" />
            </linearGradient>
            <linearGradient id={`laser-wake-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#D86A43" stopOpacity="0" />
              <stop offset="100%" stopColor="#D86A43" stopOpacity="0.16" />
            </linearGradient>
          </defs>

          {/* Warm Sunlit Ceramic Prep Countertop */}
          <rect width="640" height="400" fill="#FCF9F5" />
          <rect
            x="24"
            y="24"
            width="592"
            height="352"
            rx="24"
            fill={`url(#board-${uid})`}
            stroke="#E5D6C5"
            strokeWidth="2"
          />

          {/* Subtle calibration grid marks */}
          <g stroke="#E5D6C5" strokeWidth="1" opacity="0.65">
            <line x1="220" y1="34" x2="220" y2="366" strokeDasharray="3 7" />
            <line x1="426" y1="34" x2="426" y2="366" strokeDasharray="3 7" />
            <line x1="36" y1="200" x2="604" y2="200" strokeDasharray="3 7" />
          </g>

          {/* Sculpted Kitchen Ingredients */}
          {DETECTED_INGREDIENTS.map((item) => (
            <g
              key={`art-${item.id}`}
              opacity={approvedMap[item.id] ? 1 : 0.45}
            >
              {renderIngredientArtwork(item.id)}
            </g>
          ))}

          {/* Interactive Clickable Bounding-Box Reticles */}
          {DETECTED_INGREDIENTS.map((item) => {
            const isSelected = item.id === activeItem.id;
            const isApproved = Boolean(approvedMap[item.id]);
            const strokeColor = !isApproved
              ? '#87776E'
              : isSelected
                ? '#D86A43'
                : '#4E7A5B';
            const { x, y, w, h } = item.box;

            return (
              <g
                key={`reticle-${item.id}`}
                onClick={() => setSelectedId(item.id)}
                className="cursor-pointer"
              >
                <rect
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  rx="12"
                  fill={isSelected ? strokeColor : '#FFFFFF'}
                  fillOpacity={isSelected ? 0.08 : 0.01}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? 1.6 : 1}
                  strokeDasharray={isApproved ? 'none' : '5 5'}
                />

                {renderReticleCorners(x, y, w, h, strokeColor)}

                {/* Top pill tag on reticle */}
                <rect
                  x={x + 6}
                  y={y - 11}
                  width={Math.min(w - 12, 148)}
                  height="20"
                  rx="10"
                  fill={isSelected ? '#2C221E' : '#FFFDF9'}
                  stroke={strokeColor}
                  strokeWidth="1.2"
                />
                <text
                  x={x + 14}
                  y={y + 2.5}
                  fill={isSelected ? '#FFFFFF' : '#2C221E'}
                  fontSize="9.8"
                  fontWeight="700"
                >
                  {item.confidence}% · {isApproved ? 'Nháp' : 'Bỏ qua'}
                </text>
              </g>
            );
          })}

          {/* Top-Right Radial Confidence HUD Card inside SVG */}
          <g transform="translate(442, 42)">
            <rect
              x="0"
              y="0"
              width="160"
              height="132"
              rx="16"
              fill="#FFFDF9"
              fillOpacity="0.95"
              stroke="#EAE0D5"
              strokeWidth="1.5"
            />
            <g transform="translate(44, 52)">
              <circle
                cx="0"
                cy="0"
                r={radius}
                fill="none"
                stroke="#EAE0D5"
                strokeWidth="6"
              />
              <circle
                cx="0"
                cy="0"
                r={radius}
                fill="none"
                stroke={isActiveApproved ? '#4E7A5B' : '#87776E'}
                strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                transform="rotate(-90)"
              />
              <text
                x="0"
                y="4"
                textAnchor="middle"
                fill="#2C221E"
                fontSize="13"
                fontWeight="800"
              >
                {activeItem.confidence}%
              </text>
            </g>

            <text x="84" y="42" fill="#87776E" fontSize="9.5" fontWeight="700">
              ĐỘ TIN CẬY AI
            </text>
            <text x="84" y="58" fill="#2C221E" fontSize="11" fontWeight="700">
              {isActiveApproved ? 'Giữ trong nháp' : 'Đã bỏ qua'}
            </text>
            <text x="84" y="74" fill="#4E7A5B" fontSize="9.5" fontWeight="600">
              Chờ bạn duyệt
            </text>

            <line x1="12" y1="94" x2="148" y2="94" stroke="#EAE0D5" strokeWidth="1" />
            <text x="14" y="112" fill="#2C221E" fontSize="10.5" fontWeight="700">
              {activeItem.label}
            </text>
          </g>

          {/* Animated Laser Scan Sweep */}
          {isScanning && (
            <g pointerEvents="none">
              <rect
                x="28"
                y={Math.max(28, scanLineY - 26)}
                width="584"
                height="26"
                fill={`url(#laser-wake-${uid})`}
              />
              <line
                x1="28"
                y1={scanLineY}
                x2="612"
                y2={scanLineY}
                stroke="#D86A43"
                strokeWidth="2.2"
              />
              <circle cx="32" cy={scanLineY} r="3.5" fill="#D86A43" />
              <circle cx="608" cy={scanLineY} r="3.5" fill="#D86A43" />
            </g>
          )}
        </svg>
      </div>

      {/* Mandatory Human-in-the-Loop Review Controls */}
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-surface-subtle)] p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-[var(--tkv-ink)]">
              {activeItem.label}{' '}
              <span className="font-medium text-[var(--tkv-ink-secondary)]">
                ({activeItem.quantityText})
              </span>
            </span>
            <span className="text-xs text-[var(--tkv-ink-secondary)]">
              {activeItem.zoneLabel} · {activeItem.shelfLifeLabel}
            </span>
          </div>

          <div
            role="group"
            aria-label={`Quyết định duyệt nháp cho ${activeItem.label}`}
            className="inline-flex items-center gap-1.5"
          >
            <button
              type="button"
              aria-pressed={isActiveApproved}
              onClick={() => toggleApproval(activeItem.id, true)}
              className={clsx(
                'tkv-focusable tkv-tactile inline-flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold',
                isActiveApproved
                  ? 'border-[var(--tkv-border-mint)] bg-[var(--tkv-success)] text-white'
                  : 'border-[var(--tkv-border)] bg-[var(--tkv-surface)] text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-ink)]',
              )}
            >
              <span>Đã duyệt vào nháp</span>
            </button>

            <button
              type="button"
              aria-pressed={!isActiveApproved}
              onClick={() => toggleApproval(activeItem.id, false)}
              className={clsx(
                'tkv-focusable tkv-tactile inline-flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold',
                !isActiveApproved
                  ? 'border-[var(--tkv-border-strong)] bg-[var(--tkv-ink)] text-white'
                  : 'border-[var(--tkv-border)] bg-[var(--tkv-surface)] text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-ink)]',
              )}
            >
              <span>Bỏ qua</span>
            </button>
          </div>
        </div>

        {/* Quick Ingredient Pills & Draft Summary */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--tkv-border)] pt-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {DETECTED_INGREDIENTS.map((item) => {
              const approved = Boolean(approvedMap[item.id]);
              const active = item.id === activeItem.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={clsx(
                    'tkv-focusable tkv-tactile inline-flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                    active
                      ? 'border-[var(--tkv-primary)] bg-[var(--tkv-surface)] text-[var(--tkv-ink)]'
                      : 'border-[var(--tkv-border)] bg-[var(--tkv-surface)] text-[var(--tkv-ink-secondary)]',
                    !approved && 'line-through opacity-65',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      backgroundColor: approved
                        ? 'var(--tkv-success)'
                        : 'var(--tkv-ink-muted)',
                    }}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold tabular-nums text-[var(--tkv-ink-secondary)]">
              {draftSavedNotice
                ? `Đã ghi nhận ${approvedList.length} món vào bản nháp Takolio`
                : `Sẵn sàng lưu ${approvedList.length}/${DETECTED_INGREDIENTS.length} món`}
            </span>
            {onApproveDraft && (
              <button
                type="button"
                disabled={approvedList.length === 0}
                onClick={() => {
                  setDraftSavedNotice(true);
                  onApproveDraft(approvedList);
                }}
                className="tkv-focusable tkv-tactile inline-flex min-h-[44px] min-w-[44px] items-center rounded-full bg-[var(--tkv-primary)] px-3.5 py-1 text-xs font-semibold text-white hover:bg-[var(--tkv-primary-cta-hover)] disabled:opacity-50"
              >
                Lưu bản nháp ({approvedList.length})
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default InteractiveAiScanHudSvg;
