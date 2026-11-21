import React, { useEffect, useId, useRef, useState } from 'react';
import { clsx } from 'clsx';

export type TakoChefMood = 'happy' | 'curious' | 'cooking' | 'celebrate';

export interface InteractiveTakoChefSvgProps {
  size?: number;
  mood?: TakoChefMood;
  defaultShowTip?: boolean;
  onWave?: (tip: string) => void;
  className?: string;
}

const CULINARY_TIPS_VI: string[] = [
  'Mẹo bếp Tako: Chần đậu phụ non qua nước muối ấm 60 giây giúp miếng đậu dẻo mịn và không vỡ khi đảo sốt cà chua!',
  'Mẹo bếp Tako: Lót một lớp khăn giấy khô dưới hộp rau thơm trong ngăn mát giúp hành ngò tươi giòn gấp đôi thời gian!',
  'Mẹo bếp Tako: Phi hành tím trên lửa vừa rồi tắt bếp sớm 5 giây để giữ trọn màu vàng óng và hương thơm ngọt dịu!',
  'Mẹo bếp Tako: Nêm nước mắm nhĩ ngon ở phút cuối trước khi bắc nồi giúp món canh giữ trọn vị thanh và mùi thơm đặc trưng!',
];

export const InteractiveTakoChefSvg: React.FC<InteractiveTakoChefSvgProps> = ({
  size = 148,
  mood = 'happy',
  defaultShowTip = false,
  onWave,
  className,
}) => {
  const uid = useId().replace(/:/g, '');
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [pupilOffset, setPupilOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState<boolean>(false);
  const [bobPhase, setBobPhase] = useState<number>(0);
  const [isWaving, setIsWaving] = useState<boolean>(false);
  const [tipIndex, setTipIndex] = useState<number>(0);
  const [showTipBubble, setShowTipBubble] = useState<boolean>(defaultShowTip);

  // Natural eye blink every ~4.1s (respects prefers-reduced-motion)
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let reduced = false;
    try {
      reduced = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    } catch {
      reduced = false;
    }
    if (reduced) return undefined;

    let blinkTimeout: ReturnType<typeof setTimeout> | null = null;
    const interval = setInterval(() => {
      setIsBlinking(true);
      blinkTimeout = setTimeout(() => {
        setIsBlinking(false);
      }, 150);
    }, 4100);

    return () => {
      clearInterval(interval);
      if (blinkTimeout) clearTimeout(blinkTimeout);
    };
  }, []);

  // Soft harmonic bobbing on toque & sage leaf (respects prefers-reduced-motion)
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
    let start = typeof performance !== 'undefined' ? performance.now() : 0;

    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      setBobPhase(elapsed);
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
    };
  }, []);

  // Reset wave flag smoothly after cheerful gesture
  useEffect(() => {
    if (!isWaving) return undefined;
    const timer = setTimeout(() => {
      setIsWaving(false);
    }, 900);
    return () => clearTimeout(timer);
  }, [isWaving]);

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const el = wrapperRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const nx = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    const clampedX = Math.max(-1, Math.min(1, nx));
    const clampedY = Math.max(-1, Math.min(1, ny));

    setPupilOffset({
      x: clampedX * 3.4,
      y: clampedY * 2.6,
    });
  };

  const handlePointerLeave = () => {
    setPupilOffset({ x: 0, y: 0 });
  };

  const triggerTakoWave = () => {
    const nextIdx = showTipBubble ? (tipIndex + 1) % CULINARY_TIPS_VI.length : tipIndex;
    setTipIndex(nextIdx);
    setShowTipBubble(true);
    setIsWaving(true);
    onWave?.(CULINARY_TIPS_VI[nextIdx]);
  };

  const toqueBobY = Math.sin(bobPhase * 2.1) * 2.2;
  const toqueTilt =
    (mood === 'curious' ? 7 : 3) + Math.cos(bobPhase * 1.6) * 1.8 + (isWaving ? -5 : 0);
  const waveLiftAngle = isWaving ? -24 + Math.sin(bobPhase * 18) * 12 : Math.sin(bobPhase * 2.4) * 3;
  const currentTip = CULINARY_TIPS_VI[tipIndex];

  return (
    <div
      ref={wrapperRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      className={clsx('inline-flex flex-col items-center gap-2.5', className)}
    >
      <button
        type="button"
        onClick={triggerTakoWave}
        aria-label="Chạm vào đầu bếp bạch tuộc Tako để xem mẹo bếp hôm nay"
        aria-expanded={showTipBubble}
        className="tkv-focusable tkv-tactile group relative inline-flex items-center justify-center rounded-full p-1 hover:scale-[1.02] active:scale-[0.98]"
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 200 200"
          role="img"
          aria-label={`Đầu bếp bạch tuộc Tako trạng thái ${mood}`}
          className="block h-full w-full select-none overflow-visible"
        >
          <defs>
            <radialGradient id={`tako-body-${uid}`} cx="0.4" cy="0.32" r="0.68">
              <stop offset="0%" stopColor="#F29576" />
              <stop offset="60%" stopColor="#E67F5C" />
              <stop offset="100%" stopColor="#D86A43" />
            </radialGradient>
            <radialGradient id={`ceramic-halo-${uid}`} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0%" stopColor="#FFF6EE" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#FCF9F5" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Soft sunlit ceramic backdrop */}
          <circle cx="100" cy="106" r="88" fill={`url(#ceramic-halo-${uid})`} />
          <ellipse cx="100" cy="176" rx="58" ry="11" fill="#5F524A" fillOpacity="0.11" />

          {/* Back Layer Curled Tentacles */}
          <g stroke="#D86A43" strokeWidth="14" strokeLinecap="round" fill="none">
            <path d="M62 140 C38 148, 30 166, 46 170 C58 172, 64 160, 74 154" />
            <path d="M138 140 C162 148, 170 166, 154 170 C142 172, 136 160, 126 154" />
          </g>

          {/* Left Waving Tentacle (cheers on click or celebrate/cooking mood!) */}
          <g transform={`rotate(${waveLiftAngle} 62 128)`}>
            <path
              d="M64 128 C34 126, 20 100, 34 86 C45 76, 54 92, 46 102"
              fill="none"
              stroke="#E67F5C"
              strokeWidth="15"
              strokeLinecap="round"
            />
            {mood === 'cooking' && (
              <g transform="translate(28, 76) rotate(-26)">
                <rect x="-3" y="-22" width="6" height="38" rx="3" fill="#C68634" />
                <ellipse cx="0" cy="-26" rx="9" ry="12" fill="#D8B384" stroke="#C68634" strokeWidth="1.5" />
              </g>
            )}
          </g>

          {/* Right Expressive Curled Tentacle */}
          <g transform={`rotate(${-waveLiftAngle * 0.45} 138 128)`}>
            <path
              d="M136 128 C166 128, 178 104, 164 90 C154 80, 145 94, 152 104"
              fill="none"
              stroke="#E67F5C"
              strokeWidth="15"
              strokeLinecap="round"
            />
          </g>

          {/* Front 4 Curled Ceramic Tentacles */}
          <g stroke="#E67F5C" strokeWidth="14" strokeLinecap="round" fill="none">
            <path d="M76 144 C64 166, 78 176, 88 164" />
            <path d="M96 146 C92 168, 108 168, 104 146" />
            <path d="M124 144 C136 166, 122 176, 112 164" />
          </g>

          {/* Tako Rounded Ceramic Mantle Head */}
          <ellipse cx="100" cy="112" rx="52" ry="46" fill={`url(#tako-body-${uid})`} />

          {/* Subtle Ceramic Specular Glaze Highlight */}
          <ellipse
            cx="80"
            cy="86"
            rx="16"
            ry="8"
            transform="rotate(-22 80 86)"
            fill="#FFFDF9"
            fillOpacity="0.34"
          />

          {/* Rosy Cheeks (#F39A82) */}
          <ellipse cx="68" cy="122" rx="10" ry="6" fill="#F39A82" />
          <ellipse cx="132" cy="122" rx="10" ry="6" fill="#F39A82" />

          {/* Pointer-Tracking Walnut-Espresso Eyes & Natural Blink */}
          {isBlinking ? (
            <g stroke="#2C221E" strokeWidth="3.4" strokeLinecap="round" fill="none">
              <path d="M73 110 Q81 115 89 110" />
              <path d="M111 110 Q119 115 127 110" />
            </g>
          ) : (
            <g>
              {/* Eye sockets */}
              <circle cx="81" cy="109" r="9" fill="#FFFDF9" />
              <circle cx="119" cy="109" r="9" fill="#FFFDF9" />

              {/* Pointer-tracking pupils */}
              <g transform={`translate(${pupilOffset.x.toFixed(2)}, ${pupilOffset.y.toFixed(2)})`}>
                <circle cx="81" cy="109" r="6.2" fill="#2C221E" />
                <circle cx="83.2" cy="106.5" r="2.2" fill="#FFFFFF" />

                <circle cx="119" cy="109" r="6.2" fill="#2C221E" />
                <circle cx="121.2" cy="106.5" r="2.2" fill="#FFFFFF" />
              </g>
            </g>
          )}

          {/* Mood-Specific Mouth Expression */}
          {mood === 'curious' ? (
            <circle cx="100" cy="124" r="4.5" fill="none" stroke="#2C221E" strokeWidth="2.8" />
          ) : mood === 'celebrate' || isWaving ? (
            <path
              d="M89 120 Q100 134 111 120 Z"
              fill="#9E4120"
              stroke="#2C221E"
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
          ) : (
            <path
              d="M90 121 Q100 130 110 121"
              fill="none"
              stroke="#2C221E"
              strokeWidth="3"
              strokeLinecap="round"
            />
          )}

          {/* Softly Bobbing Pleated Creamy-White Chef Toque & Botanical Sage Leaf */}
          <g transform={`translate(100, ${(64 + toqueBobY).toFixed(2)}) rotate(${toqueTilt.toFixed(2)})`}>
            <circle cx="-20" cy="-14" r="16" fill="#FFFDF9" stroke="#EAE0D5" strokeWidth="1.8" />
            <circle cx="20" cy="-14" r="16" fill="#FFFDF9" stroke="#EAE0D5" strokeWidth="1.8" />
            <circle cx="0" cy="-21" r="20" fill="#FFFDF9" stroke="#EAE0D5" strokeWidth="1.8" />
            <rect
              x="-28"
              y="-4"
              width="56"
              height="15"
              rx="6"
              fill="#FFFDF9"
              stroke="#EAE0D5"
              strokeWidth="1.8"
            />
            <line x1="-26" y1="4" x2="26" y2="4" stroke="#4E7A5B" strokeWidth="3.2" strokeLinecap="round" />

            {/* Botanical Sage Leaf Pin */}
            <g transform={`translate(24, -2) rotate(${Math.sin(bobPhase * 2.5) * 6})`}>
              <path
                d="M0 0 C8 -10, 20 -6, 15 4 C10 10, 2 6, 0 0 Z"
                fill="#4E7A5B"
              />
              <path d="M1 1 L12 -2" stroke="#EEF5F0" strokeWidth="1.2" strokeLinecap="round" />
            </g>
          </g>

          {/* Celebrate / Wave Sparkle Stars */}
          {(mood === 'celebrate' || isWaving) && (
            <g fill="#C68634">
              <path d="M34 52 L37 59 L44 62 L37 65 L34 72 L31 65 L24 62 L31 59 Z" />
              <path d="M166 48 L168.5 54 L174.5 56.5 L168.5 59 L166 65 L163.5 59 L157.5 56.5 L163.5 54 Z" />
            </g>
          )}
        </svg>
      </button>

      {/* Interactive Culinary Tip Bubble */}
      {showTipBubble && (
        <div
          role="status"
          aria-live="polite"
          className="max-w-xs rounded-2xl border border-[var(--tkv-border-coral)] bg-[var(--tkv-surface-coral)] px-3.5 py-2.5 text-center text-xs font-medium text-[var(--tkv-ink)] shadow-xs"
        >
          <p>{currentTip}</p>
          <button
            type="button"
            onClick={triggerTakoWave}
            className="tkv-focusable mt-1 inline-flex min-h-[44px] min-w-[44px] px-3 items-center justify-center gap-1 text-[11px] font-bold text-[var(--tkv-coral-ink)] underline-offset-2 hover:underline"
          >
            <span>Xem mẹo tiếp theo</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      )}
    </div>
  );
};

export {
  InteractiveSimmerWaveSvg,
  type InteractiveSimmerWaveSvgProps,
  type SimmerHeatLevel,
} from './InteractiveSimmerWaveSvg';

export default InteractiveTakoChefSvg;
