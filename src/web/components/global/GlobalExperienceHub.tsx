import React, { useState } from 'react';
import type { GlobalCurrency } from '../../../../packages/domain/src/i18n';
import {
  formatExpiryWithRegime,
  formatMoneyMinor,
  TIER1_UI_LOCALES,
  UI_LOCALE_DISPLAY_NAMES,
  useUiTranslation,
  type Tier1UiLocale,
} from '../../i18n';
import type { BarcodeLookupResponse, GlobalPlanDto } from '../../services/global-api';

export function GlobalLanguageSwitcher(props: { locale?: Tier1UiLocale; onChange?: (next: Tier1UiLocale) => void }) {
  const { locale, catalog, setLocale } = useUiTranslation(props.locale);

  return (
    <div className="takolio-global-lang-switcher" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
      <label htmlFor="takolio-ui-locale-select">{catalog.common.languageLabel}</label>
      <select
        id="takolio-ui-locale-select"
        aria-label={catalog.common.languageLabel}
        value={locale}
        onChange={(e) => {
          const updated = setLocale(e.target.value);
          props.onChange?.(updated);
        }}
      >
        {TIER1_UI_LOCALES.map((code) => (
          <option key={code} value={code}>
            {UI_LOCALE_DISPLAY_NAMES[code]}
          </option>
        ))}
      </select>
    </div>
  );
}

export function GlobalSocialAuthPanel(props: {
  locale?: Tier1UiLocale;
  showLine?: boolean;
  onAppleClick?: () => void;
  onLineClick?: () => void;
}) {
  const { locale, catalog } = useUiTranslation(props.locale);
  const displayLine = props.showLine ?? locale === 'ja';

  return (
    <section aria-label="Social Authentication" style={{ display: 'grid', gap: '10px', maxWidth: '100%' }}>
      <button
        type="button"
        onClick={props.onAppleClick}
        style={{ width: '100%', minHeight: '44px', wordBreak: 'break-word' }}
      >
        {catalog.auth.continueWithApple}
      </button>
      {displayLine && (
        <button
          type="button"
          onClick={props.onLineClick}
          style={{ width: '100%', minHeight: '44px', wordBreak: 'break-word' }}
        >
          {catalog.auth.continueWithLine}
        </button>
      )}
      <p style={{ fontSize: '0.85rem', margin: 0 }}>{catalog.auth.privateRelayNotice}</p>
    </section>
  );
}

export function GlobalBarcodeScannerCard(props: {
  locale?: Tier1UiLocale;
  onLookup: (barcode: string) => Promise<BarcodeLookupResponse>;
  expiryPreview?: { date: string; regime: 'USE_BY' | 'BEST_BEFORE' };
}) {
  const { locale, catalog } = useUiTranslation(props.locale);
  const [barcode, setBarcode] = useState('');
  const [result, setResult] = useState<BarcodeLookupResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!/^\d{8,14}$/.test(barcode.trim())) {
      setErrorMsg(catalog.scanner.invalidBarcode);
      return;
    }
    try {
      const data = await props.onLookup(barcode.trim());
      setResult(data);
    } catch {
      setErrorMsg(catalog.scanner.invalidBarcode);
    }
  };

  const expiryBadge = props.expiryPreview
    ? formatExpiryWithRegime(props.expiryPreview.date, props.expiryPreview.regime, locale)
    : null;

  return (
    <section aria-label={catalog.scanner.scanBarcode} style={{ display: 'grid', gap: '12px', maxWidth: '100%' }}>
      <h3>{catalog.scanner.scanBarcode}</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <input
          type="text"
          inputMode="numeric"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          placeholder={catalog.scanner.barcodePlaceholder}
          aria-label={catalog.scanner.barcodePlaceholder}
          style={{ flex: '1 1 180px', minHeight: '44px' }}
        />
        <button type="submit" style={{ minHeight: '44px', wordBreak: 'break-word' }}>
          {catalog.scanner.barcodeLookupBtn}
        </button>
      </form>
      {errorMsg && <p role="alert">{errorMsg}</p>}
      {result && !result.found && <p>{catalog.scanner.barcodeNotFound}</p>}
      {result?.found && result.product && (
        <div data-testid="barcode-product-card">
          <strong>{result.product.productName}</strong>
          {result.product.nutriscoreGrade && (
            <div>
              {catalog.scanner.nutriscoreLabel}: {result.product.nutriscoreGrade.toUpperCase()}
            </div>
          )}
          <div>
            {catalog.fridge.compartments[result.product.storageZone]}
          </div>
          {result.product.allergenLabels.length > 0 && (
            <div>
              {catalog.scanner.allergensDetected}:{' '}
              {result.product.allergenLabels.map((a) => a.label).join(', ')}
            </div>
          )}
        </div>
      )}
      {expiryBadge && (
        <div data-testid="dual-expiry-badge" data-severity={expiryBadge.severity}>
          <span>{expiryBadge.regimeLabel}: </span>
          <time dateTime={props.expiryPreview?.date}>{expiryBadge.formattedDate}</time>
        </div>
      )}
    </section>
  );
}

export function GlobalDodoCheckoutCard(props: {
  locale?: Tier1UiLocale;
  countryCode: string;
  currency: GlobalCurrency;
  plans: GlobalPlanDto[];
  initialPlan?: 'monthly' | 'annual';
  isSubmitting?: boolean;
  requiresEuWithdrawalWaiver: boolean;
  requiresTokushohoDisclosure: boolean;
  tokushohoUrl?: string | null;
  awaitingKonbini?: boolean;
  canOpenCustomerPortal?: boolean;
  onCheckout: (selection: { plan: 'monthly' | 'annual'; euWithdrawalWaiverAccepted: boolean }) => void;
  onOpenPortal?: () => void;
}) {
  const { locale, catalog } = useUiTranslation(props.locale);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>(props.initialPlan ?? 'annual');
  const [waiverAccepted, setWaiverAccepted] = useState(false);

  const canProceed = (!props.requiresEuWithdrawalWaiver || waiverAccepted) && !props.isSubmitting;
  const activeOffer = props.plans.find((p) => p.plan === selectedPlan) ?? props.plans[0] ?? null;

  return (
    <section aria-label={catalog.billing.upgradeTitle} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label={catalog.billing.upgradeTitle}>
        {props.plans.map((offer) => {
          const isSelected = selectedPlan === offer.plan;
          const isAnnual = offer.plan === 'annual';
          const label = isAnnual ? catalog.billing.annualPlan : catalog.billing.monthlyPlan;
          const formattedPrice = formatMoneyMinor(offer.amountMinor, props.currency, locale);
          const monthlyEquivMinor = isAnnual ? Math.round(offer.amountMinor / 12) : offer.amountMinor;
          const monthlyEquivFormatted = formatMoneyMinor(monthlyEquivMinor, props.currency, locale);

          return (
            <label
              key={offer.plan}
              className={[
                'tkv-focusable tkv-tactile relative flex cursor-pointer flex-col justify-between gap-2 rounded-2xl p-4 transition-colors',
                isSelected
                  ? 'border-2 border-[var(--tkv-primary)] bg-[var(--tkv-surface-mint)] shadow-[var(--tkv-shadow-card)]'
                  : 'border border-[var(--tkv-border)] bg-[var(--tkv-surface)] hover:border-[var(--tkv-border-strong)]',
              ].join(' ')}
            >
              <input
                type="radio"
                name="takolio-global-plan"
                checked={isSelected}
                onChange={() => setSelectedPlan(offer.plan)}
                className="sr-only"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-[var(--tkv-ink-secondary)]">
                  <span
                    aria-hidden="true"
                    className={[
                      'inline-flex h-4 w-4 items-center justify-center rounded-full border-2',
                      isSelected ? 'border-[var(--tkv-primary)] bg-[var(--tkv-primary)]' : 'border-[var(--tkv-border-strong)] bg-[var(--tkv-surface)]',
                    ].join(' ')}
                  >
                    {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  {label}
                </span>
                {isAnnual && (
                  <span className="rounded-full border border-[var(--tkv-border-saffron)] bg-[var(--tkv-surface-saffron)] px-2.5 py-0.5 text-[11px] font-extrabold text-[var(--tkv-warning-ink)]">
                    {catalog.billing.savePercentBadge}
                  </span>
                )}
              </div>

              <div className="pt-1">
                <div className="flex items-baseline gap-1">
                  <strong className="tkv-heading tabular-nums text-2xl font-black text-[var(--tkv-ink)]">
                    {formattedPrice}
                  </strong>
                  <span className="text-xs font-semibold text-[var(--tkv-ink-muted)]">
                    {isAnnual ? catalog.billing.perYearSuffix : catalog.billing.perMonthSuffix}
                  </span>
                </div>
                <p className="mt-1 text-xs font-medium text-[var(--tkv-ink-secondary)]">
                  {isAnnual
                    ? `${monthlyEquivFormatted}${catalog.billing.perMonthSuffix} · ${catalog.billing.billedAnnuallyNote}`
                    : catalog.billing.billedMonthlyNote}
                </p>
              </div>
            </label>
          );
        })}
      </div>

      {activeOffer && (
        <p className="text-xs font-medium text-[var(--tkv-ink-muted)]">
          {activeOffer.taxLabel}
        </p>
      )}

      {props.requiresEuWithdrawalWaiver && (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--tkv-border-saffron)] bg-[var(--tkv-surface-saffron)] p-3.5 text-xs leading-relaxed text-[var(--tkv-ink)]">
          <input
            type="checkbox"
            checked={waiverAccepted}
            onChange={(e) => setWaiverAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-[var(--tkv-primary)]"
          />
          <span>{catalog.billing.euWithdrawalWaiverCheckbox}</span>
        </label>
      )}

      {props.awaitingKonbini && (
        <p
          role="status"
          className="rounded-2xl border border-[var(--tkv-border-saffron)] bg-[var(--tkv-surface-saffron)] px-4 py-3 text-xs font-semibold text-[var(--tkv-warning-ink)]"
        >
          {catalog.billing.awaitingKonbiniNotice}
        </p>
      )}

      <button
        type="button"
        disabled={!canProceed}
        onClick={() => props.onCheckout({ plan: selectedPlan, euWithdrawalWaiverAccepted: waiverAccepted })}
        className="tkv-focusable tkv-tactile flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full bg-[var(--tkv-primary)] px-6 py-3 text-sm sm:text-base font-extrabold text-white shadow-[var(--tkv-shadow-cta)] transition-colors hover:bg-[var(--tkv-primary-cta-hover)] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {props.isSubmitting ? catalog.billing.checkoutProcessing : catalog.billing.checkoutAction}
      </button>

      {props.canOpenCustomerPortal && (
        <button
          type="button"
          onClick={props.onOpenPortal}
          className="tkv-focusable tkv-tactile flex min-h-[46px] w-full items-center justify-center rounded-full border border-[var(--tkv-border-strong)] bg-[var(--tkv-surface)] px-5 py-2.5 text-sm font-bold text-[var(--tkv-ink)] transition-colors hover:bg-[var(--tkv-surface-subtle)]"
        >
          {catalog.billing.openCustomerPortal}
        </button>
      )}

      <div className="space-y-2 pt-1 text-center">
        <p className="text-[11px] font-medium text-[var(--tkv-ink-muted)]">
          {catalog.billing.paymentMethodsCaption}
        </p>
        <p className="text-[11px] leading-relaxed text-[var(--tkv-ink-muted)]">
          {catalog.billing.merchantOfRecordNotice}
        </p>
        {props.requiresTokushohoDisclosure && props.tokushohoUrl && (
          <p className="pt-0.5">
            <a
              href={props.tokushohoUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-bold text-[var(--tkv-primary)] underline underline-offset-2 hover:text-[var(--tkv-primary-hover)]"
            >
              {catalog.billing.tokushohoLinkLabel}
            </a>
          </p>
        )}
      </div>
    </section>
  );
}

export function GlobalPrivacyAndResidencyCard(props: {
  locale?: Tier1UiLocale;
  activeCell: 'EU' | 'JP' | 'VN' | 'GLOBAL';
  aiVisionGranted: boolean;
  crossBorderGranted: boolean;
  onToggleConsent: (type: 'ai_vision_processing' | 'cross_border_ai_transfer', granted: boolean) => void;
  onExportData: () => void;
  onConfirmDeleteAccount: () => void;
}) {
  const { catalog } = useUiTranslation(props.locale);
  const [confirmText, setConfirmText] = useState('');

  return (
    <section aria-label={catalog.privacy.title} style={{ display: 'grid', gap: '12px', maxWidth: '100%' }}>
      <h3>{catalog.privacy.title}</h3>
      <div>
        <span>{catalog.privacy.residencyLabel}: </span>
        <strong>{props.activeCell}</strong>
      </div>

      <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={props.aiVisionGranted}
          onChange={(e) => props.onToggleConsent('ai_vision_processing', e.target.checked)}
        />
        <span>{catalog.privacy.aiVisionConsentLabel}</span>
      </label>

      <label style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={props.crossBorderGranted}
          onChange={(e) => props.onToggleConsent('cross_border_ai_transfer', e.target.checked)}
        />
        <span>{catalog.privacy.crossBorderAiConsentLabel}</span>
      </label>

      <button
        type="button"
        onClick={props.onExportData}
        style={{ width: '100%', minHeight: '44px', wordBreak: 'break-word' }}
      >
        {catalog.privacy.exportDataAction}
      </button>

      <div style={{ display: 'grid', gap: '8px' }}>
        <label htmlFor="takolio-delete-confirm">{catalog.privacy.deleteConfirmPrompt}</label>
        <input
          id="takolio-delete-confirm"
          type="text"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={catalog.privacy.deleteConfirmPlaceholder}
          style={{ minHeight: '44px' }}
        />
        <button
          type="button"
          disabled={confirmText !== 'DELETE_MY_ACCOUNT'}
          onClick={props.onConfirmDeleteAccount}
          style={{ width: '100%', minHeight: '44px', wordBreak: 'break-word' }}
        >
          {catalog.privacy.deleteAccountAction}
        </button>
      </div>
    </section>
  );
}
