import React from 'react';
import clsx from 'clsx';

/**
 * Takolio V4 — Terra-Botanical Atelier Custom Culinary Icon System
 * ================================================================
 * 56 bespoke SVG React icon components crafted with:
 * - Precision 1.75px rounded architectural strokes
 * - Warm Terra-Botanical Atelier duotone washes (intensified when `active`)
 * - Semantic `tone` variants (`flame` | `jade` | `turmeric` | `ink` | `cream`)
 */

export type TakolioIconTone = 'flame' | 'jade' | 'turmeric' | 'ink' | 'cream';

export interface TakolioIconProps
  extends Omit<React.SVGProps<SVGSVGElement>, 'color'> {
  size?: number;
  tone?: TakolioIconTone;
  active?: boolean;
  className?: string;
  title?: string;
}

interface ResolvedTonePalette {
  stroke: string;
  fill: string;
  accent: string;
  fillOpacity: number;
  accentOpacity: number;
  active: boolean;
}

export function resolveIconTone(
  tone: TakolioIconTone = 'ink',
  active = false
): ResolvedTonePalette {
  switch (tone) {
    case 'flame':
      return {
        stroke: active ? '#C93D28' : '#E5533D',
        fill: '#E5533D',
        accent: '#F5B742',
        fillOpacity: active ? 0.3 : 0.16,
        accentOpacity: active ? 0.42 : 0.24,
        active,
      };
    case 'jade':
      return {
        stroke: active ? '#14553B' : '#1B6B4A',
        fill: '#2E7D5B',
        accent: '#E5533D',
        fillOpacity: active ? 0.28 : 0.15,
        accentOpacity: active ? 0.36 : 0.2,
        active,
      };
    case 'turmeric':
      return {
        stroke: active ? '#9A5E0A' : '#B87314',
        fill: '#F5B742',
        accent: '#E5533D',
        fillOpacity: active ? 0.34 : 0.2,
        accentOpacity: active ? 0.36 : 0.2,
        active,
      };
    case 'cream':
      return {
        stroke: '#FBF8F3',
        fill: '#FBF8F3',
        accent: '#FFD4BF',
        fillOpacity: active ? 0.32 : 0.18,
        accentOpacity: active ? 0.44 : 0.26,
        active,
      };
    case 'ink':
    default:
      return {
        stroke: active ? '#14553B' : '#1F2937',
        fill: active ? '#2E7D5B' : '#1B6B4A',
        accent: '#E5533D',
        fillOpacity: active ? 0.24 : 0.11,
        accentOpacity: active ? 0.32 : 0.16,
        active,
      };
  }
}

interface IconFrameProps extends Omit<TakolioIconProps, 'children'> {
  children: (palette: ResolvedTonePalette) => React.ReactNode;
  viewBox?: string;
  widthRatio?: number;
}

const IconFrame: React.FC<IconFrameProps> = ({
  size = 24,
  tone = 'ink',
  active = false,
  className,
  title,
  viewBox = '0 0 24 24',
  widthRatio = 1,
  children,
  ...rest
}) => {
  const palette = resolveIconTone(tone, active);
  const computedWidth = Math.round(size * widthRatio * 100) / 100;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={computedWidth}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke={palette.stroke}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      className={clsx('shrink-0 select-none', className)}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {children(palette)}
    </svg>
  );
};

// ============================================================================
// 1. BRAND MARKS (2)
// ============================================================================

/** Bespoke V4 Tako Chef dome + toque + botanical leaf mark */
export const TakolioLogoMark: React.FC<TakolioIconProps> = ({
  tone = 'flame',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        {/* Puffed Chef Toque */}
        <path
          d="M8.2 7.5C7.4 5.9 8.6 4.1 10.3 4.3C10.9 3.3 13.1 3.3 13.7 4.3C15.4 4.1 16.6 5.9 15.8 7.5Z"
          fill="#FBF8F3"
          stroke={p.stroke}
        />
        {/* Botanical Leaf Badge on Toque */}
        <path
          d="M12 5.2C13.2 4.8 14.1 5.6 13.7 6.8C12.5 7.1 11.7 6.3 12 5.2Z"
          fill="#1B6B4A"
          stroke="#1B6B4A"
          strokeWidth={1.2}
        />
        {/* Tako Head Dome */}
        <path
          d="M6.4 13.2C6.4 9.7 8.9 7.5 12 7.5C15.1 7.5 17.6 9.7 17.6 13.2C17.6 15.8 15.9 17.4 12 17.4C8.1 17.4 6.4 15.8 6.4 13.2Z"
          fill={p.fill}
          fillOpacity={Math.max(0.26, p.fillOpacity)}
        />
        {/* Curled Tentacles Silhouette */}
        <path d="M7.2 16.3C5.3 17.1 4.2 18.9 5.3 20.1C6.3 21.1 7.9 20.3 8.5 19" />
        <path d="M16.8 16.3C18.7 17.1 19.8 18.9 18.7 20.1C17.7 21.1 16.1 20.3 15.5 19" />
        <path d="M10.1 17.3C9.8 19.1 8.9 20.6 10.3 20.9" />
        <path d="M13.9 17.3C14.2 19.1 15.1 20.6 13.7 20.9" />
        {/* Glossy Eyes & Warm Smile */}
        <circle cx="9.8" cy="12.6" r="0.95" fill={p.stroke} stroke="none" />
        <circle cx="14.2" cy="12.6" r="0.95" fill={p.stroke} stroke="none" />
        <path d="M10.7 14.6C11.3 15.3 12.7 15.3 13.3 14.6" />
      </>
    )}
  </IconFrame>
);

/** Horizontal Takolio V4 Brand Lockup (Mascot Symbol + Custom Wordmark + Botanical Dot) */
export const TakolioWordmarkLockup: React.FC<TakolioIconProps> = ({
  size = 32,
  tone = 'ink',
  ...props
}) => (
  <IconFrame
    size={size}
    tone={tone}
    viewBox="0 0 156 36"
    widthRatio={156 / 36}
    {...props}
  >
    {(p) => {
      const textFill = tone === 'cream' ? '#FBF8F3' : '#1F2937';
      return (
        <>
          {/* Atelier Badge Container */}
          <rect
            x="2"
            y="2"
            width="32"
            height="32"
            rx="10"
            fill="#E5533D"
            fillOpacity={0.14}
            stroke="#E5533D"
            strokeWidth={1.6}
          />
          {/* Mini Tako Chef Inside Lockup */}
          <path
            d="M12.5 11.2C11.6 9.2 13.2 7 15.4 7.3C16.3 5.9 19.7 5.9 20.6 7.3C22.8 7 24.4 9.2 23.5 11.2Z"
            fill="#FBF8F3"
            stroke="#E5533D"
            strokeWidth={1.5}
          />
          <ellipse
            cx="18"
            cy="18.8"
            rx="7.4"
            ry="6.8"
            fill="#E5533D"
            fillOpacity={0.28}
            stroke="#E5533D"
            strokeWidth={1.65}
          />
          <circle cx="15.3" cy="18.2" r="1.2" fill={textFill} stroke="none" />
          <circle cx="20.7" cy="18.2" r="1.2" fill={textFill} stroke="none" />
          <path
            d="M16.2 21C17.1 22 18.9 22 19.8 21"
            stroke="#E5533D"
            strokeWidth={1.6}
          />
          <path
            d="M11.6 23.8C9.4 25 8.8 27.6 10.6 28.4M24.4 23.8C26.6 25 27.2 27.6 25.4 28.4"
            stroke="#E5533D"
            strokeWidth={1.6}
          />
          {/* Geometric Editorial Wordmark: "Takolio" */}
          <text
            x="43"
            y="24.8"
            fill={textFill}
            stroke="none"
            fontFamily="system-ui, -apple-system, 'Plus Jakarta Sans', sans-serif"
            fontSize="21"
            fontWeight="800"
            letterSpacing="-0.03em"
          >
            Takolio
          </text>
          {/* Terra-Botanical Leaf Accent */}
          <path
            d="M122 10.5C126.2 8.2 130.5 10.6 129.2 15C125 16.8 121.2 14.5 122 10.5Z"
            fill="#1B6B4A"
            fillOpacity={p.active ? 0.95 : 0.85}
            stroke="#1B6B4A"
            strokeWidth={1.2}
          />
        </>
      );
    }}
  </IconFrame>
);

// ============================================================================
// 2. NAVIGATION — 6 PILLARS + SCAN APERTURE (7)
// ============================================================================

export const NavHomeIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <path
          d="M4 10.8L12 4L20 10.8V19.2C20 20.1 19.3 20.8 18.4 20.8H5.6C4.7 20.8 4 20.1 4 19.2V10.8Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        {/* Warm Hearth Archway + Chimney Steam */}
        <path d="M9.5 20.8V15.2C9.5 13.8 10.6 12.7 12 12.7C13.4 12.7 14.5 13.8 14.5 15.2V20.8" />
        <path d="M16.5 4.2C16.5 3.1 17.7 2.8 17.7 1.8" strokeOpacity={0.75} />
      </>
    )}
  </IconFrame>
);

export const NavFridgeIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <rect
          x="5.5"
          y="3"
          width="13"
          height="18"
          rx="2.6"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <line x1="5.5" y1="10.4" x2="18.5" y2="10.4" />
        <line x1="8.3" y1="6.2" x2="8.3" y2="8.4" />
        <line x1="8.3" y1="12.6" x2="8.3" y2="15.8" />
        <circle cx="15.2" cy="6.8" r="1.1" fill={p.accent} fillOpacity={p.accentOpacity} stroke="none" />
      </>
    )}
  </IconFrame>
);

export const NavRecipesIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        {/* Culinary Atelier Cloche / Simmering Bowl + Botanical Leaf */}
        <path
          d="M4.5 14H19.5C19.5 17.8 16.3 20.5 12 20.5C7.7 20.5 4.5 17.8 4.5 14Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <path d="M3.5 14H20.5" />
        <path d="M9.2 6.8C9.2 5.4 10.4 4.8 10.4 3.4" />
        <path d="M14.8 6.8C14.8 5.4 16 4.8 16 3.4" />
        <path
          d="M12 10.8C12 8.6 13.8 7.4 15.8 7.8C15.6 9.8 14.1 11.1 12 10.8Z"
          fill={p.accent}
          fillOpacity={p.accentOpacity}
        />
      </>
    )}
  </IconFrame>
);

export const NavPlannerIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <rect
          x="3.5"
          y="4.8"
          width="17"
          height="15.7"
          rx="2.6"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <line x1="3.5" y1="9.4" x2="20.5" y2="9.4" />
        <line x1="8" y1="3" x2="8" y2="6.4" />
        <line x1="16" y1="3" x2="16" y2="6.4" />
        <circle cx="8.4" cy="13.2" r="1" fill={p.stroke} stroke="none" />
        <circle cx="12" cy="13.2" r="1" fill={p.accent} stroke="none" />
        <path d="M10.8 17L12.1 18.2L15.4 15" />
      </>
    )}
  </IconFrame>
);

export const NavShoppingIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <path
          d="M5.2 9.5H18.8L17.4 19.2C17.2 20.1 16.4 20.8 15.5 20.8H8.5C7.6 20.8 6.8 20.1 6.6 19.2L5.2 9.5Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <path d="M8.6 9.5L10.8 4.2" />
        <path d="M15.4 9.5L13.2 4.2" />
        <path d="M3.8 9.5H20.2" />
        {/* Baguette / Fresh Leaf Peeking Out */}
        <path d="M13.5 9.5C14.2 7.2 16.3 6.2 18.2 6.8" />
        <line x1="10" y1="13.5" x2="10" y2="17" />
        <line x1="14" y1="13.5" x2="14" y2="17" />
      </>
    )}
  </IconFrame>
);

export const NavProfileIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <circle
          cx="12"
          cy="9.2"
          r="3.6"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        {/* Subtle Chef Collar Shoulders */}
        <path
          d="M5.2 20.2C5.8 16.7 8.5 14.8 12 14.8C15.5 14.8 18.2 16.7 18.8 20.2"
          fill={p.fill}
          fillOpacity={p.fillOpacity * 0.7}
        />
        <path d="M9.6 4.8C10.5 3.4 13.5 3.4 14.4 4.8" />
      </>
    )}
  </IconFrame>
);

export const NavScanApertureIcon: React.FC<TakolioIconProps> = ({
  tone = 'flame',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        <path d="M4 8V5.8C4 4.8 4.8 4 5.8 4H8" />
        <path d="M16 4H18.2C19.2 4 20 4.8 20 5.8V8" />
        <path d="M20 16V18.2C20 19.2 19.2 20 18.2 20H16" />
        <path d="M8 20H5.8C4.8 20 4 19.2 4 18.2V16" />
        <circle
          cx="12"
          cy="12"
          r="4.4"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <path d="M12 9.4L12.7 11.3L14.6 12L12.7 12.7L12 14.6L11.3 12.7L9.4 12L11.3 11.3Z" />
      </>
    )}
  </IconFrame>
);

// ============================================================================
// 3. CULINARY & COOKING STUDIO (18)
// ============================================================================

export const WokFlameIcon: React.FC<TakolioIconProps> = ({
  tone = 'flame',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        <path
          d="M4.5 10.5H17.5C17 14.6 14.2 16.8 11 16.8C7.8 16.8 5 14.6 4.5 10.5Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <path d="M17.5 10.5L21.2 8.4" />
        <path d="M3.2 10.5H4.5" />
        {/* Burner Flames Underneath */}
        <path
          d="M8.2 20.5C7.9 19 8.8 18 9.4 17.5M11 20.8C11 19.1 11.8 18 12.2 17.3M13.8 20.5C14.1 19 13.2 18 12.6 17.5"
          stroke={p.accent}
        />
        <path d="M9.5 7.4C9.5 6 10.6 5.5 10.6 4.2" />
      </>
    )}
  </IconFrame>
);

export const ClaypotBraiseIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <path
          d="M5.5 11.2H18.5L17.6 17.8C17.4 19.3 16 20.4 14.4 20.4H9.6C8 20.4 6.6 19.3 6.4 17.8L5.5 11.2Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        {/* Domed Bát Tràng Lid + Ear Handles */}
        <path d="M5.2 11.2C6.4 8.2 9 6.8 12 6.8C15 6.8 17.6 8.2 18.8 11.2Z" />
        <path d="M10.8 6.8C10.8 5.6 11.3 4.8 12 4.8C12.7 4.8 13.2 5.6 13.2 6.8" />
        <path d="M3.4 12.4H5.6M18.4 12.4H20.6" />
      </>
    )}
  </IconFrame>
);

export const StockpotSoupIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <rect
          x="5.8"
          y="9.5"
          width="12.4"
          height="10.8"
          rx="2.2"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <path d="M3.6 11.5H5.8M18.2 11.5H20.4" />
        <path d="M5.2 9.5H18.8" />
        {/* Simmering Broth Wave */}
        <path d="M8.2 14.5C9.4 13.6 10.6 15.4 12 14.5C13.4 13.6 14.6 15.4 15.8 14.5" />
        <path d="M9.5 6.8C9.5 5.4 10.5 4.8 10.5 3.5M14.2 6.8C14.2 5.4 15.2 4.8 15.2 3.5" />
      </>
    )}
  </IconFrame>
);

export const BambooSteamerIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <rect
          x="4.8"
          y="10.5"
          width="14.4"
          height="4.4"
          rx="1.2"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <rect
          x="4.8"
          y="14.9"
          width="14.4"
          height="4.4"
          rx="1.2"
          fill={p.fill}
          fillOpacity={p.fillOpacity * 1.25}
        />
        <path d="M5.2 10.5C6.8 7.8 9.2 6.6 12 6.6C14.8 6.6 17.2 7.8 18.8 10.5" />
        <path d="M10.5 6.6C11 5.4 13 5.4 13.5 6.6" />
        <path d="M8.2 4.4C8.2 3.4 9 3 9 2.2M15.6 4.4C15.6 3.4 16.4 3 16.4 2.2" />
      </>
    )}
  </IconFrame>
);

export const ChefKnifeBoardIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        {/* Wooden Cutting Board */}
        <rect
          x="3.5"
          y="8.5"
          width="17"
          height="11.5"
          rx="2.2"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <circle cx="17.5" cy="11.2" r="0.9" />
        {/* Diagonal Santoku Knife */}
        <path
          d="M6.2 14.8L13.8 5.2C15.1 6.2 15.9 7.8 15.4 9.5L9.8 16.2Z"
          fill="#FFFFFF"
          fillOpacity={0.55}
        />
        <path d="M13.8 5.2L16.6 2.8" strokeWidth={2.1} />
      </>
    )}
  </IconFrame>
);

export const MarinateBowlIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <path
          d="M4.2 12.5H19.8C19.2 17.2 16 20.2 12 20.2C8 20.2 4.8 17.2 4.2 12.5Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        {/* Seasoning Droplets & Herb */}
        <path d="M9.2 6.2C9.2 6.2 7.8 8.1 7.8 9.1C7.8 9.9 8.4 10.5 9.2 10.5C10 10.5 10.6 9.9 10.6 9.1C10.6 8.1 9.2 6.2 9.2 6.2Z" />
        <path
          d="M13.6 9.6C13.8 7.3 15.7 5.8 17.8 6.2C17.6 8.3 15.9 9.8 13.6 9.6Z"
          fill={p.accent}
          fillOpacity={p.accentOpacity}
        />
      </>
    )}
  </IconFrame>
);

export const PlatingSparkleIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <ellipse
          cx="12"
          cy="15.5"
          rx="8.5"
          ry="4.2"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <ellipse cx="12" cy="15.5" rx="5.2" ry="2.2" />
        <path
          d="M12 3.5L12.9 6.1L15.5 7L12.9 7.9L12 10.5L11.1 7.9L8.5 7L11.1 6.1Z"
          fill={p.accent}
          fillOpacity={p.accentOpacity}
        />
        <path d="M18.2 5.2V7.6M17 6.4H19.4" />
      </>
    )}
  </IconFrame>
);

export const FlameLowIcon: React.FC<TakolioIconProps> = ({
  tone = 'jade',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        <path
          d="M12 8.5C12 8.5 8.2 12.2 8.2 15.4C8.2 17.6 9.9 19.4 12 19.4C14.1 19.4 15.8 17.6 15.8 15.4C15.8 12.2 12 8.5 12 8.5Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <line x1="6" y1="21" x2="18" y2="21" />
      </>
    )}
  </IconFrame>
);

export const FlameMediumIcon: React.FC<TakolioIconProps> = ({
  tone = 'turmeric',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        <path
          d="M12 5.2C12 5.2 6.8 10.1 6.8 14.5C6.8 17.5 9.1 19.6 12 19.6C14.9 19.6 17.2 17.5 17.2 14.5C17.2 12.4 16 10.4 14.7 9C14.5 10.6 13.6 11.4 12.8 11.8C13.2 9.2 12 5.2 12 5.2Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <line x1="5.5" y1="21.2" x2="18.5" y2="21.2" />
      </>
    )}
  </IconFrame>
);

export const FlameHighIcon: React.FC<TakolioIconProps> = ({
  tone = 'flame',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        <path
          d="M12.4 2.8C12.4 2.8 5.5 8.4 5.5 14.2C5.5 17.9 8.4 20.5 12 20.5C15.6 20.5 18.5 17.9 18.5 14.2C18.5 11.2 16.9 8.6 15.3 6.9C15.2 9.1 14 10.3 13.1 10.8C14 7.4 12.4 2.8 12.4 2.8Z"
          fill={p.fill}
          fillOpacity={Math.max(0.28, p.fillOpacity)}
        />
        <path
          d="M12 12.5C12 12.5 9.8 14.6 9.8 16.5C9.8 17.8 10.8 18.8 12 18.8C13.2 18.8 14.2 17.8 14.2 16.5C14.2 14.6 12 12.5 12 12.5Z"
          fill={p.accent}
          fillOpacity={p.accentOpacity}
        />
      </>
    )}
  </IconFrame>
);

export const MultiTimerIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <circle
          cx="11.5"
          cy="13"
          r="7.2"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <line x1="9.5" y1="3.2" x2="13.5" y2="3.2" />
        <line x1="11.5" y1="3.2" x2="11.5" y2="5.8" />
        <path d="M11.5 9.4V13L14.2 14.6" />
        {/* Secondary stacked timer arc */}
        <path d="M17.2 6.8C19.4 8.2 20.8 10.6 20.8 13.4C20.8 15.2 20.2 16.8 19.2 18.1" />
      </>
    )}
  </IconFrame>
);

export const WakeLockSunIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <circle
          cx="12"
          cy="12"
          r="4.2"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <path d="M12 3.2V5.4M12 18.6V20.8M3.2 12H5.4M18.6 12H20.8" />
        <path d="M5.8 5.8L7.4 7.4M16.6 16.6L18.2 18.2M18.2 5.8L16.6 7.4M7.4 16.6L5.8 18.2" />
      </>
    )}
  </IconFrame>
);

export const VoiceWaveTakoIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <rect
          x="3.2"
          y="4.5"
          width="17.6"
          height="15"
          rx="7.5"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <line x1="7.5" y1="10.2" x2="7.5" y2="13.8" />
        <line x1="10.5" y1="8" x2="10.5" y2="16" />
        <line x1="13.5" y1="9.2" x2="13.5" y2="14.8" />
        <line x1="16.5" y1="10.6" x2="16.5" y2="13.4" />
      </>
    )}
  </IconFrame>
);

export const AiSousChefSparkIcon: React.FC<TakolioIconProps> = ({
  tone = 'jade',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        {/* Chef Toque Silhouette + Four-Point AI Star */}
        <path
          d="M6.2 11.8C4.4 11.2 3.8 8.8 5.2 7.4C6.1 6.5 7.4 6.6 8.2 7.1C9.2 5.1 12.8 5.1 13.8 7.1C14.6 6.6 15.9 6.5 16.8 7.4C18.2 8.8 17.6 11.2 15.8 11.8V16.8H6.2V11.8Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <line x1="6.2" y1="14.4" x2="15.8" y2="14.4" />
        <path
          d="M18.2 13.2L19 15.4L21.2 16.2L19 17L18.2 19.2L17.4 17L15.2 16.2L17.4 15.4Z"
          fill={p.accent}
          fillOpacity={p.accentOpacity}
        />
      </>
    )}
  </IconFrame>
);

export const PortionScaleIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <path d="M5.5 7.2H18.5L16.5 11.2H7.5L5.5 7.2Z" fill={p.fill} fillOpacity={p.fillOpacity} />
        <rect
          x="5.8"
          y="13.2"
          width="12.4"
          height="7.2"
          rx="2"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <line x1="12" y1="11.2" x2="12" y2="13.2" />
        <circle cx="12" cy="16.8" r="1.8" />
        <path d="M12 16.8L13.2 15.6" />
      </>
    )}
  </IconFrame>
);

export const IngredientSwapIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <circle cx="7.5" cy="8" r="3.2" fill={p.fill} fillOpacity={p.fillOpacity} />
        <circle cx="16.5" cy="16" r="3.2" fill={p.accent} fillOpacity={p.accentOpacity} />
        <path d="M13 6.5H18.5V12" />
        <path d="M18.5 6.5L14.2 10.8" />
        <path d="M11 17.5H5.5V12" />
        <path d="M5.5 17.5L9.8 13.2" />
      </>
    )}
  </IconFrame>
);

export const LeftoverBoxIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <rect
          x="4"
          y="9.5"
          width="16"
          height="9.5"
          rx="2.4"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <rect x="3.2" y="6.8" width="17.6" height="2.7" rx="1.2" />
        <path d="M9.6 14.2C10.5 12.6 13.5 12.6 14.4 14.2" />
        <path d="M13.2 12.6L14.6 14.3L12.8 15" />
      </>
    )}
  </IconFrame>
);

export const SensoryAromaIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <path d="M7.5 19.5C6.2 17 7.8 14.5 7.8 12C7.8 9.6 6.4 7.5 7.6 5" />
        <path d="M12 20.2C10.7 17.4 12.4 14.5 12.4 11.6C12.4 8.8 10.9 6.5 12.2 3.8" />
        <path d="M16.5 19.5C15.2 17 16.8 14.5 16.8 12C16.8 9.6 15.4 7.5 16.6 5" />
        <circle cx="17.8" cy="7.5" r="1.8" fill={p.accent} fillOpacity={p.accentOpacity} stroke="none" />
      </>
    )}
  </IconFrame>
);

// ============================================================================
// 4. FOOD CATEGORIES & FRIDGE ZONES (13)
// ============================================================================

export const CatVegetableIcon: React.FC<TakolioIconProps> = ({
  tone = 'jade',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        {/* Sculpted Bok Choy / Leafy Greens */}
        <path
          d="M12 20.5C9.2 20.5 7.5 18.2 7.8 14.8C6.2 12.8 6.4 9.2 8.8 7.5C9.6 5.4 11.4 4.2 12 4.2C12.6 4.2 14.4 5.4 15.2 7.5C17.6 9.2 17.8 12.8 16.2 14.8C16.5 18.2 14.8 20.5 12 20.5Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <path d="M12 8.5V20.2" />
        <path d="M9.8 12.5L12 15.2L14.2 12.5" />
      </>
    )}
  </IconFrame>
);

export const CatMeatIcon: React.FC<TakolioIconProps> = ({
  tone = 'flame',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        <path
          d="M6.2 8.4C8.4 5 14.2 4.6 17.4 7.8C20.2 10.6 19.4 15.6 15.8 18C12.2 20.4 6.8 19.6 5.2 16C3.9 13.1 4.5 10.9 6.2 8.4Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <circle cx="14.2" cy="10.4" r="2.1" fill="#FBF8F3" />
        <path d="M8.2 13.6C9.8 13.2 11.2 14.4 12.2 16.4" />
      </>
    )}
  </IconFrame>
);

export const CatSeafoodIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <path
          d="M3.5 12C6.2 7.8 11.6 7.2 16.2 10.4L20.5 7.8V16.2L16.2 13.6C11.6 16.8 6.2 16.2 3.5 12Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <circle cx="7.8" cy="11.4" r="0.9" fill={p.stroke} stroke="none" />
        <path d="M10.8 9.6C11.8 11.2 11.8 12.8 10.8 14.4" />
      </>
    )}
  </IconFrame>
);

export const CatDairyEggIcon: React.FC<TakolioIconProps> = ({
  tone = 'turmeric',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        {/* Milk Carafe + Farm Egg */}
        <path
          d="M5.5 9.2L7 6.2V4H11.5V6.2L13 9.2V19.5H5.5V9.2Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity * 0.7}
        />
        <path
          d="M15.8 11.2C13.8 11.2 12.4 13.8 12.4 16.2C12.4 18.5 13.9 20 15.8 20C17.7 20 19.2 18.5 19.2 16.2C19.2 13.8 17.8 11.2 15.8 11.2Z"
          fill={p.fill}
          fillOpacity={Math.max(0.26, p.fillOpacity)}
        />
      </>
    )}
  </IconFrame>
);

export const CatFruitIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <path
          d="M12 7.8C9.2 6.8 5.8 8.6 5.8 12.6C5.8 16.8 8.8 20.2 12 19.6C15.2 20.2 18.2 16.8 18.2 12.6C18.2 8.6 14.8 6.8 12 7.8Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <path d="M12 7.8C12 5.6 13.2 4.2 14.8 3.8" />
        <path d="M12 6.4C10.2 5 8.8 5.4 8.4 6.8" />
      </>
    )}
  </IconFrame>
);

export const CatGrainDryIcon: React.FC<TakolioIconProps> = ({
  tone = 'turmeric',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        {/* Jasmine Rice Stalk & Woven Bowl */}
        <path
          d="M5.5 14.8H18.5C18 18.2 15.4 20.4 12 20.4C8.6 20.4 6 18.2 5.5 14.8Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <path d="M12 3.8V14.8" />
        <path d="M12 6.5L9.2 5M12 9.2L9.2 7.7M12 6.5L14.8 5M12 9.2L14.8 7.7" />
      </>
    )}
  </IconFrame>
);

export const CatSpiceSauceIcon: React.FC<TakolioIconProps> = ({
  tone = 'flame',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        {/* Nước Mắm Cruet + Curved Red Chili */}
        <path
          d="M6 11.2L7.8 8.2V4.5H11.2V8.2L13 11.2V19.8H6V11.2Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <path
          d="M15.2 9.5C17.8 10.2 19.5 13.4 18.2 17.5C17.4 19.6 15.2 20.4 14.2 19.8C15.8 17.8 16.2 14.5 14.6 11.5Z"
          fill={p.accent}
          fillOpacity={p.accentOpacity}
        />
        <path d="M14.8 9.6L16.2 7.6" />
      </>
    )}
  </IconFrame>
);

export const CatOtherIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <rect
          x="5.2"
          y="7.8"
          width="13.6"
          height="12.4"
          rx="2.6"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <rect x="7.2" y="4.5" width="9.6" height="3.3" rx="1.2" />
        <line x1="9.2" y1="13.8" x2="14.8" y2="13.8" />
      </>
    )}
  </IconFrame>
);

export const ZoneCoolIcon: React.FC<TakolioIconProps> = ({
  tone = 'jade',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        <rect
          x="4.2"
          y="4.2"
          width="15.6"
          height="15.6"
          rx="3.4"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <path d="M8 14.5C8 11.2 11 8.5 15.2 8.5C15.2 12.6 12.4 15.6 8 14.5Z" />
        <path d="M7.5 16.2L12.5 11.2" />
      </>
    )}
  </IconFrame>
);

export const ZoneFreezeIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <circle cx="12" cy="12" r="8.2" fill={p.fill} fillOpacity={p.fillOpacity} />
        <line x1="12" y1="5.2" x2="12" y2="18.8" />
        <line x1="6.1" y1="8.6" x2="17.9" y2="15.4" />
        <line x1="17.9" y1="8.6" x2="6.1" y2="15.4" />
      </>
    )}
  </IconFrame>
);

export const ZonePantryIcon: React.FC<TakolioIconProps> = ({
  tone = 'turmeric',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        <rect
          x="4.5"
          y="5"
          width="15"
          height="14.5"
          rx="2.4"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <line x1="4.5" y1="12" x2="19.5" y2="12" />
        <rect x="7.5" y="7.5" width="3.4" height="4.5" rx="0.8" />
        <rect x="13" y="8.2" width="3.4" height="3.8" rx="0.8" />
        <line x1="9.8" y1="15.4" x2="14.2" y2="15.4" />
      </>
    )}
  </IconFrame>
);

export const FreshnessShieldIcon: React.FC<TakolioIconProps> = ({
  tone = 'jade',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        <path
          d="M12 3.5L19 6.4V11.8C19 16.2 16 19.5 12 20.8C8 19.5 5 16.2 5 11.8V6.4L12 3.5Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <path d="M9 12.2L11.1 14.3L15.2 9.8" />
      </>
    )}
  </IconFrame>
);

export const ExpiryRescueBellIcon: React.FC<TakolioIconProps> = ({
  tone = 'turmeric',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        <path
          d="M6.5 16.5H17.5L16.2 14.2V10.5C16.2 8 14.4 6 12 6C9.6 6 7.8 8 7.8 10.5V14.2L6.5 16.5Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <path d="M10.2 16.5C10.4 17.8 11.1 18.6 12 18.6C12.9 18.6 13.6 17.8 13.8 16.5" />
        <line x1="12" y1="3.6" x2="12" y2="6" />
        <circle cx="17.2" cy="6.8" r="2.1" fill={p.accent} stroke="none" />
      </>
    )}
  </IconFrame>
);

// ============================================================================
// 5. HOUSEHOLD, DIETARY & BILLING (4)
// ============================================================================

export const HouseholdTrayIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        {/* Traditional Circular Mâm Cơm Tray */}
        <circle
          cx="12"
          cy="12"
          r="8.8"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <circle cx="12" cy="12" r="2.6" fill={p.accent} fillOpacity={p.accentOpacity} />
        <circle cx="12" cy="6.4" r="1.4" />
        <circle cx="17.2" cy="11.2" r="1.4" />
        <circle cx="15" cy="16.6" r="1.4" />
        <circle cx="9" cy="16.6" r="1.4" />
        <circle cx="6.8" cy="11.2" r="1.4" />
      </>
    )}
  </IconFrame>
);

export const AllergenShieldIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <path
          d="M12 3.5L19 6.4V11.8C19 16.2 16 19.5 12 20.8C8 19.5 5 16.2 5 11.8V6.4L12 3.5Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <path d="M12 8.4V12.8" />
        <circle cx="12" cy="15.8" r="0.95" fill={p.stroke} stroke="none" />
      </>
    )}
  </IconFrame>
);

export const VietQRBadgeIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <rect
          x="3.5"
          y="3.5"
          width="17"
          height="17"
          rx="3.2"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <rect x="6.5" y="6.5" width="4.2" height="4.2" rx="0.8" />
        <rect x="13.3" y="6.5" width="4.2" height="4.2" rx="0.8" />
        <rect x="6.5" y="13.3" width="4.2" height="4.2" rx="0.8" />
        <path d="M13.5 13.5H17.5V15.5H15.5V17.5H13.5V13.5Z" />
      </>
    )}
  </IconFrame>
);

export const CrownPlusIcon: React.FC<TakolioIconProps> = ({
  tone = 'turmeric',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        <path
          d="M4.2 17.8L5.8 8.2L9.8 11.8L12 6.2L14.2 11.8L18.2 8.2L19.8 17.8H4.2Z"
          fill={p.fill}
          fillOpacity={Math.max(0.26, p.fillOpacity)}
        />
        <line x1="4.5" y1="20.2" x2="19.5" y2="20.2" />
      </>
    )}
  </IconFrame>
);

// ============================================================================
// 6. EXTENDED TERRA-BOTANICAL CULINARY & 3D ATELIER ICONS (12 -> 56 Total!)
// ============================================================================

export const FlameOffIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <circle cx="12" cy="12" r="7.5" fill={p.fill} fillOpacity={p.fillOpacity * 0.6} />
        <line x1="7.2" y1="16.8" x2="16.8" y2="7.2" />
      </>
    )}
  </IconFrame>
);

export const ChopsticksBowlIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <path
          d="M4.5 13.2H19.5C19 17.4 15.9 20.2 12 20.2C8.1 20.2 5 17.4 4.5 13.2Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <line x1="6.5" y1="5.2" x2="19.5" y2="8.8" />
        <line x1="6.5" y1="9.2" x2="19.5" y2="9.8" />
      </>
    )}
  </IconFrame>
);

export const MortarPestleIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <path
          d="M4.8 11.8H19.2L17.4 18.6C17.1 19.6 16.2 20.3 15.1 20.3H8.9C7.8 20.3 6.9 19.6 6.6 18.6L4.8 11.8Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <path d="M13.2 11.8L17.5 4.8" strokeWidth={2.2} />
      </>
    )}
  </IconFrame>
);

export const FishSauceCruetIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <path
          d="M8.5 4.2H15.5M10 4.2V8.2L7 12.5V18.8C7 19.7 7.8 20.4 8.7 20.4H15.3C16.2 20.4 17 19.7 17 18.8V12.5L14 8.2V4.2"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <line x1="7.2" y1="15.2" x2="16.8" y2="15.2" />
      </>
    )}
  </IconFrame>
);

export const HerbSprigIcon: React.FC<TakolioIconProps> = ({
  tone = 'jade',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        <path d="M6 19.5C9.5 15.5 13.5 11.5 18 5.5" />
        <path
          d="M11.2 13.8C8.4 13.6 7.2 11.2 7.8 8.8C10.2 9 11.6 11 11.2 13.8Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <path
          d="M14.2 10.8C17 11 18.4 9 18 6.6C15.6 6.4 14.2 8.2 14.2 10.8Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
      </>
    )}
  </IconFrame>
);

export const ReceiptScanIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <path
          d="M6 3.8H18V20.2L15.6 18.6L13.2 20.2L10.8 18.6L8.4 20.2L6 18.6V3.8Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <line x1="9" y1="8.2" x2="15" y2="8.2" />
        <line x1="9" y1="11.8" x2="15" y2="11.8" />
        <line x1="9" y1="15.2" x2="12.6" y2="15.2" />
      </>
    )}
  </IconFrame>
);

export const BarcodeScanIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <rect
          x="3.5"
          y="5.5"
          width="17"
          height="13"
          rx="2.2"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <line x1="7" y1="8.5" x2="7" y2="15.5" />
        <line x1="10" y1="8.5" x2="10" y2="15.5" strokeWidth={2.2} />
        <line x1="13.5" y1="8.5" x2="13.5" y2="15.5" />
        <line x1="16.8" y1="8.5" x2="16.8" y2="15.5" strokeWidth={2.2} />
      </>
    )}
  </IconFrame>
);

export const CaloriesLeafIcon: React.FC<TakolioIconProps> = ({
  tone = 'jade',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        <path
          d="M6.2 17.8C5.4 11.4 10.2 5.4 18.6 5.2C18.4 13.6 13.4 18.6 6.2 17.8Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <path d="M5.2 19L13.8 10.4" />
      </>
    )}
  </IconFrame>
);

export const BudgetCoinJarIcon: React.FC<TakolioIconProps> = ({
  tone = 'turmeric',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        <rect
          x="6"
          y="7.5"
          width="12"
          height="12.8"
          rx="3"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <line x1="8" y1="4.5" x2="16" y2="4.5" />
        <circle cx="12" cy="14" r="2.8" />
      </>
    )}
  </IconFrame>
);

export const CalendarMealCheckIcon: React.FC<TakolioIconProps> = ({
  tone = 'jade',
  ...props
}) => (
  <IconFrame tone={tone} {...props}>
    {(p) => (
      <>
        <circle
          cx="12"
          cy="12"
          r="8.4"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <path d="M8.5 12.2L10.9 14.6L15.6 9.6" />
      </>
    )}
  </IconFrame>
);

export const ShareFamilyLinkIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <circle cx="8.5" cy="9" r="2.8" fill={p.fill} fillOpacity={p.fillOpacity} />
        <circle cx="15.8" cy="9.8" r="2.3" fill={p.accent} fillOpacity={p.accentOpacity} />
        <path d="M4.2 18.8C4.8 15.8 6.6 14.4 9.2 14.4C11.8 14.4 13.6 15.8 14.2 18.8" />
        <path d="M14.4 14.8C16.8 14.8 18.6 16 19.4 18.6" />
      </>
    )}
  </IconFrame>
);

export const ThreeDOrbitBadgeIcon: React.FC<TakolioIconProps> = (props) => (
  <IconFrame {...props}>
    {(p) => (
      <>
        <path
          d="M12 4.2L18.5 8V15.6L12 19.4L5.5 15.6V8L12 4.2Z"
          fill={p.fill}
          fillOpacity={p.fillOpacity}
        />
        <path d="M5.5 8L12 11.8L18.5 8" />
        <line x1="12" y1="11.8" x2="12" y2="19.4" />
        <ellipse cx="12" cy="12.2" rx="9.6" ry="3.4" strokeOpacity={0.55} />
      </>
    )}
  </IconFrame>
);

// ============================================================================
// REGISTRY MAP FOR DYNAMIC LOOKUP & INTROSPECTION (56 ICONS)
// ============================================================================
export const TAKOLIO_ICON_REGISTRY = {
  TakolioLogoMark,
  TakolioWordmarkLockup,
  NavHomeIcon,
  NavFridgeIcon,
  NavRecipesIcon,
  NavPlannerIcon,
  NavShoppingIcon,
  NavProfileIcon,
  NavScanApertureIcon,
  WokFlameIcon,
  ClaypotBraiseIcon,
  StockpotSoupIcon,
  BambooSteamerIcon,
  ChefKnifeBoardIcon,
  MarinateBowlIcon,
  PlatingSparkleIcon,
  FlameLowIcon,
  FlameMediumIcon,
  FlameHighIcon,
  MultiTimerIcon,
  WakeLockSunIcon,
  VoiceWaveTakoIcon,
  AiSousChefSparkIcon,
  PortionScaleIcon,
  IngredientSwapIcon,
  LeftoverBoxIcon,
  SensoryAromaIcon,
  CatVegetableIcon,
  CatMeatIcon,
  CatSeafoodIcon,
  CatDairyEggIcon,
  CatFruitIcon,
  CatGrainDryIcon,
  CatSpiceSauceIcon,
  CatOtherIcon,
  ZoneCoolIcon,
  ZoneFreezeIcon,
  ZonePantryIcon,
  FreshnessShieldIcon,
  ExpiryRescueBellIcon,
  HouseholdTrayIcon,
  AllergenShieldIcon,
  VietQRBadgeIcon,
  CrownPlusIcon,
  FlameOffIcon,
  ChopsticksBowlIcon,
  MortarPestleIcon,
  FishSauceCruetIcon,
  HerbSprigIcon,
  ReceiptScanIcon,
  BarcodeScanIcon,
  CaloriesLeafIcon,
  BudgetCoinJarIcon,
  CalendarMealCheckIcon,
  ShareFamilyLinkIcon,
  ThreeDOrbitBadgeIcon,
} as const;

export type TakolioIconName = keyof typeof TAKOLIO_ICON_REGISTRY;
