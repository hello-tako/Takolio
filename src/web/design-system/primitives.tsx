import React, { useEffect, useId, useRef } from 'react';
import { Link } from 'react-router-dom';
import { clsx } from 'clsx';
import { motion } from 'motion/react';
import { ChevronRight, X } from 'lucide-react';
import { useModalFocus } from './use-modal-focus';

/**
 * T17 shared primitives aligned to Official Takolio Brand Board v2 (Leaf Green #196149, Tomato Coral #F46B52, Warm Ivory #FFF9F1).
 */

export type PageWidth = 'compact' | 'default' | 'wide' | 'fullscreen';

const PAGE_WIDTH: Record<PageWidth, string> = {
  compact: 'max-w-[45rem]',
  default: 'max-w-[60rem]',
  wide: 'max-w-[75rem]',
  fullscreen: 'max-w-none',
};

export const Page: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { width?: PageWidth; gutter?: boolean }
> = ({ width = 'default', gutter = true, className, children, ...props }) => (
  <div
    className={clsx(
      'mx-auto w-full flex-1',
      PAGE_WIDTH[width],
      gutter && 'px-4 md:px-6 lg:px-8',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const PageHeader: React.FC<{
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
}> = ({ title, subtitle, onBack, backLabel = 'Quay lại', actions }) => (
  <header className="flex items-start justify-between gap-4 pt-5 pb-3">
    <div className="flex items-start gap-3 min-w-0">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className="tap-target -ml-2 mt-0.5 inline-flex items-center justify-center rounded-xl text-[var(--tkv-ink-secondary)] hover:bg-[var(--tkv-surface-subtle)] hover:text-[var(--tkv-ink)] tkv-focusable transition-colors"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18 L9 12 L15 6" />
          </svg>
        </button>
      )}
      <div className="min-w-0">
        <h1 className="text-type-heading text-[var(--tkv-ink)]">{title}</h1>
        {subtitle && <p className="text-sm text-[var(--tkv-ink-muted)] mt-0.5">{subtitle}</p>}
      </div>
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </header>
);

export const Section: React.FC<
  React.HTMLAttributes<HTMLDivElement> & { title?: string; summary?: string; action?: React.ReactNode }
> = ({ title, summary, action, className, children, ...props }) => (
  <section className={clsx('py-4', className)} {...props}>
    {(title || action) && (
      <div className="flex items-end justify-between gap-3 mb-3">
        <div className="min-w-0">
          {title && <h2 className="text-type-label text-[var(--tkv-ink)]">{title}</h2>}
          {summary && <p className="text-sm text-[var(--tkv-ink-muted)] mt-0.5">{summary}</p>}
        </div>
        {action}
      </div>
    )}
    {children}
  </section>
);

/** Restrained raised panel aligned to Sumi Monochrome hairlines. */
export const Surface: React.FC<React.HTMLAttributes<HTMLDivElement> & { tone?: 'default' | 'subtle' | 'accent' }> = ({
  tone = 'default',
  className,
  children,
  ...props
}) => (
  <div
    className={clsx(
      'rounded-2xl',
      tone === 'default' && 'bg-[var(--tkv-surface)] border border-[var(--tkv-border)] shadow-[var(--tkv-shadow-card)]',
      tone === 'subtle' && 'bg-[var(--tkv-bg)] border border-[var(--tkv-border)]',
      tone === 'accent' && 'bg-[var(--tkv-surface-subtle)] border border-[var(--tkv-border)]',
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export const BottomCTA: React.FC<{ children: React.ReactNode; hideOnDesktop?: boolean }> = ({
  children,
  hideOnDesktop = false,
}) => (
  <div
    data-kitchen-action="fixed"
    className={clsx(
      'kitchen-bottom-cta fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom,0px))] sm:bottom-0 sm:left-20 z-20 bg-white/90 backdrop-blur-md border-t border-[var(--tkv-border)] px-4 py-3 sm:pb-[calc(env(safe-area-inset-bottom,0px)+12px)] lg:static lg:left-auto lg:bottom-auto lg:z-auto lg:bg-transparent lg:border-0 lg:p-0',
      hideOnDesktop && 'lg:hidden'
    )}
  >
    {children}
  </div>
);

export const StickyActions: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    data-kitchen-action="fixed"
    className="kitchen-sticky-actions sticky bottom-[calc(68px+env(safe-area-inset-bottom,0px))] sm:bottom-0 z-20 -mx-4 md:-mx-6 lg:-mx-8 mt-4 bg-white/90 backdrop-blur-md border-t border-[var(--tkv-border)] px-4 md:px-6 lg:px-8 py-3 sm:pb-[calc(env(safe-area-inset-bottom,0px)+12px)] flex gap-3"
  >
    {children}
  </div>
);

export const Switch: React.FC<{
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, description, disabled = false }) => {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label id={`${id}-label`} htmlFor={id} className="text-sm font-semibold text-[var(--tkv-ink)] block">
          {label}
        </label>
        {description && (
          <p id={`${id}-desc`} className="text-xs text-[var(--tkv-ink-muted)] mt-0.5">
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={clsx(
          'relative shrink-0 w-[52px] h-8 rounded-pill transition-colors duration-150 tkv-focusable before:absolute before:-inset-y-1.5 before:-inset-x-1 before:content-[""]',
          checked ? 'bg-[var(--tkv-primary)]' : 'bg-[var(--tkv-border-strong)]',
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        )}
      >
        <motion.span
          aria-hidden="true"
          animate={{ x: checked ? 20 : 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-xs"
        />
      </button>
    </div>
  );
};

export const SettingsRow: React.FC<{
  to?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  label: string;
  meta?: string;
  danger?: boolean;
}> = ({ to, onClick, icon, label, meta, danger = false }) => {
  const inner = (
    <>
      {icon && (
        <span className="w-9 h-9 rounded-xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] text-[var(--tkv-ink)] flex items-center justify-center shrink-0" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span
          className={clsx(
            'text-sm font-semibold block truncate',
            danger ? 'text-[var(--tkv-danger)]' : 'text-[var(--tkv-ink)]'
          )}
        >
          {label}
        </span>
        {meta && <span className="text-xs text-[var(--tkv-ink-muted)] block truncate">{meta}</span>}
      </span>
      <ChevronRight className="w-4 h-4 text-[var(--tkv-ink-muted)] shrink-0" aria-hidden="true" />
    </>
  );
  const cls =
    'w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--tkv-bg)] active:bg-[var(--tkv-surface-subtle)] tkv-focusable transition-colors';
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
};

export type SemanticTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** StatusBadge: Sunlit Ceramic pill with culinary status dot. */
export const StatusBadge: React.FC<{ tone: SemanticTone; children: React.ReactNode; className?: string }> = ({
  tone,
  children,
  className,
}) => {
  const pillTones: Record<SemanticTone, string> = {
    success: 'bg-[var(--tkv-surface-mint)] text-[var(--tkv-success-ink)] border-[var(--tkv-border-mint)]',
    warning: 'bg-[var(--tkv-surface-saffron)] text-[var(--tkv-warning-ink)] border-[var(--tkv-border-saffron)]',
    danger: 'bg-[var(--tkv-surface-danger)] text-[var(--tkv-danger-ink)] border-[var(--tkv-border-danger)]',
    info: 'bg-[var(--tkv-surface-coral)] text-[var(--tkv-coral-ink)] border-[var(--tkv-border-coral)]',
    neutral: 'bg-[var(--tkv-surface-subtle)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)]',
  };
  const dotColors: Record<SemanticTone, string> = {
    success: 'bg-[var(--tkv-success)]',
    warning: 'bg-[var(--tkv-warning)]',
    danger: 'bg-[var(--tkv-danger)]',
    info: 'bg-[var(--tkv-primary)]',
    neutral: 'bg-[var(--tkv-ink-muted)]',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 text-xs font-semibold border',
        pillTones[tone],
        className
      )}
    >
      <span aria-hidden="true" className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dotColors[tone])} />
      {children}
    </span>
  );
};

export const UnavailableState: React.FC<{ title?: string; children: React.ReactNode }> = ({
  title = 'Chưa hỗ trợ',
  children,
}) => (
  <div
    role="note"
    className="rounded-2xl border border-dashed border-[var(--tkv-border-strong)] bg-[var(--tkv-bg)] px-4 py-3.5"
  >
    <p className="text-sm font-semibold text-[var(--tkv-ink-secondary)]">{title}</p>
    <p className="text-xs text-[var(--tkv-ink-muted)] mt-1 leading-relaxed">{children}</p>
  </div>
);

export const Skeleton: React.FC<{ className?: string; label?: string }> = ({ className, label }) => (
  <div
    role={label ? 'status' : undefined}
    aria-label={label}
    className={clsx('rounded-2xl bg-[var(--tkv-surface-subtle)] border border-[var(--tkv-border)] t17-skeleton', className)}
  />
);

/**
 * Bottom sheet (components/BOTTOM_SHEET.md): labelled modal dialog anchored
 * to the bottom edge on phones and centred from `sm` up. Uses tactile spring/CSS
 * entrance motion, Escape & Tab focus containment, and body scroll lock.
 */
export const BottomSheet: React.FC<{
  open: boolean;
  title: string;
  onClose: () => void;
  closeLabel?: string;
  children: React.ReactNode;
  className?: string;
  scrimClassName?: string;
}> = ({ open, title, onClose, closeLabel = 'Đóng', children, className, scrimClassName }) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  useModalFocus(open, panelRef, onClose, closeRef);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={clsx(
        'fixed inset-0 z-50 flex items-end justify-center bg-semantic-overlay/60 p-0 backdrop-blur-xs sm:items-center sm:p-4 animate-fade-in',
        scrimClassName,
      )}
      onClick={onClose}
      role="presentation"
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        initial={{ opacity: 0, y: 20, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.85 }}
        onClick={(e) => e.stopPropagation()}
        className={clsx(
          'w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-t-2xl border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-5 shadow-[var(--tkv-shadow-elevated)] sm:rounded-2xl animate-slide-up',
          className,
        )}
      >
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-[var(--tkv-border-strong)] sm:hidden" aria-hidden="true" />
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 id={titleId} className="tkv-heading text-base font-bold text-[var(--tkv-ink)]">{title}</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="tap-target flex items-center justify-center rounded-xl p-1.5 text-[var(--tkv-ink-muted)] transition-colors hover:bg-[var(--tkv-surface-subtle)] hover:text-[var(--tkv-ink)] tkv-focusable"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
};
