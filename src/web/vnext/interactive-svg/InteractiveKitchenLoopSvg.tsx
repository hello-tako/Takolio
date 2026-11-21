import React, { useEffect, useId, useRef, useState } from 'react';
import { clsx } from 'clsx';

export interface KitchenLoopStation {
  id: string;
  step: string;
  label: string;
  shortLabel: string;
  href: string;
  ctaLabel: string;
  accentHex: string;
  surfaceHex: string;
  summary: string;
  guarantee: string;
  angleDeg: number;
  cx: number;
  cy: number;
}

export interface InteractiveKitchenLoopSvgProps {
  initialStationId?: string;
  onNavigate?: (href: string) => void;
  onSelectStation?: (stationId: string) => void;
  className?: string;
}

const KITCHEN_STATIONS: KitchenLoopStation[] = [
  {
    id: 'fridge',
    step: '01',
    label: '01 Tủ lạnh',
    shortLabel: 'Tủ lạnh',
    href: '/fridge',
    ctaLabel: 'Mở tủ lạnh thông minh',
    accentHex: '#4E7A5B',
    surfaceHex: '#EEF5F0',
    summary: 'Theo dõi nguyên liệu theo 4 ngăn nhiệt độ cùng cảnh báo độ tươi trực quan.',
    guarantee:
      'Cam kết Takolio: Phân nhóm rõ thực phẩm tươi mới, dùng sớm và ưu tiên nấu để không lãng phí rau củ mỗi tuần.',
    angleDeg: -90,
    cx: 340,
    cy: 64,
  },
  {
    id: 'scan',
    step: '02',
    label: '02 AI Scan',
    shortLabel: 'AI Scan',
    href: '/scan',
    ctaLabel: 'Quét nguyên liệu mới',
    accentHex: '#D86A43',
    surfaceHex: '#FDF0EA',
    summary: 'Chụp ảnh mâm đồ chợ hoặc hoá đơn để bóc tách tên món, định lượng và hạn dùng dự kiến.',
    guarantee:
      'Cam kết Takolio: AI luôn dừng ở bản nháp — chỉ những nguyên liệu bạn duyệt tay mới được ghi vào kho bếp.',
    angleDeg: -30,
    cx: 537,
    cy: 137,
  },
  {
    id: 'suggest',
    step: '03',
    label: '03 Gợi ý món',
    shortLabel: 'Gợi ý món',
    href: '/suggest',
    ctaLabel: 'Xem gợi ý món hôm nay',
    accentHex: '#C68634',
    surfaceHex: '#FCF5E6',
    summary: 'Khớp thực đơn cơm nhà Việt Nam chuẩn vị từ đúng những gì đang có sẵn trong tủ.',
    guarantee:
      'Cam kết Takolio: Ưu tiên giải phóng nguyên liệu sắp đến hạn trước, ghi rõ phần đã có và phần cần mua thêm.',
    angleDeg: 30,
    cx: 537,
    cy: 283,
  },
  {
    id: 'week',
    step: '04',
    label: '04 Thực đơn tuần',
    shortLabel: 'Thực đơn tuần',
    href: '/week',
    ctaLabel: 'Xếp lịch thực đơn tuần',
    accentHex: '#4E7A5B',
    surfaceHex: '#EEF5F0',
    summary: 'Lên lịch bữa sáng, trưa, tối cân bằng đạm — rau xanh — tinh bột cho cả gia đình.',
    guarantee:
      'Cam kết Takolio: Tự động đồng bộ khẩu phần từng bữa sang danh sách đi chợ mà không phải tính nhẩm lại.',
    angleDeg: 90,
    cx: 340,
    cy: 356,
  },
  {
    id: 'shopping',
    step: '05',
    label: '05 Đi chợ',
    shortLabel: 'Đi chợ',
    href: '/shopping',
    ctaLabel: 'Mở giỏ đi chợ gọn nhẹ',
    accentHex: '#C68634',
    surfaceHex: '#FCF5E6',
    summary: 'Gom nhóm nguyên liệu cần mua theo quầy rau, thịt cá, đồ khô để đi chợ một vòng là đủ.',
    guarantee:
      'Cam kết Takolio: Khấu trừ chính xác lượng tồn kho hiện có trong tủ lạnh để không mua trùng đồ đã sẵn.',
    angleDeg: 150,
    cx: 143,
    cy: 283,
  },
  {
    id: 'cook',
    step: '06',
    label: '06 Nấu ăn',
    shortLabel: 'Nấu ăn',
    href: '/cook',
    ctaLabel: 'Bắt đầu chế độ vào bếp',
    accentHex: '#D86A43',
    surfaceHex: '#FDF0EA',
    summary: 'Hướng dẫn từng bước chữ rõ dễ đọc kèm đồng hồ canh lửa liu riu ngay tại bàn bếp.',
    guarantee:
      'Cam kết Takolio: Hoàn tất món ăn sẽ tự động cập nhật lại định lượng tồn kho, khép kín vòng lặp bếp ấm.',
    angleDeg: 210,
    cx: 143,
    cy: 137,
  },
];

function renderStationGlyph(id: string, strokeHex: string): React.ReactNode {
  switch (id) {
    case 'fridge':
      return (
        <g fill="none" stroke={strokeHex} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="-7" y="-9" width="14" height="18" rx="2.5" />
          <line x1="-7" y1="-1" x2="7" y2="-1" />
          <line x1="-4" y1="-5.5" x2="-4" y2="-3.5" />
          <line x1="-4" y1="2.5" x2="-4" y2="5.5" />
        </g>
      );
    case 'scan':
      return (
        <g fill="none" stroke={strokeHex} strokeWidth="1.8" strokeLinecap="round">
          <path d="M-8 -4 V-8 H-4 M4 -8 H8 V-4 M8 4 V8 H4 M-4 8 H-8 V4" />
          <line x1="-6" y1="0" x2="6" y2="0" />
        </g>
      );
    case 'suggest':
      return (
        <g fill="none" stroke={strokeHex} strokeWidth="1.8" strokeLinecap="round">
          <path d="M-8 1 C-8 6.5, 8 6.5, 8 1 Z" />
          <line x1="-9" y1="1" x2="9" y2="1" />
          <path d="M-3 -3 Q-2 -6 0 -7 M3 -3 Q4 -6 2 -7" />
        </g>
      );
    case 'week':
      return (
        <g fill="none" stroke={strokeHex} strokeWidth="1.8" strokeLinecap="round">
          <rect x="-8" y="-7" width="16" height="15" rx="2.5" />
          <line x1="-8" y1="-2" x2="8" y2="-2" />
          <line x1="-4" y1="-9" x2="-4" y2="-5.5" />
          <line x1="4" y1="-9" x2="4" y2="-5.5" />
        </g>
      );
    case 'shopping':
      return (
        <g fill="none" stroke={strokeHex} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M-8 -2 H8 L6 8 H-6 Z" />
          <path d="M-4 -2 C-4 -7, 4 -7, 4 -2" />
        </g>
      );
    default:
      return (
        <g fill="none" stroke={strokeHex} strokeWidth="1.8" strokeLinecap="round">
          <rect x="-7" y="-2" width="14" height="9" rx="2.5" />
          <line x1="-9.5" y1="0" x2="-7" y2="0" />
          <line x1="7" y1="0" x2="9.5" y2="0" />
          <path d="M-4 -4.5 H4 M0 -4.5 V-6.5" />
        </g>
      );
  }
}

export const InteractiveKitchenLoopSvg: React.FC<InteractiveKitchenLoopSvgProps> = ({
  initialStationId = 'fridge',
  onNavigate,
  onSelectStation,
  className,
}) => {
  const uid = useId().replace(/:/g, '');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const initialIdx = Math.max(
    0,
    KITCHEN_STATIONS.findIndex((s) => s.id === initialStationId),
  );
  const [activeIndex, setActiveIndex] = useState<number>(initialIdx);
  const [dashOffset, setDashOffset] = useState<number>(0);

  useEffect(() => {
    const idx = KITCHEN_STATIONS.findIndex((s) => s.id === initialStationId);
    if (idx >= 0) setActiveIndex(idx);
  }, [initialStationId]);

  // Smooth orbital dash flow respecting prefers-reduced-motion
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
    let last = typeof performance !== 'undefined' ? performance.now() : 0;

    const animate = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      setDashOffset((prev) => (prev - dt * 26) % 240);
      rafId = window.requestAnimationFrame(animate);
    };

    rafId = window.requestAnimationFrame(animate);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const selectByIndex = (nextIdx: number, focusTab = false) => {
    const wrapped = (nextIdx + KITCHEN_STATIONS.length) % KITCHEN_STATIONS.length;
    setActiveIndex(wrapped);
    onSelectStation?.(KITCHEN_STATIONS[wrapped].id);
    if (focusTab) {
      tabRefs.current[wrapped]?.focus();
    }
  };

  const handleTabKeyDown = (event: React.KeyboardEvent, idx: number) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      selectByIndex(idx + 1, true);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      selectByIndex(idx - 1, true);
    } else if (event.key === 'Home') {
      event.preventDefault();
      selectByIndex(0, true);
    } else if (event.key === 'End') {
      event.preventDefault();
      selectByIndex(KITCHEN_STATIONS.length - 1, true);
    }
  };

  const activeStation = KITCHEN_STATIONS[activeIndex] ?? KITCHEN_STATIONS[0];
  const nextStation = KITCHEN_STATIONS[(activeIndex + 1) % KITCHEN_STATIONS.length];

  // Gaze vector from central Tako Chef toward active station
  const dx = activeStation.cx - 340;
  const dy = activeStation.cy - 210;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const pupilOffsetX = (dx / dist) * 2.6;
  const pupilOffsetY = (dy / dist) * 2.2;

  return (
    <div
      className={clsx(
        'flex flex-col gap-4 rounded-[var(--tkv-radius-card)] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-4 sm:p-5 shadow-[var(--tkv-shadow-card)]',
        className,
      )}
    >
      {/* Synchronized Accessible Station Tab Pills */}
      <div
        role="tablist"
        aria-label="Chu trình 6 trạm vận hành bếp ấm Takolio"
        className="flex flex-wrap items-center gap-1.5"
      >
        {KITCHEN_STATIONS.map((station, idx) => {
          const isSelected = idx === activeIndex;
          return (
            <button
              key={station.id}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              id={`kitchen-loop-tab-${uid}-${station.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              aria-controls={`kitchen-loop-panel-${uid}`}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => selectByIndex(idx)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              className={clsx(
                'tkv-focusable tkv-tactile inline-flex min-h-[44px] min-w-[44px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold',
                isSelected
                  ? 'border-[var(--tkv-primary)] bg-[var(--tkv-primary)] text-white shadow-xs'
                  : 'border-[var(--tkv-border)] bg-[var(--tkv-surface-subtle)] text-[var(--tkv-ink-secondary)] hover:bg-[var(--tkv-surface)] hover:text-[var(--tkv-ink)]',
              )}
            >
              <span className="tabular-nums opacity-85">{station.step}</span>
              <span>{station.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {/* Pure Inline Orbital SVG Diagram (viewBox 0 0 680 420) */}
      <div className="w-full overflow-hidden rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)]">
        <svg
          viewBox="0 0 680 420"
          role="group"
          aria-label="Sơ đồ vòng lặp bếp gốm 6 bước Takolio"
          className="block h-auto w-full select-none"
        >
          <defs>
            <radialGradient id={`center-glow-${uid}`} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#FFF5EA" stopOpacity="0.95" />
              <stop offset="65%" stopColor="#FDF0EA" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#FCF9F5" stopOpacity="0" />
            </radialGradient>
            <linearGradient id={`orbit-grad-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4E7A5B" />
              <stop offset="50%" stopColor="#D86A43" />
              <stop offset="100%" stopColor="#C68634" />
            </linearGradient>
          </defs>

          {/* Soft ceramic ambient halo */}
          <circle cx="340" cy="210" r="185" fill={`url(#center-glow-${uid})`} />

          {/* Outer subtle decorative ceramic ring */}
          <ellipse
            cx="340"
            cy="210"
            rx="246"
            ry="160"
            fill="none"
            stroke="#EAE0D5"
            strokeWidth="1"
            strokeDasharray="3 7"
          />

          {/* Base orbital track */}
          <ellipse
            cx="340"
            cy="210"
            rx="228"
            ry="146"
            fill="none"
            stroke="#E5D7C8"
            strokeWidth="6"
          />

          {/* Animated flowing dashed orbital energy stream */}
          <ellipse
            cx="340"
            cy="210"
            rx="228"
            ry="146"
            fill="none"
            stroke={`url(#orbit-grad-${uid})`}
            strokeWidth="3.2"
            strokeDasharray="12 12"
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />

          {/* Spoke beam from Central Tako Medallion to Active & Next Station */}
          <line
            x1="340"
            y1="210"
            x2={activeStation.cx}
            y2={activeStation.cy}
            stroke={activeStation.accentHex}
            strokeWidth="2.5"
            strokeDasharray="5 5"
            strokeOpacity="0.7"
          />
          <line
            x1={activeStation.cx}
            y1={activeStation.cy}
            x2={nextStation.cx}
            y2={nextStation.cy}
            stroke={activeStation.accentHex}
            strokeWidth="3.5"
            strokeOpacity="0.35"
          />

          {/* Central Live Status Medallion with Tako Chef Emblem */}
          <g transform="translate(340, 210)">
            <circle cx="0" cy="3" r="68" fill="#5F524A" fillOpacity="0.07" />
            <circle
              cx="0"
              cy="0"
              r="66"
              fill="#FFFDF9"
              stroke={activeStation.accentHex}
              strokeWidth="2.5"
            />
            <circle
              cx="0"
              cy="0"
              r="58"
              fill="none"
              stroke="#EAE0D5"
              strokeWidth="1.2"
              strokeDasharray="4 4"
            />

            {/* Sculpted Tako Chef Emblem */}
            <g transform="translate(0, -8)">
              {/* Curled side tentacles */}
              <path
                d="M-22 14 C-32 16, -34 7, -25 5 C-19 4, -16 12, -10 15"
                fill="none"
                stroke="#E67F5C"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <path
                d="M22 14 C32 16, 34 7, 25 5 C19 4, 16 12, 10 15"
                fill="none"
                stroke="#E67F5C"
                strokeWidth="6"
                strokeLinecap="round"
              />
              <ellipse cx="0" cy="2" rx="22" ry="19" fill="#E67F5C" />
              <ellipse cx="-10" cy="6" rx="4" ry="2.5" fill="#F39A82" />
              <ellipse cx="10" cy="6" rx="4" ry="2.5" fill="#F39A82" />

              {/* Pointer/Station-tracking eyes */}
              <circle cx={-7 + pupilOffsetX} cy={pupilOffsetY} r="2.8" fill="#2C221E" />
              <circle cx={-6 + pupilOffsetX} cy={-1 + pupilOffsetY} r="1" fill="#FFFFFF" />
              <circle cx={7 + pupilOffsetX} cy={pupilOffsetY} r="2.8" fill="#2C221E" />
              <circle cx={8 + pupilOffsetX} cy={-1 + pupilOffsetY} r="1" fill="#FFFFFF" />

              <path
                d="M-4 6.5 Q0 10 4 6.5"
                fill="none"
                stroke="#2C221E"
                strokeWidth="1.6"
                strokeLinecap="round"
              />

              {/* Chef Toque */}
              <g transform="translate(0, -19)">
                <circle cx="-8" cy="-5" r="7" fill="#FFFDF9" stroke="#EAE0D5" strokeWidth="1.2" />
                <circle cx="8" cy="-5" r="7" fill="#FFFDF9" stroke="#EAE0D5" strokeWidth="1.2" />
                <circle cx="0" cy="-8" r="8.5" fill="#FFFDF9" stroke="#EAE0D5" strokeWidth="1.2" />
                <rect x="-12" y="-1" width="24" height="6.5" rx="2.5" fill="#FFFDF9" stroke="#EAE0D5" strokeWidth="1.2" />
                <line x1="-11" y1="2.5" x2="11" y2="2.5" stroke="#4E7A5B" strokeWidth="1.8" />
              </g>
            </g>

            {/* Live step readout inside medallion */}
            <text
              x="0"
              y="32"
              textAnchor="middle"
              fill="#2C221E"
              fontSize="11.5"
              fontWeight="700"
            >
              Trạm {activeStation.step} / 06
            </text>
            <text
              x="0"
              y="47"
              textAnchor="middle"
              fill="#5F524A"
              fontSize="10"
              fontWeight="600"
            >
              {activeStation.shortLabel}
            </text>
          </g>

          {/* 6 Interactive Station Nodes around the Ellipse */}
          {KITCHEN_STATIONS.map((station, idx) => {
            const isSelected = idx === activeIndex;
            return (
              <g
                key={station.id}
                transform={`translate(${station.cx}, ${station.cy})`}
                onClick={() => selectByIndex(idx)}
                className="cursor-pointer"
              >
                {isSelected && (
                  <rect
                    x="-78"
                    y="-31"
                    width="156"
                    height="62"
                    rx="31"
                    fill={station.accentHex}
                    fillOpacity="0.14"
                  />
                )}

                <rect
                  x="-72"
                  y="-25"
                  width="144"
                  height="50"
                  rx="25"
                  fill={isSelected ? '#FFFFFF' : station.surfaceHex}
                  stroke={isSelected ? station.accentHex : '#D5C3B3'}
                  strokeWidth={isSelected ? 2.6 : 1.4}
                />

                {/* Icon badge circle */}
                <circle
                  cx="-44"
                  cy="0"
                  r="17"
                  fill={isSelected ? station.accentHex : '#FFFFFF'}
                  stroke={isSelected ? station.accentHex : '#EAE0D5'}
                  strokeWidth="1.2"
                />
                <g transform="translate(-44, 0)">
                  {renderStationGlyph(
                    station.id,
                    isSelected ? '#FFFFFF' : station.accentHex,
                  )}
                </g>

                {/* Step number & Vietnamese title */}
                <text
                  x="-19"
                  y="-4"
                  fill={station.accentHex}
                  fontSize="10"
                  fontWeight="700"
                >
                  BƯỚC {station.step}
                </text>
                <text
                  x="-19"
                  y="11"
                  fill="#2C221E"
                  fontSize="12.5"
                  fontWeight="700"
                >
                  {station.shortLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Live Station Readout & Takolio Guarantee Card */}
      <div
        id={`kitchen-loop-panel-${uid}`}
        role="tabpanel"
        aria-labelledby={`kitchen-loop-tab-${uid}-${activeStation.id}`}
        className="flex flex-col justify-between gap-3 rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-surface-subtle)] p-4 sm:flex-row sm:items-center"
      >
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
              style={{ backgroundColor: activeStation.accentHex }}
            >
              {activeStation.label}
            </span>
            <span className="text-xs font-semibold text-[var(--tkv-ink-secondary)]">
              Tiếp theo → {nextStation.label}
            </span>
          </div>
          <p className="text-sm font-semibold text-[var(--tkv-ink)]">
            {activeStation.summary}
          </p>
          <p className="text-xs text-[var(--tkv-ink-secondary)]">
            {activeStation.guarantee}
          </p>
        </div>

        {onNavigate && (
          <button
            type="button"
            onClick={() => onNavigate(activeStation.href)}
            className="tkv-focusable tkv-tactile inline-flex min-h-[42px] shrink-0 items-center justify-center gap-1.5 rounded-[var(--tkv-radius-btn)] bg-[var(--tkv-primary)] px-4 py-2 text-xs font-semibold text-white shadow-[var(--tkv-shadow-cta)] hover:bg-[var(--tkv-primary-cta-hover)]"
          >
            <span>{activeStation.ctaLabel}</span>
            <span aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default InteractiveKitchenLoopSvg;
