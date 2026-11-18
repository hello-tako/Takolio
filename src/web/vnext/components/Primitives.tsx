import React, { useId } from 'react';
import { clsx } from 'clsx';
import { VNextIcon, type VNextIconName } from './VNextIcons';
import { MascotIllustration, type MascotPose } from './VNextMedia';

export type TkvButtonVariant = 'primary' | 'coral' | 'secondary' | 'quiet' | 'danger';
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
    'bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white shadow-sm border border-transparent',
  coral:
    'bg-[var(--tkv-coral-cta)] hover:bg-[var(--tkv-coral-cta-hover)] text-white shadow-sm border border-transparent',
  secondary:
    'bg-[var(--tkv-surface)] hover:bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] border border-[var(--tkv-primary)]',
  quiet:
    'bg-[var(--tkv-surface)] hover:bg-[var(--tkv-surface-mint)] text-[var(--tkv-ink)] border border-[var(--tkv-border)]',
  danger:
    'bg-[var(--tkv-danger)] hover:opacity-95 text-white shadow-sm border border-transparent',
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
      'tkv-focusable inline-flex items-center justify-center gap-2 font-bold transition-colors select-none disabled:opacity-55 disabled:cursor-not-allowed',
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
    tone?: 'quiet' | 'primary' | 'mint';
  }
> = ({ icon, label, tone = 'quiet', className, type = 'button', ...rest }) => (
  <button
    type={type}
    aria-label={label}
    className={clsx(
      'tkv-focusable tkv-tap inline-flex items-center justify-center rounded-[14px] transition-colors shrink-0',
      tone === 'primary' && 'bg-[var(--tkv-primary)] text-white hover:bg-[var(--tkv-primary-hover)]',
      tone === 'mint' &&
        'bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] border border-[var(--tkv-border)]',
      tone === 'quiet' &&
        'bg-[var(--tkv-surface)] text-[var(--tkv-ink)] border border-[var(--tkv-border)] hover:bg-[var(--tkv-surface-mint)]',
      className,
    )}
    {...rest}
  >
    <VNextIcon name={icon} size={20} />
  </button>
);

export const TkvSurface: React.FC<
  React.HTMLAttributes<HTMLDivElement> & {
    tone?: 'default' | 'hero' | 'mint' | 'saffron' | 'coral';
    padded?: boolean;
  }
> = ({ tone = 'default', padded = true, className, children, ...rest }) => (
  <div
    className={clsx(
      'rounded-[var(--tkv-radius-card)] transition-colors',
      tone === 'default' &&
        'bg-[var(--tkv-surface)] border border-[var(--tkv-border)] shadow-[var(--tkv-shadow-card)]',
      tone === 'hero' && 'bg-[var(--tkv-primary)] text-white shadow-[var(--tkv-shadow-float)]',
      tone === 'mint' && 'bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border)]',
      tone === 'saffron' && 'bg-[var(--tkv-surface-saffron)] border border-[var(--tkv-border)]',
      tone === 'coral' && 'bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border)]',
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
  const defaultIcon: Record<NonNullable<typeof tone>, VNextIconName> = {
    success: 'check',
    warning: 'warning',
    danger: 'error',
    neutral: 'info',
    coral: 'sparkles',
  };
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold leading-tight',
        tone === 'success' && 'bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)]',
        tone === 'warning' && 'bg-[var(--tkv-surface-saffron)] text-[var(--tkv-warning)]',
        tone === 'danger' && 'bg-[var(--tkv-surface-coral)] text-[var(--tkv-danger)]',
        tone === 'coral' && 'bg-[var(--tkv-surface-coral)] text-[var(--tkv-ink)]',
        tone === 'neutral' &&
          'bg-[var(--tkv-bg)] text-[var(--tkv-ink-secondary)] border border-[var(--tkv-border)]',
        className,
      )}
    >
      <VNextIcon name={icon ?? defaultIcon[tone]} size={14} />
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
      'tkv-focusable min-h-[44px] inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-colors whitespace-nowrap shrink-0',
      active
        ? 'bg-[var(--tkv-primary)] text-white shadow-xs'
        : 'bg-[var(--tkv-surface)] text-[var(--tkv-ink-secondary)] border border-[var(--tkv-border)] hover:border-[var(--tkv-primary)] hover:text-[var(--tkv-ink)]',
      className,
    )}
  >
    {icon && <VNextIcon name={icon} size={16} />}
    <span>{children}</span>
  </button>
);

export const TkvTextField: React.FC<
  Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> & {
    label: string;
    hint?: string;
    error?: string | null;
    iconLeft?: VNextIconName;
    rightSlot?: React.ReactNode;
  }
> = ({ label, hint, error, iconLeft, rightSlot, id, className, ...rest }) => {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const errId = `${fieldId}-err`;
  return (
    <div className={clsx('space-y-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={fieldId} className="text-sm font-bold text-[var(--tkv-ink)]">
          {label}
        </label>
        {hint && <span className="text-xs text-[var(--tkv-ink-muted)]">{hint}</span>}
      </div>
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
}> = ({ id, value, onChange, placeholder = 'Tìm kiếm hoặc lọc…', label = 'Tìm kiếm', onClear }) => {
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
        id={inputId}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="tkv-focusable w-full min-h-[48px] pl-11 pr-11 py-2.5 rounded-2xl bg-[var(--tkv-surface)] border border-[var(--tkv-border)] text-base text-[var(--tkv-ink)] placeholder:text-[var(--tkv-ink-muted)] shadow-xs"
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
      'rounded-[var(--tkv-radius-card)] bg-[var(--tkv-surface-mint)]/75 border border-[var(--tkv-border)] animate-pulse',
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
  <TkvSurface tone="mint" className="p-6 sm:p-8 text-center flex flex-col items-center gap-3">
    <MascotIllustration pose={pose} size={104} decorative className="shadow-xs border border-[var(--tkv-border)]" />
    {eyebrow && (
      <span className="text-xs font-bold uppercase tracking-wider text-[var(--tkv-primary)]">
        {eyebrow}
      </span>
    )}
    <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink)]">{title}</h2>
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
  <TkvSurface tone="coral" role="alert" className="p-5 space-y-3">
    <div className="flex items-start gap-3">
      <span className="w-10 h-10 rounded-xl bg-white text-[var(--tkv-danger)] flex items-center justify-center shrink-0">
        <VNextIcon name="error" size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">{title}</h3>
        <p className="mt-1 text-sm text-[var(--tkv-ink-secondary)]">{message}</p>
      </div>
    </div>
    {onRetry && (
      <TkvButton variant="quiet" size="sm" iconLeft="refresh" onClick={onRetry}>
        Thử tải lại
      </TkvButton>
    )}
  </TkvSurface>
);

export const TkvUnavailableState: React.FC<{
  title: string;
  rfcId?: string;
  children: React.ReactNode;
}> = ({ title, rfcId, children }) => (
  <TkvSurface className="p-4 space-y-2 bg-[var(--tkv-bg)]">
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <h3 className="text-sm font-bold text-[var(--tkv-ink)]">{title}</h3>
      <TkvBadge tone="warning" icon="info">
        Chưa mở API {rfcId ? `(${rfcId})` : ''}
      </TkvBadge>
    </div>
    <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">{children}</p>
  </TkvSurface>
);
