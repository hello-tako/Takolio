import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatMoneyMinor, useUiTranslation } from '../i18n';
import {
  fetchGlobalBillingAccount,
  type GlobalBillingAccountResponse,
  type GlobalBillingPaymentDto,
} from '../services/global-api';
import { useAuthStore } from '../stores/useAuthStore';
import { ConsumerStudioShell } from '../vnext/components/Shells';
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
  }, [intentId, locale, setPlusFromServer, syncPlusFromServer]);

  return (
    <ConsumerStudioShell screenId="U08" title="Takolio Pro" backTo={vnextHref('/plus')}>
      <div className="mx-auto max-w-lg py-6">
        <div
          className="space-y-4 rounded-2xl border border-[var(--tkv-border,#DCE6DE)] bg-white p-6 shadow-sm"
          data-testid="dodo-billing-return-card"
          data-return-state={viewState}
        >
          {viewState === 'polling' && (
            <>
              <h1 className="tkv-heading text-xl font-bold text-[var(--tkv-ink,#152E2C)]">
                {catalog.common.loading}
              </h1>
              <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)]">
                {catalog.billing.merchantOfRecordNotice}
              </p>
            </>
          )}

          {viewState === 'paid' && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--tkv-primary,#196149)]">
                Takolio Pro Active
              </p>
              <h1 className="tkv-heading text-xl font-bold text-[var(--tkv-ink,#152E2C)]">
                {catalog.billing.upgradeTitle} — {catalog.common.confirm}
              </h1>
              {matchedPayment && (
                <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)]">
                  {matchedPayment.plan === 'annual' ? catalog.billing.annualPlan : catalog.billing.monthlyPlan} ·{' '}
                  {formatMoneyMinor(matchedPayment.amountMinor, matchedPayment.currency, locale)}
                </p>
              )}
              {account?.subscription.expiresAt && (
                <p className="text-xs text-[var(--tkv-ink-soft,#3C5954)]">
                  {new Date(account.subscription.expiresAt).toLocaleDateString(locale)}
                </p>
              )}
            </>
          )}

          {viewState === 'awaiting_async_payment' && (
            <>
              <h1 className="tkv-heading text-xl font-bold text-[var(--tkv-ink,#152E2C)]">
                {catalog.billing.upgradeTitle}
              </h1>
              <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)]">
                {catalog.billing.awaitingKonbiniNotice}
              </p>
            </>
          )}

          {viewState === 'pending_timeout' && (
            <>
              <h1 className="tkv-heading text-xl font-bold text-[var(--tkv-ink,#152E2C)]">
                {catalog.billing.upgradeTitle}
              </h1>
              <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)]">
                {catalog.billing.merchantOfRecordNotice}
              </p>
            </>
          )}

          {viewState === 'failed' && (
            <>
              <h1 className="tkv-heading text-xl font-bold text-[var(--tkv-danger-ink)]">
                {catalog.apiErrors.PAYMENT_PROVIDER_UNAVAILABLE}
              </h1>
              <p className="text-sm text-[var(--tkv-ink-soft,#3C5954)]">
                {catalog.common.retry}
              </p>
            </>
          )}

          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              to={vnextHref('/')}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--tkv-primary,#196149)] px-4 text-sm font-semibold text-white"
            >
              {catalog.nav.home}
            </Link>
            <Link
              to={vnextHref('/plus')}
              className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--tkv-border,#DCE6DE)] bg-white px-4 text-sm font-semibold text-[var(--tkv-ink,#152E2C)]"
            >
              {catalog.billing.openCustomerPortal}
            </Link>
          </div>
        </div>
      </div>
    </ConsumerStudioShell>
  );
};

export default BillingReturnPage;
