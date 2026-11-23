import React, { useCallback, useEffect, useState } from 'react';
import { formatMoneyMinor, useUiTranslation, type Tier1UiLocale } from '../../i18n';
import {
  cancelGlobalSubscription,
  createGlobalDodoCheckout,
  fetchGlobalBillingAccount,
  fetchGlobalPlans,
  openDodoCustomerPortal,
  type GlobalBillingAccountResponse,
  type GlobalCatalogResponse,
} from '../../services/global-api';
import { GlobalDodoCheckoutCard } from './GlobalExperienceHub';

const GLOBAL_MARKET_OPTIONS = [
  { code: 'JP', label: 'Japan (JPY ¥)' },
  { code: 'DE', label: 'Europe / Germany (EUR €)' },
  { code: 'FR', label: 'France (EUR €)' },
  { code: 'GB', label: 'United Kingdom (GBP £)' },
  { code: 'US', label: 'Global / US (USD $)' },
] as const;

export interface GlobalDodoBillingPanelProps {
  locale?: Tier1UiLocale;
  initialCountryCode?: string;
  onDetectedProvider?: (provider: 'dodo_mor' | 'payos_vn', countryCode: string) => void;
}

export const GlobalDodoBillingPanel: React.FC<GlobalDodoBillingPanelProps> = ({
  locale: explicitLocale,
  initialCountryCode,
  onDetectedProvider,
}) => {
  const { locale, catalog: uiCatalog } = useUiTranslation(explicitLocale);
  const [selectedCountry, setSelectedCountry] = useState<string>(initialCountryCode ?? 'US');
  const [plansResp, setPlansResp] = useState<GlobalCatalogResponse | null>(null);
  const [accountResp, setAccountResp] = useState<GlobalBillingAccountResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<'checkout' | 'portal' | 'cancel' | null>(null);
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
          // Load USD international catalog so Dodo tab always displays concrete international offers.
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
    void loadBillingData(initialCountryCode);
  }, [initialCountryCode, loadBillingData]);

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

  const handleCancelAutoRenew = async () => {
    setBusyAction('cancel');
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await cancelGlobalSubscription();
      setStatusMessage(uiCatalog.billing.cancelAtPeriodEndAction);
      await loadBillingData(selectedCountry);
    } catch {
      setErrorMessage(uiCatalog.apiErrors.PAYMENT_PROVIDER_UNAVAILABLE);
    } finally {
      setBusyAction(null);
    }
  };

  if (loading && !plansResp) {
    return (
      <div
        className="rounded-2xl border border-[var(--tkv-border,#DCE6DE)] bg-white p-5 text-sm text-[var(--tkv-ink-soft,#3C5954)]"
        data-testid="dodo-billing-loading"
      >
        {uiCatalog.common.loading}
      </div>
    );
  }

  const regionalCatalog = plansResp?.catalog;
  const sub = accountResp?.subscription;
  const dodoConfigured = plansResp?.dodoConfigured ?? accountResp?.dodoConfigured ?? true;
  const awaitingKonbini = Boolean(accountResp?.payments.some((p) => p.status === 'awaiting_async_payment'));

  return (
    <div
      className="space-y-4 rounded-2xl border border-[var(--tkv-border,#DCE6DE)] bg-white p-5 shadow-sm"
      data-testid="global-dodo-billing-panel"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--tkv-border,#DCE6DE)] pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--tkv-primary,#196149)]">
            Dodo Payments · Merchant of Record
          </p>
          <p className="text-xs text-[var(--tkv-ink-soft,#3C5954)]">
            Visa / Mastercard / JCB / Amex · Apple Pay · Google Pay · SEPA · Amazon Pay
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-[var(--tkv-ink,#152E2C)]">
          <span>Region</span>
          <select
            aria-label="Billing region"
            value={selectedCountry}
            onChange={(e) => handleCountryChange(e.target.value)}
            className="min-h-[38px] rounded-xl border border-[var(--tkv-border,#DCE6DE)] bg-[var(--tkv-surface-alt,#FBF8F3)] px-2.5 text-xs font-semibold text-[var(--tkv-ink,#152E2C)]"
          >
            {GLOBAL_MARKET_OPTIONS.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {sub?.isPlus && (
        <div
          className="rounded-xl border border-[var(--tkv-border-mint)] bg-[var(--tkv-surface-mint)] p-3.5 text-sm text-[var(--tkv-success-ink)]"
          data-testid="dodo-active-subscription-banner"
        >
          <p className="font-semibold">
            Takolio Pro ({sub.status === 'past_due' ? 'Past Due — Grace Period' : 'Active'})
          </p>
          {sub.expiresAt && (
            <p className="mt-0.5 text-xs opacity-80">
              {sub.cancelAtPeriodEnd ? 'Ends on: ' : 'Renews / valid until: '}
              {new Date(sub.expiresAt).toLocaleDateString(locale)}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {sub.canOpenCustomerPortal && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void handleOpenPortal()}
                className="min-h-[40px] rounded-xl bg-[var(--tkv-primary)] px-3.5 text-xs font-semibold text-white hover:opacity-95 disabled:opacity-50"
              >
                {uiCatalog.billing.openCustomerPortal}
              </button>
            )}
            {sub.provider === 'dodo_mor' && !sub.cancelAtPeriodEnd && (
              <button
                type="button"
                disabled={busyAction !== null}
                onClick={() => void handleCancelAutoRenew()}
                className="min-h-[40px] rounded-xl border border-[var(--tkv-border-mint)] bg-[var(--tkv-surface)] px-3.5 text-xs font-semibold text-[var(--tkv-success-ink)] hover:bg-[var(--tkv-surface-subtle-hover)] disabled:opacity-50"
              >
                {uiCatalog.billing.cancelAtPeriodEndAction}
              </button>
            )}
          </div>
        </div>
      )}

      {!dodoConfigured && (
        <div
          role="status"
          className="rounded-xl border border-[var(--tkv-border-saffron)] bg-[var(--tkv-surface-saffron)] p-3 text-xs text-[var(--tkv-warning-ink)]"
          data-testid="dodo-unconfigured-notice"
        >
          {uiCatalog.apiErrors.PAYMENT_UNAVAILABLE}
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="rounded-xl border border-[var(--tkv-border-danger)] bg-[var(--tkv-surface-danger)] px-3 py-2 text-xs text-[var(--tkv-danger-ink)]">
          {errorMessage}
        </p>
      )}

      {statusMessage && (
        <p role="status" className="rounded-xl border border-[var(--tkv-border-mint)] bg-[var(--tkv-surface-mint)] px-3 py-2 text-xs text-[var(--tkv-success-ink)]">
          {statusMessage}
        </p>
      )}

      {regionalCatalog && regionalCatalog.provider === 'dodo_mor' && (
        <div className={busyAction === 'checkout' || !dodoConfigured ? 'pointer-events-none opacity-60' : ''}>
          <GlobalDodoCheckoutCard
            locale={locale}
            countryCode={regionalCatalog.countryCode}
            currency={regionalCatalog.currency}
            plans={regionalCatalog.plans}
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

      {accountResp && accountResp.payments.length > 0 && (
        <div className="border-t border-[var(--tkv-border,#DCE6DE)] pt-3">
          <p className="mb-2 text-xs font-semibold text-[var(--tkv-ink,#152E2C)]">Recent global payments</p>
          <ul className="space-y-1.5 text-xs text-[var(--tkv-ink-soft,#3C5954)]">
            {accountResp.payments.slice(0, 5).map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--tkv-surface-alt,#FBF8F3)] px-3 py-2"
              >
                <span className="font-medium text-[var(--tkv-ink,#152E2C)]">
                  {p.plan === 'annual' ? uiCatalog.billing.annualPlan : uiCatalog.billing.monthlyPlan} ·{' '}
                  {formatMoneyMinor(p.amountMinor, p.currency, locale)}
                </span>
                <span className="flex items-center gap-2">
                  <span className="uppercase">{p.status}</span>
                  {p.status === 'pending' && p.checkoutUrl && (
                    <a
                      href={p.checkoutUrl}
                      className="font-semibold text-[var(--tkv-primary,#196149)] underline"
                    >
                      Resume
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
