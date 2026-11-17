import React, { useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { useModalFocus } from '../use-modal-focus';

/* ============================================================================
 * TAKOLIO V4 — TERRA-BOTANICAL ATELIER PRIMITIVES
 * Signature spatial culinary components used across all V4 screens
 * ============================================================================ */

export type AtelierButtonVariant =
  | 'flame'
  | 'jade'
  | 'ceramic'
  | 'sunken'
  | 'sanctuary'
  | 'danger'
  | 'ghost';

export type AtelierButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AtelierButtonVariant;
  size?: AtelierButtonSize;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  loading?: boolean;
  fullWidth?: boolean;
  to?: string;
}

const BUTTON_VARIANTS: Record<AtelierButtonVariant, string> = {
  flame:
    'bg-tk-flame text-white shadow-float hover:bg-tk-flame-hover active:bg-tk-flame-deep border border-tk-flame-hover/30',
  jade:
    'bg-tk-jade text-white shadow-jade hover:bg-tk-jade-hover active:bg-tk-jade-deep border border-tk-jade-hover/30',
  ceramic:
    'bg-white text-tk-ink border border-tk-stone shadow-xs hover:border-tk-ink/25 hover:bg-tk-canvas active:bg-tk-sunken',
  sunken:
    'bg-tk-sunken text-tk-ink border border-transparent hover:bg-tk-stone/70 active:bg-tk-stone',
  sanctuary:
    'bg-tk-sanctuary-elevated text-white border border-white/12 hover:bg-white/15 active:bg-white/20',
  danger:
    'bg-tk-berry text-white shadow-sm hover:bg-tk-berry-deep border border-tk-berry-deep/30',
  ghost:
    'bg-transparent text-tk-secondary hover:bg-tk-sunken/80 hover:text-tk-ink',
};

const BUTTON_SIZES: Record<AtelierButtonSize, string> = {
  sm: 'min-h-[36px] px-3.5 py-1.5 text-xs font-bold rounded-xl gap-1.5',
  md: 'min-h-[44px] px-4.5 py-2.5 text-sm font-bold rounded-2xl gap-2',
  lg: 'min-h-[52px] px-6 py-3 text-base font-extrabold rounded-2xl gap-2.5',
  xl: 'min-h-[60px] px-7 py-3.5 text-base md:text-lg font-extrabold rounded-[22px] gap-3',
};

export const ActionButton: React.FC<ActionButtonProps> = ({
  variant = 'flame',
  size = 'md',
  icon,
  trailingIcon,
  loading = false,
  fullWidth = false,
  to,
  className,
  disabled,
  children,
  ...props
}) => {
  const classes = clsx(
    'inline-flex items-center justify-center transition-tap duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-tk-flame/35 active:scale-[0.985]',
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    fullWidth && 'w-full',
    (disabled || loading) && 'opacity-55 pointer-events-none',
    className,
  );

  const content = (
    <>
      {loading ? (
        <span
          aria-hidden="true"
          className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0"
        />
      ) : (
        icon && <span className="shrink-0 flex items-center">{icon}</span>
      )}
      <span className="truncate">{children}</span>
      {trailingIcon && <span className="shrink-0 flex items-center">{trailingIcon}</span>}
    </>
  );

  if (to && !disabled && !loading) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" disabled={disabled || loading} className={classes} {...props}>
      {content}
    </button>
  );
};

export const BentoCard: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    tone?: 'ceramic' | 'sunken' | 'flame' | 'jade' | 'turmeric' | 'sanctuary' | 'glass';
    interactive?: boolean;
    padding?: 'none' | 'sm' | 'md' | 'lg';
  }
> = ({ tone = 'ceramic', interactive = false, padding = 'md', className, children, ...props }) => {
  const toneClasses = {
    ceramic: 'bg-white border border-tk-stone/80 shadow-card text-tk-ink',
    sunken: 'bg-tk-sunken/85 border border-tk-stone/70 text-tk-ink',
    flame: 'bg-gradient-to-br from-tk-flame-soft via-white to-tk-turmeric-soft/50 border border-tk-flame/20 shadow-card text-tk-ink',
    jade: 'bg-gradient-to-br from-tk-jade-soft via-white to-tk-jade-mint/25 border border-tk-jade/20 shadow-card text-tk-ink',
    turmeric: 'bg-gradient-to-br from-tk-turmeric-soft via-white to-tk-flame-soft/40 border border-tk-turmeric/25 shadow-card text-tk-ink',
    sanctuary: 'bg-tk-sanctuary-card border border-white/10 shadow-elevated text-white',
    glass: 'tk-glass text-tk-ink',
  }[tone];

  const padClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-5 md:p-6',
    lg: 'p-6 md:p-8',
  }[padding];

  return (
    <div
      className={clsx(
        'rounded-[24px] relative overflow-hidden',
        toneClasses,
        padClasses,
        interactive && 'tk-card-interactive cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const AtelierBadge: React.FC<{
  tone?: 'flame' | 'jade' | 'turmeric' | 'berry' | 'ocean' | 'neutral' | 'dark';
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ tone = 'neutral', icon, children, className }) => {
  const styles = {
    flame: 'bg-tk-flame-soft text-tk-flame-deep border-tk-flame/20',
    jade: 'bg-tk-jade-soft text-tk-jade-deep border-tk-jade/20',
    turmeric: 'bg-tk-turmeric-soft text-tk-turmeric-deep border-tk-turmeric/25',
    berry: 'bg-tk-berry-soft text-tk-berry-deep border-tk-berry/20',
    ocean: 'bg-tk-ocean-soft text-tk-ocean border-tk-ocean/20',
    neutral: 'bg-tk-sunken text-tk-secondary border-tk-stone',
    dark: 'bg-white/10 text-white/90 border-white/15',
  }[tone];

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs font-bold tracking-tight',
        styles,
        className,
      )}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
};

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  layoutId = 'tk-segmented',
  dark = false,
  className,
}: {
  options: Array<{ value: T; label: string; icon?: React.ReactNode; badge?: string | number }>;
  value: T;
  onChange: (next: T) => void;
  layoutId?: string;
  dark?: boolean;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={clsx(
        'inline-flex items-center p-1 rounded-2xl border',
        dark ? 'bg-white/6 border-white/10' : 'bg-tk-sunken border-tk-stone/70',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={clsx(
              'relative px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer flex items-center gap-1.5 min-h-[38px]',
              active
                ? dark
                  ? 'text-tk-ink'
                  : 'text-tk-ink'
                : dark
                  ? 'text-white/70 hover:text-white'
                  : 'text-tk-secondary hover:text-tk-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 460, damping: 34 }}
                className="absolute inset-0 rounded-xl bg-white shadow-xs"
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {opt.icon}
              <span>{opt.label}</span>
              {opt.badge !== undefined && (
                <span
                  className={clsx(
                    'px-1.5 py-0.2 rounded-full text-[11px] tk-tabular font-extrabold',
                    active ? 'bg-tk-flame text-white' : 'bg-black/8 text-current',
                  )}
                >
                  {opt.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export const RadialProgressRing: React.FC<{
  value: number; // 0..100
  size?: number;
  strokeWidth?: number;
  tone?: 'flame' | 'jade' | 'turmeric';
  label?: React.ReactNode;
}> = ({ value, size = 56, strokeWidth = 5, tone = 'jade', label }) => {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (clamped / 100) * circumference;
  const strokeColor =
    tone === 'flame' ? '#E5533D' : tone === 'turmeric' ? '#D48817' : '#1B6B4A';

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(18,30,26,0.09)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-[stroke-dashoffset] duration-500 ease-out"
        />
      </svg>
      {label !== undefined && (
        <span className="absolute inset-0 flex items-center justify-center text-xs font-extrabold tk-tabular">
          {label}
        </span>
      )}
    </div>
  );
};

export const SlideDrawer: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  dark?: boolean;
  widthClass?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({
  open,
  onClose,
  title,
  subtitle,
  dark = false,
  widthClass = 'max-w-lg',
  children,
  footer,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useModalFocus(open, panelRef, onClose, closeRef);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/45 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          'w-full h-full flex flex-col shadow-2xl animate-slide-up sm:rounded-l-[28px] border-l',
          widthClass,
          dark
            ? 'bg-tk-sanctuary-card border-white/10 text-white'
            : 'bg-tk-canvas border-tk-stone text-tk-ink',
        )}
      >
        <div
          className={clsx(
            'px-5 py-4 border-b flex items-start justify-between gap-3 shrink-0',
            dark ? 'border-white/10' : 'border-tk-stone/80 bg-white/70 backdrop-blur',
          )}
        >
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-extrabold tracking-tight truncate">
              {title}
            </h2>
            {subtitle && (
              <p className={clsx('text-xs mt-0.5', dark ? 'text-white/65' : 'text-tk-muted')}>
                {subtitle}
              </p>
            )}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className={clsx(
              'tap-target rounded-xl p-2 transition-colors cursor-pointer flex items-center justify-center',
              dark ? 'text-white/70 hover:bg-white/10 hover:text-white' : 'text-tk-muted hover:bg-tk-sunken hover:text-tk-ink',
            )}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div
            className={clsx(
              'p-4 border-t shrink-0',
              dark ? 'border-white/10 bg-tk-sanctuary/90' : 'border-tk-stone/80 bg-white/90 backdrop-blur',
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
