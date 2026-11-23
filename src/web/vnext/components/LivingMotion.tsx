import React, { useContext, useEffect, useState } from 'react';
import { QueryClientContext, useIsFetching } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { queryClient as defaultQueryClient } from '../../lib/query-client';
import { VNextIcon } from './VNextIcons';

export type TkvToastTone = 'success' | 'info' | 'warning' | 'danger';

export interface TkvToastOptions {
  message: string;
  tone?: TkvToastTone;
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface ActiveToast extends TkvToastOptions {
  id: number;
  tone: TkvToastTone;
}

type ToastListener = (toast: ActiveToast) => void;
const toastListeners = new Set<ToastListener>();
let nextToastId = 1;

/**
 * Triggers a lightweight, non-blocking floating Kitchen Toast from anywhere in the app
 * without requiring extra root JSX providers.
 */
export function showTkvToast(options: TkvToastOptions | string): void {
  const payload: ActiveToast =
    typeof options === 'string'
      ? { id: nextToastId++, message: options, tone: 'success', durationMs: 3200 }
      : {
          id: nextToastId++,
          tone: options.tone ?? 'success',
          durationMs: options.durationMs ?? (options.onAction ? 4600 : 3200),
          ...options,
        };
  for (const listener of toastListeners) {
    listener(payload);
  }
}

/**
 * Global 2.5px Leaf Green progress indicator pinned to the top viewport edge.
 * Activates smoothly during route navigation or background TanStack Query fetches (>120ms)
 * so fast cached loads never flicker.
 */
export const TkvTopProgressBar: React.FC<{ active?: boolean }> = ({ active = false }) => {
  const ctxClient = useContext(QueryClientContext);
  const isFetching = useIsFetching(undefined, ctxClient ?? defaultQueryClient);
  const { pathname } = useLocation();
  const [navPulse, setNavPulse] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setNavPulse(true);
    const t = window.setTimeout(() => setNavPulse(false), 260);
    return () => window.clearTimeout(t);
  }, [pathname]);

  const busy = active || navPulse || isFetching > 0;

  useEffect(() => {
    if (!busy) {
      setVisible(false);
      return;
    }
    const showTimer = window.setTimeout(() => setVisible(true), 110);
    return () => window.clearTimeout(showTimer);
  }, [busy]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-50 h-[2.5px] overflow-hidden bg-[var(--tkv-surface-mint)] pointer-events-none"
    >
      <div className="h-full w-full bg-gradient-to-r from-[var(--tkv-primary)] via-[var(--tkv-accent)] to-[var(--tkv-primary)] tkv-top-bar-track" />
    </div>
  );
};

/**
 * Floating tactile Kitchen Toast viewport mounted inside app shells.
 * Clears automatically, supports Undo/Action button, and stays safely above Mobile BottomNav.
 */
export const TkvToastViewport: React.FC = () => {
  const [toasts, setToasts] = useState<ActiveToast[]>([]);

  useEffect(() => {
    const onToast: ToastListener = (toast) => {
      setToasts((prev) => [...prev.slice(-2), toast]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((item) => item.id !== toast.id));
      }, toast.durationMs ?? 3200);
    };
    toastListeners.add(onToast);
    return () => {
      toastListeners.delete(onToast);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] lg:bottom-6 lg:left-auto lg:right-6 lg:w-[380px] z-50 flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={clsx(
            'pointer-events-auto tkv-toast-enter rounded-2xl border px-4 py-3 shadow-[var(--tkv-shadow-elevated)] backdrop-blur-md flex items-center justify-between gap-3 text-sm font-semibold',
            toast.tone === 'success' &&
              'bg-[var(--tkv-primary-deep)]/95 text-white border-[var(--tkv-primary)]',
            toast.tone === 'info' &&
              'bg-[var(--tkv-ink)]/95 text-white border-[var(--tkv-ink-secondary)]',
            toast.tone === 'warning' &&
              'bg-[var(--tkv-surface-saffron)] text-[var(--tkv-warning-ink)] border-[var(--tkv-border-saffron)]',
            toast.tone === 'danger' &&
              'bg-[var(--tkv-surface-danger)] text-[var(--tkv-danger-ink)] border-[var(--tkv-border-danger)]',
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              aria-hidden="true"
              className={clsx(
                'w-6 h-6 rounded-full inline-flex items-center justify-center shrink-0',
                toast.tone === 'success' && 'bg-[var(--tkv-primary)] text-white',
                toast.tone === 'info' && 'bg-white/15 text-white',
                toast.tone === 'warning' && 'bg-[var(--tkv-saffron)] text-[var(--tkv-ink)]',
                toast.tone === 'danger' && 'bg-[var(--tkv-danger)] text-white',
              )}
            >
              <VNextIcon
                name={toast.tone === 'danger' ? 'error' : toast.tone === 'warning' ? 'warning' : 'check'}
                size={14}
              />
            </span>
            <span className="min-w-0 leading-snug">{toast.message}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {toast.actionLabel && toast.onAction && (
              <button
                type="button"
                onClick={() => {
                  toast.onAction?.();
                  setToasts((prev) => prev.filter((item) => item.id !== toast.id));
                }}
                className="tkv-focusable px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-extrabold tracking-wide transition-colors"
              >
                {toast.actionLabel}
              </button>
            )}
            <button
              type="button"
              aria-label="Đóng thông báo"
              onClick={() => setToasts((prev) => prev.filter((item) => item.id !== toast.id))}
              className="tkv-focusable w-7 h-7 rounded-lg inline-flex items-center justify-center opacity-75 hover:opacity-100 transition-opacity"
            >
              <VNextIcon name="close" size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

const CONFETTI_DOTS: ReadonlyArray<{
  cx: string;
  cy: string;
  cr: string;
  color: string;
  delay: string;
  size: string;
}> = [
  { cx: '-58px', cy: '-42px', cr: '-65deg', color: '#196149', delay: '0ms', size: 'w-2.5 h-2.5 rounded-full' },
  { cx: '-34px', cy: '-64px', cr: '45deg', color: '#F46B52', delay: '50ms', size: 'w-2 h-3 rounded-sm' },
  { cx: '0px', cy: '-72px', cr: '110deg', color: '#F6C453', delay: '30ms', size: 'w-2.5 h-2.5 rounded-full' },
  { cx: '36px', cy: '-62px', cr: '-80deg', color: '#196149', delay: '70ms', size: 'w-2 h-3 rounded-sm' },
  { cx: '60px', cy: '-40px', cr: '95deg', color: '#F46B52', delay: '20ms', size: 'w-2.5 h-2.5 rounded-full' },
  { cx: '-48px', cy: '-14px', cr: '75deg', color: '#F6C453', delay: '90ms', size: 'w-2 h-2 rounded-full' },
  { cx: '52px', cy: '-16px', cr: '-90deg', color: '#45A07A', delay: '110ms', size: 'w-2 h-2 rounded-full' },
  { cx: '-18px', cy: '-52px', cr: '140deg', color: '#45A07A', delay: '60ms', size: 'w-2 h-2 rounded-sm' },
  { cx: '20px', cy: '-50px', cr: '-120deg', color: '#F6C453', delay: '80ms', size: 'w-2 h-2 rounded-sm' },
];

/**
 * Pure GPU CSS botanical confetti burst for joyful milestones (O06 Onboarding Ready & C22 Cooking Complete).
 * Strictly disabled under `prefers-reduced-motion: reduce`.
 */
export const TkvConfettiBurst: React.FC<{ className?: string }> = ({ className }) => (
  <span
    aria-hidden="true"
    className={clsx('pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible', className)}
  >
    {CONFETTI_DOTS.map((dot, idx) => (
      <span
        key={idx}
        className={clsx('absolute tkv-confetti-piece', dot.size)}
        style={
          {
            backgroundColor: dot.color,
            animationDelay: dot.delay,
            '--tkv-cx': dot.cx,
            '--tkv-cy': dot.cy,
            '--tkv-cr': dot.cr,
          } as React.CSSProperties
        }
      />
    ))}
  </span>
);
