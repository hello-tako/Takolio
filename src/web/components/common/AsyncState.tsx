import React from 'react';
import { WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { ApiError } from '../../services/api';
import { useLocaleText } from '../../i18n/app-i18n';

/** Warm Brand Board v2 structural shimmer loading state for widget-level fetches. */
export const InlineLoading: React.FC<{ label?: string }> = ({ label }) => {
  const { l } = useLocaleText();
  const resolvedLabel = label ?? l('Đang tải…', 'Loading…');
  return (
    <div className="py-4 flex flex-col gap-3 tkv-enter-fade-up" role="status" aria-live="polite">
      <div className="rounded-[22px] border border-[var(--tkv-border,#DCE6DE)] bg-[var(--tkv-surface,#FFFFFF)] p-4 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl tkv-shimmer shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-2 flex-1 min-w-0">
            <div className="h-4 w-44 max-w-[70%] rounded-md tkv-shimmer" aria-hidden="true" />
            <div className="h-3 w-28 max-w-[45%] rounded-md tkv-shimmer" aria-hidden="true" />
          </div>
        </div>
        <div className="h-14 w-full rounded-xl tkv-shimmer" aria-hidden="true" />
      </div>
      <p className="text-center text-xs text-[var(--tkv-ink-muted,#52706A)] font-semibold">{resolvedLabel}</p>
    </div>
  );
};

/** Skeleton block used while a card-sized widget loads. */
export const SkeletonCard: React.FC<{ className?: string }> = ({ className = 'h-24' }) => (
  <div
    className={`rounded-[20px] tkv-shimmer border border-[var(--tkv-border,#DCE6DE)]/70 ${className}`}
    aria-hidden="true"
  />
);

/**
 * Widget-level error state with retry. Distinguishes offline from server
 * errors so the copy stays honest without exposing HTTP internals.
 */
export const InlineError: React.FC<{
  error?: unknown;
  message?: string;
  onRetry?: () => void;
}> = ({ error, message, onRetry }) => {
  const { l } = useLocaleText();
  const offline = error instanceof ApiError && error.kind === 'offline';
  const text =
    message ||
    (offline
      ? l(
          'Không có kết nối mạng. Dữ liệu sẽ tự cập nhật khi có mạng lại.',
          'No internet connection. Data will refresh automatically once you are back online.',
        )
      : l('Không tải được dữ liệu. Vui lòng thử lại.', 'Could not load data. Please try again.'));
  const Icon = offline ? WifiOff : AlertTriangle;
  return (
    <div className="bg-[var(--tkv-surface,#FFFFFF)] rounded-[22px] border border-[var(--tkv-border,#DCE6DE)] p-5 text-center flex flex-col items-center gap-2.5 shadow-[var(--tkv-shadow-card)] tkv-enter-fade-up">
      <span className="w-10 h-10 rounded-xl bg-[var(--tkv-surface-coral,#FFF0E9)] border border-[var(--tkv-border-coral,#FAD0C4)] text-[var(--tkv-coral-ink,#B33A22)] inline-flex items-center justify-center">
        <Icon className="w-5 h-5" aria-hidden="true" />
      </span>
      <p role="alert" className="text-sm text-[var(--tkv-ink-secondary,#3C5954)] font-semibold max-w-sm">
        {text}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="tkv-focusable tkv-tactile inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-xl bg-[var(--tkv-surface-mint,#E7F4EC)] text-[var(--tkv-primary,#196149)] border border-[var(--tkv-border-mint,#BDE0CC)] text-xs font-extrabold hover:opacity-95 active:scale-95"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          {l('Thử lại', 'Try again')}
        </button>
      )}
    </div>
  );
};
