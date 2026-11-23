import React, { useCallback, useEffect, useState } from 'react';
import { formatMoneyMinor, useUiTranslation, type Tier1UiLocale } from '../../i18n';
import {
  cancelGlobalSubscription,
  createGlobalDodoCheckout,
  fetchGlobalBillingAccount,
  fetchGlobalPlans,
  openDodoCustomerPortal,
  type GlobalBillingAccountResponse,
  type GlobalBillingPaymentDto,
  type GlobalCatalogResponse,
} from '../../services/global-api';
import { VNextIcon } from '../../vnext/components/VNextIcons';
import { GlobalDodoCheckoutCard } from './GlobalExperienceHub';

const GLOBAL_MARKET_PILLS = [
  { code: 'JP', short: 'JPY ¥', aria: 'Japan (JPY)' },
  { code: 'DE', short: 'EUR €', aria: 'Europe (EUR)' },
  { code: 'GB', short: 'GBP £', aria: 'United Kingdom (GBP)' },
  { code: 'US', short: 'USD $', aria: 'Global (USD)' },
] as const;

function normalizeGlobalMarket(code?: string): string | undefined {
  if (!code) return undefined;
  const upper = code.trim().toUpperCase();
  if (upper === 'JP' || upper === 'DE' || upper === 'FR' || upper === 'GB' || upper === 'US') {
    return upper;
  }
  return undefined;
}

export interface GlobalDodoBillingPanelProps {
  locale?: Tier1UiLocale;
  initialCountryCode?: string;
  initialPlan?: 'monthly' | 'annual';
  onDetectedProvider?: (provider: 'dodo_mor' | 'payos_vn', countryCode: string) => void;
}

export const GlobalDodoBillingPanel: React.FC<GlobalDodoBillingPanelProps> = ({
  locale: explicitLocale,
  initialCountryCode,
  initialPlan = 'annual',
  onDetectedProvider,
}) => {
  const { locale, catalog: uiCatalog } = useUiTranslation(explicitLocale);
  const normalizedInitial = normalizeGlobalMarket(initialCountryCode);
  const [selectedCountry, setSelectedCountry] = useState<string>(normalizedInitial ?? 'US');
  const [plansResp, setPlansResp] = useState<GlobalCatalogResponse | null>(null);
  const [accountResp, setAccountResp] = useState<GlobalBillingAccountResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<'checkout' | 'portal' | 'cancel' | null>(null);
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const loadBillingData = useCallback(
    async (countryOverride?: string) => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const [plans, account] = await Promise.all([
          fetchGlobalPlans(countryOverride, locale),
          fetchGlobalBillingAccount(locale),
        ]);
        if (!countryOverride && plans.catalog.provider === 'payos_vn') {
          onDetectedProvider?.('payos_vn', plans.catalog.countryCode);
          const intlPlans = await fetchGlobalPlans('US', locale);
          setSelectedCountry('US');
          setPlansResp(intlPlans);
        } else {
          if (!countryOverride) {
            onDetectedProvider?.(plans.catalog.provider, plans.catalog.countryCode);
            setSelectedCountry(plans.catalog.countryCode);
          }
          setPlansResp(plans);
        }
        setAccountResp(account);
      } catch {
        setErrorMessage(uiCatalog.apiErrors.PAYMENT_PROVIDER_UNAVAILABLE);
      } finally {
        setLoading(false);
      }
    },
    [locale, onDetectedProvider, uiCatalog.apiErrors.PAYMENT_PROVIDER_UNAVAILABLE],
  );

  useEffect(() => {
    void loadBillingData(normalizedInitial);
  }, [normalizedInitial, loadBillingData]);

  const handleCountryChange = (nextCountry: string) => {
    setSelectedCountry(nextCountry);
    void loadBillingData(nextCountry);
  };

  const handleCheckout = async (selection: { plan: 'monthly' | 'annual'; euWithdrawalWaiverAccepted: boolean }) => {
    setBusyAction('checkout');
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const result = await createGlobalDodoCheckout({
        plan: selection.plan,
        countryCode: selectedCountry,
        euWithdrawalWaiverAccepted: selection.euWithdrawalWaiverAccepted,
        locale,
      });
      if (result.intent.checkoutUrl) {
        window.location.assign(result.intent.checkoutUrl);
        return;
      }
      setErrorMessage(uiCatalog.apiErrors.PAYMENT_PROVIDER_UNAVAILABLE);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('EU_WITHDRAWAL_WAIVER_REQUIRED')) {
        setErrorMessage(uiCatalog.apiErrors.EU_WITHDRAWAL_WAIVER_REQUIRED);
      } else if (msg.includes('PAYMENT_UNAVAILABLE')) {
        setErrorMessage(uiCatalog.apiErrors.PAYMENT_UNAVAILABLE);
      } else {
        setErrorMessage(uiCatalog.apiErrors.PAYMENT_PROVIDER_UNAVAILABLE);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleOpenPortal = async () => {
    setBusyAction('portal');
    setErrorMessage(null);
    try {
      const result = await openDodoCustomerPortal();
      if (result.portalUrl) {
        window.location.assign(result.portalUrl);
        return;
      }
      setErrorMessage(uiCatalog.apiErrors.PAYMENT_PROVIDER_UNAVAILABLE);
    } catch {
      setErrorMessage(uiCatalog.apiErrors.PAYMENT_PROVIDER_UNAVAILABLE);
    } finally {
      setBusyAction(null);
    }
  };

  const handleConfirmCancelAutoRenew = async () => {
    setBusyAction('cancel');
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await cancelGlobalSubscription();
      setConfirmCancelOpen(false);
      setStatusMessage(uiCatalog.billing.cancelScheduledNotice);
      await loadBillingData(selectedCountry);
    } catch {
      setErrorMessage(uiCatalog.apiErrors.PAYMENT_PROVIDER_UNAVAILABLE);
    } finally {
      setBusyAction(null);
    }
  };

  const statusLabelFor = (status: GlobalBillingPaymentDto['status']): string => {
    switch (status) {
      case 'paid':
        return uiCatalog.billing.statusPaid;
      case 'pending':
        return uiCatalog.billing.statusPending;
      case 'awaiting_async_payment':
        return uiCatalog.billing.statusAwaitingAsync;
      case 'failed':
        return uiCatalog.billing.statusFailed;
      case 'expired':
        return uiCatalog.billing.statusExpired;
      case 'refunded':
        return uiCatalog.billing.statusRefunded;
    }
  };

  if (loading && !plansResp) {
    return (
      <div
        className="space-y-4 rounded-[24px] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-6 shadow-[var(--tkv-shadow-card)]"
        data-testid="dodo-billing-loading"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="h-5 w-32 animate-pulse rounded-full bg-[var(--tkv-surface-subtle)]" />
          <div className="h-8 w-44 animate-pulse rounded-full bg-[var(--tkv-surface-subtle)]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="h-28 animate-pulse rounded-2xl bg-[var(--tkv-surface-subtle)]" />
          <div className="h-28 animate-pulse rounded-2xl bg-[var(--tkv-surface-subtle)]" />
        </div>
        <div className="h-12 w-full animate-pulse rounded-full bg-[var(--tkv-surface-subtle)]" />
      </div>
    );
  }

  const regionalCatalog = plansResp?.catalog;
  const sub = accountResp?.subscription;
  const dodoConfigured = plansResp?.dodoConfigured ?? accountResp?.dodoConfigured ?? true;
  const awaitingKonbini = Boolean(accountResp?.payments.some((p) => p.status === 'awaiting_async_payment'));
  const hasActionableHistory = Boolean(
    accountResp?.payments.some((p) => p.status === 'pending' || p.status === 'awaiting_async_payment'),
  );
  const perks = [
    uiCatalog.billing.perk1,
    uiCatalog.billing.perk2,
    uiCatalog.billing.perk3,
    uiCatalog.billing.perk4,
  ];

  return (
    <div className="space-y-5" data-testid="global-dodo-billing-panel">
      {/* Active Pro Membership Card */}
      {sub?.isPlus && (
        <section
          className="rounded-[24px] border border-[var(--tkv-border-mint)] bg-[var(--tkv-surface-mint)] p-5 shadow-[var(--tkv-shadow-card)]"
          data-testid="dodo-active-subscription-banner"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tkv-border-mint)] bg-[var(--tkv-surface)] px-3 py-1 text-xs font-extrabold text-[var(--tkv-success-ink)]">
                <VNextIcon name="crown" size={14} className="text-[var(--tkv-warning)]" />
                <span>{sub.status === 'past_due' ? uiCatalog.billing.pastDueBadge : uiCatalog.billing.activeBadge}</span>
              </span>
              {sub.expiresAt && (
                <p className="pt-1 text-xs font-medium text-[var(--tkv-ink-secondary)]">
                  {sub.cancelAtPeriodEnd ? uiCatalog.billing.endsOnLabel : uiCatalog.billing.renewsUntilLabel}:{' '}
                  <strong className="text-[var(--tkv-ink)]">
                    {new Date(sub.expiresAt).toLocaleDateString(locale, { dateStyle: 'medium' })}
                  </strong>
                </p>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2.5">
            {sub.canOpenCustomerPortal && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void handleOpenPortal()}
                className="tkv-focusable tkv-tactile inline-flex min-h-[44px] items-center justify-center rounded-full bg-[var(--tkv-primary)] px-4 py-2 text-xs sm:text-sm font-extrabold text-white shadow-[var(--tkv-shadow-cta)] hover:bg-[var(--tkv-primary-cta-hover)] disabled:opacity-50"
              >
                {uiCatalog.billing.openCustomerPortal}
              </button>
            )}
            {sub.provider === 'dodo_mor' && !sub.cancelAtPeriodEnd && !confirmCancelOpen && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => setConfirmCancelOpen(true)}
                className="tkv-focusable inline-flex min-h-[44px] items-center justify-center rounded-full border border-[var(--tkv-border-mint)] bg-[var(--tkv-surface)] px-4 py-2 text-xs font-bold text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-ink)] disabled:opacity-50"
              >
                {uiCatalog.billing.cancelAtPeriodEndAction}
              </button>
            )}
          </div>

          {confirmCancelOpen && (
            <div className="mt-3 space-y-3 rounded-2xl border border-[var(--tkv-border-saffron)] bg-[var(--tkv-surface)] p-4">
              <p className="text-xs leading-relaxed text-[var(--tkv-ink)]">
                {uiCatalog.billing.cancelConfirmPrompt}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyAction === 'cancel'}
                  onClick={() => void handleConfirmCancelAutoRenew()}
                  className="tkv-focusable inline-flex min-h-[40px] items-center justify-center rounded-full bg-[var(--tkv-danger)] px-4 text-xs font-bold text-white disabled:opacity-50"
                >
                  {uiCatalog.billing.cancelConfirmYes}
                </button>
                <button
                  type="button"
                  disabled={busyAction === 'cancel'}
                  onClick={() => setConfirmCancelOpen(false)}
                  className="tkv-focusable inline-flex min-h-[40px] items-center justify-center rounded-full border border-[var(--tkv-border)] bg-[var(--tkv-surface)] px-4 text-xs font-bold text-[var(--tkv-ink)]"
                >
                  {uiCatalog.billing.cancelConfirmKeep}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Main Checkout Ceramic Card */}
      <section className="space-y-5 rounded-[24px] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-5 sm:p-6 shadow-[var(--tkv-shadow-card)]">
        {/* Compact Currency Pill Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink-muted)]">
            {uiCatalog.billing.marketLabel}
          </span>
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={uiCatalog.billing.marketLabel}>
            {GLOBAL_MARKET_PILLS.map((m) => {
              const active =
                selectedCountry === m.code ||
                (m.code === 'DE' && (selectedCountry === 'FR' || selectedCountry === 'NL' || selectedCountry === 'IT' || selectedCountry === 'ES'));
              return (
                <button
                  key={m.code}
                  type="button"
                  aria-pressed={active}
                  aria-label={m.aria}
                  onClick={() => handleCountryChange(m.code)}
                  className={[
                    'tkv-focusable min-h-[36px] rounded-full px-3 text-xs font-bold transition-colors',
                    active
                      ? 'bg-[var(--tkv-primary)] text-white shadow-xs'
                      : 'border border-[var(--tkv-border)] bg-[var(--tkv-bg)] text-[var(--tkv-ink-secondary)] hover:border-[var(--tkv-border-strong)] hover:text-[var(--tkv-ink)]',
                  ].join(' ')}
                >
                  {m.short}
                </button>
              );
            })}
          </div>
        </div>

        {!dodoConfigured && (
          <div
            role="status"
            className="rounded-2xl border border-[var(--tkv-border-saffron)] bg-[var(--tkv-surface-saffron)] px-4 py-3 text-xs font-semibold text-[var(--tkv-warning-ink)]"
            data-testid="dodo-unconfigured-notice"
          >
            {uiCatalog.apiErrors.PAYMENT_UNAVAILABLE}
          </div>
        )}

        {errorMessage && (
          <p
            role="alert"
            className="rounded-2xl border border-[var(--tkv-border-danger)] bg-[var(--tkv-surface-danger)] px-4 py-3 text-xs font-semibold text-[var(--tkv-danger-ink)]"
          >
            {errorMessage}
          </p>
        )}

        {statusMessage && (
          <p
            role="status"
            className="rounded-2xl border border-[var(--tkv-border-mint)] bg-[var(--tkv-surface-mint)] px-4 py-3 text-xs font-semibold text-[var(--tkv-success-ink)]"
          >
            {statusMessage}
          </p>
        )}

        {regionalCatalog && regionalCatalog.provider === 'dodo_mor' && (
          <div className={!dodoConfigured ? 'pointer-events-none opacity-60' : ''}>
            <GlobalDodoCheckoutCard
              locale={locale}
              countryCode={regionalCatalog.countryCode}
              currency={regionalCatalog.currency}
              plans={regionalCatalog.plans}
              initialPlan={initialPlan}
              isSubmitting={busyAction === 'checkout'}
              requiresEuWithdrawalWaiver={regionalCatalog.requiresEuWithdrawalWaiver}
              requiresTokushohoDisclosure={regionalCatalog.requiresTokushohoDisclosure}
              tokushohoUrl={regionalCatalog.tokushohoUrl}
              awaitingKonbini={awaitingKonbini}
              canOpenCustomerPortal={Boolean(sub?.canOpenCustomerPortal && !sub.isPlus)}
              onCheckout={(selection) => void handleCheckout(selection)}
              onOpenPortal={() => void handleOpenPortal()}
            />
          </div>
        )}
      </section>

      {/* Concise 4-Benefit Pro Value Card */}
      <section className="rounded-[24px] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-5 shadow-[var(--tkv-shadow-card)]">
        <h3 className="tkv-heading text-sm font-extrabold text-[var(--tkv-ink)] mb-3">
          {uiCatalog.billing.perksTitle}
        </h3>
        <ul className="space-y-2.5">
          {perks.map((perk) => (
            <li key={perk} className="flex items-start gap-2.5 text-xs sm:text-sm text-[var(--tkv-ink-secondary)]">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--tkv-border-mint)] bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)]">
                <VNextIcon name="check" size={12} />
              </span>
              <span className="leading-relaxed">{perk}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Quiet Collapsible Billing History */}
      {accountResp && accountResp.payments.length > 0 && (
        <details
          open={hasActionableHistory}
          className="group rounded-[24px] border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-5 shadow-[var(--tkv-shadow-card)]"
        >
          <summary className="cursor-pointer list-none flex items-center justify-between gap-2 text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink-secondary)]">
            <span>
              {uiCatalog.billing.historyLabel} ({accountResp.payments.length})
            </span>
            <VNextIcon
              name="chevron-right"
              size={16}
              className="text-[var(--tkv-ink-muted)] transition-transform group-open:rotate-90"
            />
          </summary>
          <ul className="mt-3 space-y-2 text-xs">
            {accountResp.payments.slice(0, 5).map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] px-3.5 py-2.5"
              >
                <div className="space-y-0.5">
                  <p className="font-bold text-[var(--tkv-ink)]">
                    {p.plan === 'annual' ? uiCatalog.billing.annualPlan : uiCatalog.billing.monthlyPlan} ·{' '}
                    <span className="tabular-nums">{formatMoneyMinor(p.amountMinor, p.currency, locale)}</span>
                  </p>
                  <p className="text-[11px] text-[var(--tkv-ink-muted)]">
                    {new Date(p.createdAt).toLocaleDateString(locale, { dateStyle: 'medium' })}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={[
                      'rounded-full px-2.5 py-0.5 text-[11px] font-bold',
                      p.status === 'paid'
                        ? 'bg-[var(--tkv-surface-mint)] text-[var(--tkv-success-ink)]'
                        : p.status === 'failed' || p.status === 'expired'
                          ? 'bg-[var(--tkv-surface-danger)] text-[var(--tkv-danger-ink)]'
                          : 'bg-[var(--tkv-surface-saffron)] text-[var(--tkv-warning-ink)]',
                    ].join(' ')}
                  >
                    {statusLabelFor(p.status)}
                  </span>
                  {p.status === 'pending' && p.checkoutUrl && (
                    <a
                      href={p.checkoutUrl}
                      className="font-bold text-[var(--tkv-primary)] underline underline-offset-2"
                    >
                      {uiCatalog.billing.resumePaymentAction}
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};
