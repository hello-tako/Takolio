import React, { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatMoneyMinor, useUiTranslation } from '../i18n';
import {
  fetchGlobalBillingAccount,
  type GlobalBillingAccountResponse,
  type GlobalBillingPaymentDto,
} from '../services/global-api';
import { useAuthStore } from '../stores/useAuthStore';
import { ConsumerStudioShell } from '../vnext/components/Shells';
import { VNextIcon } from '../vnext/components/VNextIcons';
import { vnextHref } from '../vnext/feature';

type ReturnViewState = 'polling' | 'paid' | 'awaiting_async_payment' | 'failed' | 'pending_timeout';

const MAX_POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 2000;

export const BillingReturnPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const intentId = searchParams.get('intent_id');
  const { locale, catalog } = useUiTranslation();
  const setPlusFromServer = useAuthStore((s) => s.setPlusFromServer);
  const syncPlusFromServer = useAuthStore((s) => s.syncPlusFromServer);

  const [viewState, setViewState] = useState<ReturnViewState>('polling');
  const [matchedPayment, setMatchedPayment] = useState<GlobalBillingPaymentDto | null>(null);
  const [account, setAccount] = useState<GlobalBillingAccountResponse | null>(null);
  const [pollRun, setPollRun] = useState(0);

  const triggerRecheck = useCallback(() => {
    setViewState('polling');
    setPollRun((v) => v + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let attempts = 0;

    const pollOnce = async () => {
      attempts += 1;
      try {
        const resp = await fetchGlobalBillingAccount(locale);
        if (cancelled) return;
        setAccount(resp);
        const found = intentId
          ? resp.payments.find((p) => p.id === intentId) ?? null
          : resp.payments[0] ?? null;
        setMatchedPayment(found);

        if (found?.status === 'paid' || resp.subscription.isPlus) {
          setPlusFromServer(true);
          void syncPlusFromServer();
          setViewState('paid');
          return;
        }
        if (found?.status === 'awaiting_async_payment') {
          setViewState('awaiting_async_payment');
          return;
        }
        if (found?.status === 'failed' || found?.status === 'expired') {
          setViewState('failed');
          return;
        }
      } catch {
        // Keep polling transiently while webhook settles.
      }

      if (cancelled) return;
      if (attempts >= MAX_POLL_ATTEMPTS) {
        setViewState('pending_timeout');
        return;
      }
      setTimeout(() => {
        if (!cancelled) void pollOnce();
      }, POLL_INTERVAL_MS);
    };

    void pollOnce();
    return () => {
      cancelled = true;
    };
  }, [intentId, locale, pollRun, setPlusFromServer, syncPlusFromServer]);

  const mascotSrc =
    viewState === 'paid'
      ? '/takolio/vnext/mascot/pose-06-achievement-256w.webp'
      : viewState === 'failed'
        ? '/takolio/vnext/mascot/pose-08-error-256w.webp'
        : '/takolio/vnext/mascot/pose-03-scanning-256w.webp';

  return (
    <ConsumerStudioShell screenId="U08" title="Takolio Pro" backTo={vnextHref('/plus')}>
      <div className="mx-auto max-w-md py-6 sm:py-10">
        <div
          className="overflow-hidden rounded-[28px] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] shadow-[var(--tkv-shadow-elevated)]"
          data-testid="dodo-billing-return-card"
          data-return-state={viewState}
        >
          {/* Warm Mascot Header Band */}
          <div
            className={[
              'flex flex-col items-center px-6 pt-7 pb-5 text-center',
              viewState === 'paid'
                ? 'bg-[var(--tkv-surface-mint)]'
                : viewState === 'failed'
                  ? 'bg-[var(--tkv-surface-danger)]'
                  : 'bg-[var(--tkv-bg)]',
            ].join(' ')}
          >
            <div className="mb-3 flex h-24 w-24 items-center justify-center rounded-3xl bg-[var(--tkv-surface)] p-2 shadow-[var(--tkv-shadow-card)]">
              <img src={mascotSrc} alt="" aria-hidden="true" className="h-full w-full object-contain" />
            </div>

            {viewState === 'paid' && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tkv-border-mint)] bg-[var(--tkv-surface)] px-3 py-1 text-xs font-extrabold text-[var(--tkv-success-ink)]">
                <VNextIcon name="crown" size={14} className="text-[var(--tkv-warning)]" />
                <span>{catalog.billing.returnSuccessBadge}</span>
              </span>
            )}
          </div>

          <div className="space-y-5 p-6 text-center">
            {viewState === 'polling' && (
              <>
                <div className="space-y-2">
                  <h1 className="tkv-heading text-xl font-black text-[var(--tkv-ink)]">
                    {catalog.billing.returnConfirmingTitle}
                  </h1>
                  <p className="text-sm leading-relaxed text-[var(--tkv-ink-secondary)]">
                    {catalog.billing.returnConfirmingSubtitle}
                  </p>
                </div>

                {/* 2-Step Confirmation Progress */}
                <div className="flex items-center justify-center gap-3 rounded-2xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] px-4 py-3 text-xs font-bold">
                  <span className="inline-flex items-center gap-1.5 text-[var(--tkv-primary)]">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--tkv-primary)] text-white">
                      <VNextIcon name="check" size={12} />
                    </span>
                    {catalog.billing.returnStepPaid}
                  </span>
                  <span className="h-px w-5 bg-[var(--tkv-border-strong)]" aria-hidden="true" />
                  <span className="inline-flex items-center gap-1.5 text-[var(--tkv-ink-secondary)]">
                    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
                      <span className="tkv-pending-dot" style={{ animationDelay: '0ms' }} />
                      <span className="tkv-pending-dot" style={{ animationDelay: '150ms' }} />
                    </span>
                    {catalog.billing.returnStepActivate}
                  </span>
                </div>
              </>
            )}

            {viewState === 'paid' && (
              <>
                <div className="space-y-2">
                  <h1 className="tkv-heading text-2xl font-black text-[var(--tkv-ink)]">
                    {catalog.billing.returnSuccessTitle}
                  </h1>
                  <p className="text-sm leading-relaxed text-[var(--tkv-ink-secondary)]">
                    {catalog.billing.returnSuccessSubtitle}
                  </p>
                </div>

                {(matchedPayment || account?.subscription.expiresAt) && (
                  <div className="space-y-2 rounded-2xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] p-4 text-left text-xs">
                    {matchedPayment && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-[var(--tkv-ink-muted)]">
                          {matchedPayment.plan === 'annual' ? catalog.billing.annualPlan : catalog.billing.monthlyPlan}
                        </span>
                        <strong className="tabular-nums text-sm font-black text-[var(--tkv-ink)]">
                          {formatMoneyMinor(matchedPayment.amountMinor, matchedPayment.currency, locale)}
                        </strong>
                      </div>
                    )}
                    {account?.subscription.expiresAt && (
                      <div className="flex items-center justify-between gap-2 border-t border-[var(--tkv-border)] pt-2">
                        <span className="font-medium text-[var(--tkv-ink-muted)]">
                          {catalog.billing.renewsUntilLabel}
                        </span>
                        <strong className="font-bold text-[var(--tkv-ink)]">
                          {new Date(account.subscription.expiresAt).toLocaleDateString(locale, { dateStyle: 'medium' })}
                        </strong>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {viewState === 'awaiting_async_payment' && (
              <div className="space-y-2">
                <h1 className="tkv-heading text-xl font-black text-[var(--tkv-ink)]">
                  {catalog.billing.returnPendingTitle}
                </h1>
                <p className="text-sm leading-relaxed text-[var(--tkv-ink-secondary)]">
                  {catalog.billing.awaitingKonbiniNotice}
                </p>
              </div>
            )}

            {viewState === 'pending_timeout' && (
              <div className="space-y-3">
                <h1 className="tkv-heading text-xl font-black text-[var(--tkv-ink)]">
                  {catalog.billing.returnPendingTitle}
                </h1>
                <p className="text-sm leading-relaxed text-[var(--tkv-ink-secondary)]">
                  {catalog.billing.returnPendingSubtitle}
                </p>
                <button
                  type="button"
                  onClick={triggerRecheck}
                  className="tkv-focusable inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--tkv-border-strong)] bg-[var(--tkv-surface)] px-5 text-xs font-bold text-[var(--tkv-ink)] hover:bg-[var(--tkv-surface-subtle)]"
                >
                  {catalog.billing.returnRetryCheck}
                </button>
              </div>
            )}

            {viewState === 'failed' && (
              <div className="space-y-2">
                <h1 className="tkv-heading text-xl font-black text-[var(--tkv-danger-ink)]">
                  {catalog.billing.returnFailedTitle}
                </h1>
                <p className="text-sm leading-relaxed text-[var(--tkv-ink-secondary)]">
                  {catalog.billing.returnFailedSubtitle}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2.5 pt-2">
              {viewState === 'failed' ? (
                <Link
                  to={vnextHref('/plus')}
                  className="tkv-focusable tkv-tactile inline-flex min-h-[50px] w-full items-center justify-center rounded-full bg-[var(--tkv-primary)] px-6 text-sm font-extrabold text-white shadow-[var(--tkv-shadow-cta)] hover:bg-[var(--tkv-primary-cta-hover)]"
                >
                  {catalog.billing.returnBackToPlans}
                </Link>
              ) : (
                <Link
                  to={vnextHref('/')}
                  className="tkv-focusable tkv-tactile inline-flex min-h-[50px] w-full items-center justify-center rounded-full bg-[var(--tkv-primary)] px-6 text-sm font-extrabold text-white shadow-[var(--tkv-shadow-cta)] hover:bg-[var(--tkv-primary-cta-hover)]"
                >
                  {catalog.billing.returnStartCooking}
                </Link>
              )}
              <Link
                to={vnextHref('/plus')}
                className="tkv-focusable inline-flex min-h-[44px] w-full items-center justify-center rounded-full border border-[var(--tkv-border)] bg-[var(--tkv-surface)] px-5 text-xs font-bold text-[var(--tkv-ink-secondary)] hover:bg-[var(--tkv-surface-subtle)] hover:text-[var(--tkv-ink)]"
              >
                {catalog.billing.returnManageBilling}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </ConsumerStudioShell>
  );
};

export default BillingReturnPage;
