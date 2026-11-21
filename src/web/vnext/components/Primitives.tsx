import React, { useId } from 'react';
import { clsx } from 'clsx';
import { VNextIcon, type VNextIconName } from './VNextIcons';
import { MascotIllustration, type MascotPose } from './VNextMedia';

export type TkvButtonVariant = 'primary' | 'coral' | 'secondary' | 'quiet' | 'ghost' | 'danger';
export type TkvButtonSize = 'sm' | 'md' | 'lg';

export interface TkvButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: TkvButtonVariant;
  size?: TkvButtonSize;
  fullWidth?: boolean;
  isLoading?: boolean;
  iconLeft?: VNextIconName;
  iconRight?: VNextIconName;
}

const BUTTON_VARIANTS: Record<TkvButtonVariant, string> = {
  primary:
    'bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-cta-hover)] text-white shadow-[var(--tkv-shadow-cta)] border border-transparent',
  coral:
    'bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-cta-hover)] text-white shadow-[var(--tkv-shadow-cta)] border border-transparent',
  secondary:
    'bg-[var(--tkv-surface)] hover:bg-[var(--tkv-surface-subtle)] text-[var(--tkv-ink)] border border-[var(--tkv-border)] hover:border-[var(--tkv-border-strong)] shadow-xs',
  quiet:
    'bg-[var(--tkv-surface-subtle)] hover:bg-[var(--tkv-surface-subtle-hover)] text-[var(--tkv-ink)] border border-[var(--tkv-border)]',
  ghost:
    'bg-transparent hover:bg-[var(--tkv-surface-subtle)] text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-ink)] border border-transparent',
  danger:
    'bg-[var(--tkv-danger)] hover:opacity-95 text-white shadow-xs border border-transparent',
};

const BUTTON_SIZES: Record<TkvButtonSize, string> = {
  sm: 'min-h-[44px] px-3.5 py-2 text-sm rounded-[var(--tkv-radius-btn)]',
  md: 'min-h-[46px] px-4.5 py-2.5 text-sm rounded-[var(--tkv-radius-btn)]',
  lg: 'min-h-[52px] px-6 py-3 text-base rounded-[var(--tkv-radius-btn)]',
};

export const TkvButton: React.FC<TkvButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  iconLeft,
  iconRight,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}) => (
  <button
    type={type}
    disabled={disabled || isLoading}
    className={clsx(
      'tkv-focusable tkv-tactile inline-flex items-center justify-center gap-2 font-semibold active:scale-[0.985] select-none disabled:opacity-50 disabled:cursor-not-allowed',
      BUTTON_VARIANTS[variant],
      BUTTON_SIZES[size],
      fullWidth && 'w-full',
      className,
    )}
    {...rest}
  >
    {isLoading ? (
      <span
        aria-hidden="true"
        className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin"
      />
    ) : (
      iconLeft && <VNextIcon name={iconLeft} size={18} />
    )}
    <span>{children}</span>
    {!isLoading && iconRight && <VNextIcon name={iconRight} size={18} />}
  </button>
);

export const TkvIconButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    icon: VNextIconName;
    label: string;
    tone?: 'quiet' | 'primary' | 'mint' | 'ghost';
  }
> = ({ icon, label, tone = 'quiet', className, type = 'button', ...rest }) => (
  <button
    type={type}
    aria-label={label}
    className={clsx(
      'tkv-focusable tkv-tap tkv-tactile inline-flex items-center justify-center rounded-xl active:scale-[0.985] shrink-0',
      tone === 'primary' &&
        'bg-[var(--tkv-primary)] text-white hover:bg-[var(--tkv-primary-cta-hover)]',
      tone === 'mint' &&
        'bg-[var(--tkv-surface-subtle)] text-[var(--tkv-ink)] border border-[var(--tkv-border)] hover:border-[var(--tkv-border-strong)]',
      tone === 'ghost' &&
        'bg-transparent text-[var(--tkv-ink-secondary)] hover:bg-[var(--tkv-surface-subtle)] hover:text-[var(--tkv-ink)]',
      tone === 'quiet' &&
        'bg-[var(--tkv-surface)] text-[var(--tkv-ink)] border border-[var(--tkv-border)] hover:bg-[var(--tkv-surface-subtle)]',
      className,
    )}
    {...rest}
  >
    <VNextIcon name={icon} size={20} />
  </button>
);

export type TkvSurfaceTone =
  | 'default'
  | 'muted'
  | 'subtle'
  | 'dark'
  | 'inverse'
  | 'hero'
  | 'mint'
  | 'saffron'
  | 'coral';

export const TkvSurface: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    tone?: TkvSurfaceTone;
    padded?: boolean;
  }
> = ({ tone = 'default', padded = true, className, children, ...rest }) => (
  <div
    className={clsx(
      'rounded-2xl transition-colors',
      tone === 'default' &&
        'bg-[var(--tkv-surface)] border border-[var(--tkv-border)] shadow-[var(--tkv-shadow-card)]',
      tone === 'muted' && 'bg-[var(--tkv-bg)] border border-[var(--tkv-border)]',
      tone === 'subtle' && 'bg-[var(--tkv-surface-subtle)] border border-[var(--tkv-border)]',
      tone === 'mint' && 'bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)]',
      tone === 'saffron' && 'bg-[var(--tkv-surface-saffron)] border border-[var(--tkv-border-saffron)]',
      tone === 'coral' && 'bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)]',
      (tone === 'dark' || tone === 'inverse' || tone === 'hero') && 'tkv-hero-ceramic',
      padded && 'p-5',
      className,
    )}
    {...rest}
  >
    {children}
  </div>
);

export const TkvBadge: React.FC<{
  tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'coral';
  icon?: VNextIconName;
  children: React.ReactNode;
  className?: string;
}> = ({ tone = 'neutral', icon, children, className }) => {
  const pillStyle: Record<NonNullable<typeof tone>, string> = {
    success:
      'bg-[var(--tkv-surface-mint)] text-[var(--tkv-success-ink)] border-[var(--tkv-border-mint)]',
    warning:
      'bg-[var(--tkv-surface-saffron)] text-[var(--tkv-warning-ink)] border-[var(--tkv-border-saffron)]',
    danger:
      'bg-[var(--tkv-surface-danger)] text-[var(--tkv-danger-ink)] border-[var(--tkv-border-danger)]',
    coral:
      'bg-[var(--tkv-surface-coral)] text-[var(--tkv-coral-ink)] border-[var(--tkv-border-coral)]',
    neutral:
      'bg-[var(--tkv-surface-subtle)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)]',
  };
  const dotColor: Record<NonNullable<typeof tone>, string> = {
    success: 'bg-[var(--tkv-success)]',
    warning: 'bg-[var(--tkv-warning)]',
    danger: 'bg-[var(--tkv-danger)]',
    coral: 'bg-[var(--tkv-accent)]',
    neutral: 'bg-[var(--tkv-ink-muted)]',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold leading-tight border',
        pillStyle[tone],
        className,
      )}
    >
      <span aria-hidden="true" className={clsx('w-1.5 h-1.5 rounded-full shrink-0', dotColor[tone])} />
      {icon && <VNextIcon name={icon} size={13} className="opacity-85" />}
      <span>{children}</span>
    </span>
  );
};

export const TkvChip: React.FC<{
  active?: boolean;
  onClick?: () => void;
  icon?: VNextIconName;
  children: React.ReactNode;
  className?: string;
}> = ({ active = false, onClick, icon, children, className }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={clsx(
      'tkv-focusable tkv-tactile min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold active:scale-[0.985] whitespace-nowrap shrink-0',
      active
        ? 'bg-[var(--tkv-primary)] text-white border border-[var(--tkv-primary)] shadow-xs'
        : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink-secondary)] border border-[var(--tkv-border)] hover:bg-[var(--tkv-surface-subtle)] hover:border-[var(--tkv-border-strong)] hover:text-[var(--tkv-ink)]',
      className,
    )}
  >
    {icon ? (
      <VNextIcon name={icon} size={16} />
    ) : (
      active && <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-white shrink-0" />
    )}
    <span>{children}</span>
  </button>
);

export const TkvTextField: React.FC<
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & {
    label: string;
    hint?: string;
    labelAction?: React.ReactNode;
    error?: string | null;
    iconLeft?: VNextIconName;
    rightSlot?: React.ReactNode;
  }
> = ({ label, hint, labelAction, error, iconLeft, rightSlot, id, className, ...rest }) => {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errId = `${fieldId}-err`;
  return (
    <div className={clsx('space-y-2', className)}>
      {(label || hint || labelAction) && (
        <div className="flex items-center justify-between gap-2">
          {label && (
            <label htmlFor={fieldId} className="text-sm font-semibold text-[var(--tkv-ink)]">
              {label}
            </label>
          )}
          {labelAction ?? (hint ? <span className="text-xs text-[var(--tkv-ink-muted)]">{hint}</span> : null)}
        </div>
      )}
      <div className="relative flex items-center">
        {iconLeft && (
          <span className="absolute left-3.5 text-[var(--tkv-ink-muted)] pointer-events-none">
            <VNextIcon name={iconLeft} size={18} />
          </span>
        )}
        <input
          id={fieldId}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errId : undefined}
          className={clsx(
            'tkv-focusable w-full min-h-[48px] bg-[var(--tkv-surface)] text-[var(--tkv-ink)] placeholder:text-[var(--tkv-ink-muted)] rounded-[var(--tkv-radius-btn)] border text-base px-4 py-2.5 transition-colors',
            iconLeft && 'pl-11',
            rightSlot && 'pr-12',
            error ? 'border-[var(--tkv-danger)]' : 'border-[var(--tkv-border)] focus:border-[var(--tkv-primary)]',
          )}
          {...rest}
        />
        {rightSlot && <div className="absolute right-1.5 flex items-center">{rightSlot}</div>}
      </div>
      {error && (
        <p id={errId} role="alert" className="text-xs font-semibold text-[var(--tkv-danger)] flex items-center gap-1.5">
          <VNextIcon name="error" size={14} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
};

export const TkvSearchField: React.FC<{
  id?: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  label?: string;
  onClear?: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;
}> = ({
  id,
  value,
  onChange,
  placeholder = 'Tìm kiếm hoặc lọc…',
  label = 'Tìm kiếm',
  onClear,
  inputRef,
  autoFocus,
}) => {
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div className="relative flex items-center">
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <span className="absolute left-4 text-[var(--tkv-ink-muted)] pointer-events-none">
        <VNextIcon name="search" size={18} />
      </span>
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="tkv-focusable w-full min-h-[48px] pl-11 pr-11 py-2.5 rounded-2xl bg-[var(--tkv-surface)] border border-[var(--tkv-border)] focus:border-[var(--tkv-primary)] text-base text-[var(--tkv-ink)] placeholder:text-[var(--tkv-ink-muted)] shadow-xs transition-colors"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange('');
            onClear?.();
          }}
          aria-label="Xóa từ khóa tìm kiếm"
          className="tkv-focusable tkv-tap absolute right-1 inline-flex items-center justify-center text-[var(--tkv-ink-muted)] hover:text-[var(--tkv-ink)]"
        >
          <VNextIcon name="close" size={16} />
        </button>
      )}
    </div>
  );
};

export const TkvSkeleton: React.FC<{ className?: string; label?: string }> = ({
  className = 'h-24',
  label = 'Đang tải dữ liệu…',
}) => (
  <div
    role="status"
    aria-live="polite"
    className={clsx(
      'rounded-2xl bg-[var(--tkv-surface-subtle)] border border-[var(--tkv-border)] animate-pulse',
      className,
    )}
  >
    <span className="sr-only">{label}</span>
  </div>
);

export const TkvEmptyState: React.FC<{
  pose?: MascotPose;
  eyebrow?: string;
  title: string;
  description: string;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
}> = ({ pose = 'empty-fridge', eyebrow, title, description, primaryAction, secondaryAction }) => (
  <TkvSurface tone="default" className="p-6 sm:p-8 text-center flex flex-col items-center gap-3">
    <MascotIllustration pose={pose} size={112} decorative />
    {eyebrow && (
      <span className="text-xs font-bold uppercase tracking-wider text-[var(--tkv-ink-muted)]">
        {eyebrow}
      </span>
    )}
    <h2 className="tkv-heading text-xl font-bold text-[var(--tkv-ink)]">{title}</h2>
    <p className="text-sm text-[var(--tkv-ink-secondary)] max-w-md leading-relaxed">{description}</p>
    {(primaryAction || secondaryAction) && (
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3 w-full sm:w-auto">
        {primaryAction}
        {secondaryAction}
      </div>
    )}
  </TkvSurface>
);

export const TkvErrorState: React.FC<{
  title?: string;
  message: string;
  onRetry?: () => void;
}> = ({ title = 'Chưa tải được dữ liệu máy chủ', message, onRetry }) => (
  <TkvSurface tone="muted" role="alert" className="p-5 space-y-3">
    <div className="flex items-start gap-3">
      <span className="w-10 h-10 rounded-xl bg-[var(--tkv-surface)] border border-[var(--tkv-border)] text-[var(--tkv-danger)] flex items-center justify-center shrink-0">
        <VNextIcon name="error" size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="tkv-heading text-base font-bold text-[var(--tkv-ink)]">{title}</h3>
        <p className="mt-1 text-sm text-[var(--tkv-ink-secondary)]">{message}</p>
      </div>
    </div>
    {onRetry && (
      <TkvButton variant="secondary" size="sm" iconLeft="refresh" onClick={onRetry}>
        Thử lại
      </TkvButton>
    )}
  </TkvSurface>
);

export const TkvUnavailableState: React.FC<{
  title: string;
  rfcId?: string;
  children: React.ReactNode;
}> = ({ title, rfcId, children }) => (
  <TkvSurface tone="muted" className="p-4 space-y-2">
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <h3 className="text-sm font-bold text-[var(--tkv-ink)]">{title}</h3>
      <TkvBadge tone="warning">
        Chưa mở API {rfcId ? `(${rfcId})` : ''}
      </TkvBadge>
    </div>
    <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">{children}</p>
  </TkvSurface>
);
