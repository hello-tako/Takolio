import React from 'react';
import { useLocaleText } from '../../i18n/app-i18n';

/**
 * Branded Structural Skeleton Fallback shown while a lazy route chunk loads.
 * Keeps a calm Brand Board v2 frame (2.5px Leaf Green progress bar + warm ivory shimmer)
 * so transitions never flash a stark blank white screen.
 */
export const RouteFallback: React.FC = () => {
  const { l } = useLocaleText();
  return (
    <div
      className="tkv-root takolio-rebuild min-h-dvh bg-[var(--tkv-bg,#FFF9F1)] flex flex-col"
      role="status"
      aria-live="polite"
      aria-label={l('Đang tải trang', 'Loading page')}
    >
    {/* Top 2.5px Leaf Green sweep bar */}
    <div
      aria-hidden="true"
      className="fixed inset-x-0 top-0 z-50 h-[2.5px] overflow-hidden bg-[var(--tkv-surface-mint,#E7F4EC)]"
    >
      <div className="h-full w-full bg-gradient-to-r from-[var(--tkv-primary,#196149)] via-[var(--tkv-accent,#F46B52)] to-[var(--tkv-primary,#196149)] tkv-top-bar-track" />
    </div>

    <div className="flex-1 flex min-w-0">
      {/* Desktop sidebar structural silhouette */}
      <div
        aria-hidden="true"
        className="hidden lg:flex w-[280px] shrink-0 flex-col gap-5 border-r border-[var(--tkv-border,#DCE6DE)] bg-[var(--tkv-surface,#FFFFFF)] px-4 py-5"
      >
        <div className="flex items-center gap-2.5 px-1">
          <div className="w-10 h-10 rounded-xl tkv-shimmer" />
          <div className="flex flex-col gap-1.5 flex-1">
            <div className="h-4 w-24 rounded-md tkv-shimmer" />
            <div className="h-2.5 w-36 rounded-md tkv-shimmer" />
          </div>
        </div>
        <div className="h-11 w-full rounded-2xl tkv-shimmer" />
        <div className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-11 w-full rounded-2xl tkv-shimmer" />
          ))}
        </div>
      </div>

      {/* Main content warm shimmer + Bé Mầm Bếp calm pulse */}
      <div className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/takolio/brand-v2/mascot/bemam-01-welcome-256w.webp"
              alt=""
              width={44}
              height={44}
              className="w-11 h-11 rounded-2xl object-contain tkv-mascot-float"
            />
            <div className="flex flex-col gap-1.5">
              <div className="h-5 w-40 rounded-lg tkv-shimmer" />
              <p className="text-xs font-semibold text-[var(--tkv-ink-muted,#52706A)]">
                {l('Bé Mầm Bếp đang mở trang…', 'Sprout Chef is opening the page…')}
              </p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2" aria-hidden="true">
            <div className="h-10 w-24 rounded-full tkv-shimmer" />
            <div className="h-10 w-24 rounded-full tkv-shimmer" />
          </div>
        </div>

        <div aria-hidden="true" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="h-44 sm:h-52 w-full rounded-[24px] tkv-shimmer border border-[var(--tkv-border,#DCE6DE)]/70" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-44 rounded-[22px] tkv-shimmer border border-[var(--tkv-border,#DCE6DE)]/70" />
              <div className="h-44 rounded-[22px] tkv-shimmer border border-[var(--tkv-border,#DCE6DE)]/70" />
            </div>
          </div>
          <div className="lg:col-span-4 flex flex-col gap-4">
            <div className="h-32 rounded-[22px] tkv-shimmer border border-[var(--tkv-border,#DCE6DE)]/70" />
            <div className="h-28 rounded-[22px] tkv-shimmer border border-[var(--tkv-border,#DCE6DE)]/70" />
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};
