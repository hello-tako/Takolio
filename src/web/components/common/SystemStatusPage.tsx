import type { ReactNode } from 'react';
import { TAKOLIO_BRAND } from '../../lib/takolio-brand';
import { useLocaleText } from '../../i18n/app-i18n';

export function SystemStatusPage({
  title,
  children,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  busy?: boolean;
}) {
  const { l } = useLocaleText();
  return (
    <main className="takolio-rebuild system-status-page bg-semantic-background text-semantic-text-primary" aria-busy={busy}>
      <div className="system-status-workspace rounded-2xl bg-semantic-surface border border-semantic-border p-6 sm:p-8">
        <img src={TAKOLIO_BRAND.compactLogo} alt="Takolio" translate="no" width={44} height={44} style={{ width: 44, height: 44 }} />
        <section className="system-status-content">
          <p className="system-status-eyebrow inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-semantic-text-muted">
            <span className="w-1.5 h-1.5 rounded-full bg-semantic-accent" aria-hidden="true" />
            <span>{l('Bếp của bạn', 'Your kitchen')}</span>
          </p>
          <h1>{title}</h1>
          {children}
        </section>
      </div>
    </main>
  );
}
