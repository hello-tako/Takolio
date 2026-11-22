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
  requiresEuWithdrawalWaiver: boolean;
  requiresTokushohoDisclosure: boolean;
  tokushohoUrl?: string | null;
  awaitingKonbini?: boolean;
  canOpenCustomerPortal?: boolean;
  onCheckout: (selection: { plan: 'monthly' | 'annual'; euWithdrawalWaiverAccepted: boolean }) => void;
  onOpenPortal?: () => void;
}) {
  const { locale, catalog } = useUiTranslation(props.locale);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [waiverAccepted, setWaiverAccepted] = useState(false);

  const canProceed = !props.requiresEuWithdrawalWaiver || waiverAccepted;

  return (
    <section aria-label={catalog.billing.upgradeTitle} style={{ display: 'grid', gap: '12px', maxWidth: '100%' }}>
      <h3>{catalog.billing.upgradeTitle}</h3>
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{catalog.billing.merchantOfRecordNotice}</p>

      <div style={{ display: 'grid', gap: '8px' }}>
        {props.plans.map((offer) => {
          const label = offer.plan === 'annual' ? catalog.billing.annualPlan : catalog.billing.monthlyPlan;
          const formattedPrice = formatMoneyMinor(offer.amountMinor, props.currency, locale);
          return (
            <label
              key={offer.plan}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}
            >
              <span>
                <input
                  type="radio"
                  name="takolio-global-plan"
                  checked={selectedPlan === offer.plan}
                  onChange={() => setSelectedPlan(offer.plan)}
                />{' '}
                {label}
              </span>
              <strong>{formattedPrice}</strong>
            </label>
          );
        })}
      </div>

      {props.requiresEuWithdrawalWaiver && (
        <label style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '0.88rem' }}>
          <input
            type="checkbox"
            checked={waiverAccepted}
            onChange={(e) => setWaiverAccepted(e.target.checked)}
          />
          <span>{catalog.billing.euWithdrawalWaiverCheckbox}</span>
        </label>
      )}

      {props.awaitingKonbini && (
        <p role="status">{catalog.billing.awaitingKonbiniNotice}</p>
      )}

      <button
        type="button"
        disabled={!canProceed}
        onClick={() => props.onCheckout({ plan: selectedPlan, euWithdrawalWaiverAccepted: waiverAccepted })}
        style={{ width: '100%', minHeight: '44px', wordBreak: 'break-word' }}
      >
        {catalog.billing.checkoutAction}
      </button>

      {props.canOpenCustomerPortal && (
        <button
          type="button"
          onClick={props.onOpenPortal}
          style={{ width: '100%', minHeight: '44px', wordBreak: 'break-word' }}
        >
          {catalog.billing.openCustomerPortal}
        </button>
      )}

      {props.requiresTokushohoDisclosure && props.tokushohoUrl && (
        <a href={props.tokushohoUrl} target="_blank" rel="noreferrer">
          {catalog.billing.tokushohoLinkLabel}
        </a>
      )}
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
