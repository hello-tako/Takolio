import type { ReactNode } from 'react';
import { TAKOLIO_BRAND } from '../../lib/takolio-brand';
import { TakolioWordmarkLockup } from '../../design-system/icons';

export function SystemStatusPage({
  title,
  children,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  busy?: boolean;
}) {
  return (
    <main
      className="system-status-page min-h-dvh bg-tk-canvas text-tk-ink flex items-center justify-center p-6"
      aria-busy={busy}
    >
      <div className="w-full max-w-md rounded-[28px] bg-white border border-tk-stone/80 shadow-elevated p-6 sm:p-8 space-y-5">
        <div className="flex items-center justify-between gap-3 border-b border-tk-stone/70 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-tk-flame-soft border border-tk-flame/20 flex items-center justify-center shrink-0">
              <img
                src={TAKOLIO_BRAND.compactLogo}
                alt="Takolio"
                translate="no"
                width={44}
                height={44}
                className="w-8 h-8 object-contain"
              />
            </div>
            <TakolioWordmarkLockup size={26} tone="ink" />
          </div>
          {busy && (
            <span
              aria-hidden="true"
              className="w-5 h-5 rounded-full border-2 border-tk-jade border-t-transparent animate-spin motion-reduce:animate-none shrink-0"
            />
          )}
        </div>

        <section className="space-y-3 text-sm text-tk-secondary leading-relaxed">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-tk-jade">
            Không gian bếp gia đình
          </p>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-tk-ink">
            {title}
          </h1>
          <div className="pt-1 space-y-4">{children}</div>
        </section>
      </div>
    </main>
  );
}
