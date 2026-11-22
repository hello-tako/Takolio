// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  formatExpiryWithRegime,
  formatMoneyMinor,
  resetActiveUiLocaleForTests,
  setActiveUiLocale,
  TIER1_UI_LOCALES,
  translateApiError,
  UI_CATALOGS,
} from '../../src/web/i18n';
import {
  GlobalBarcodeScannerCard,
  GlobalDodoCheckoutCard,
  GlobalLanguageSwitcher,
  GlobalPrivacyAndResidencyCard,
  GlobalSocialAuthPanel,
} from '../../src/web/components/global/GlobalExperienceHub';
import { VoiceSousChef } from '../../src/web/lib/voice-chef';
import type { GlobalPlanDto } from '../../src/web/services/global-api';

// Vietnamese-exclusive diacritics (excludes plain â/ê/ô shared with French)
const VIETNAMESE_DIACRITIC_RE = /[ăđơưĂĐƠƯảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/u;
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mountedCleanups: Array<() => void> = [];

function mountUi(ui: React.ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  const unmount = () => {
    act(() => {
      root.unmount();
    });
    container.remove();
  };
  mountedCleanups.push(unmount);
  return {
    container,
    click: (el: Element | null) => {
      if (!el) throw new Error('Target element not found for click');
      act(() => {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
    },
    unmount,
  };
}

function collectDeepKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') {
      keys.push(...collectDeepKeys(v as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

describe('Workstream B — Tier-1 Frontend i18n, Zero-Vietnamese-Leakage Gate & Multilingual Voice Sous-Chef', () => {
  afterEach(() => {
    while (mountedCleanups.length > 0) {
      const cleanupFn = mountedCleanups.pop();
      cleanupFn?.();
    }
    resetActiveUiLocaleForTests();
    vi.restoreAllMocks();
  });

  it('enforces 100% key parity across en, ja, de, fr, vi and zero Vietnamese diacritics in en/ja/de/fr catalogs', () => {
    const enKeys = collectDeepKeys(UI_CATALOGS.en as unknown as Record<string, unknown>);
    for (const loc of TIER1_UI_LOCALES) {
      const locKeys = collectDeepKeys(UI_CATALOGS[loc] as unknown as Record<string, unknown>);
      expect(locKeys).toEqual(enKeys);
    }

    for (const intlLocale of ['en', 'ja', 'de', 'fr'] as const) {
      const serialized = JSON.stringify(UI_CATALOGS[intlLocale]);
      expect(VIETNAMESE_DIACRITIC_RE.test(serialized), `Leakage in ${intlLocale}`).toBe(false);
      expect(serialized).not.toContain('VND');
    }
  });

  it('renders Global Auth, Barcode, Dodo Checkout & GDPR Privacy surfaces in Japanese & German with ZERO Vietnamese leakage', () => {
    // 1. Japanese (`ja` / `JP` / `JPY` 0-decimal + Noto Sans JP font link + Tokushoho)
    setActiveUiLocale('ja');
    expect(document.documentElement.lang).toBe('ja');
    expect(document.getElementById('takolio-font-noto-sans-jp')).not.toBeNull();

    const jpPlans: GlobalPlanDto[] = [
      {
        plan: 'monthly',
        provider: 'dodo_mor',
        currency: 'JPY',
        amountMinor: 480,
        minorDigits: 0,
        taxRatePercent: 10,
        taxAmountMinor: 44,
        taxInclusive: true,
        taxLabel: '税込',
        paymentMethods: ['credit', 'apple_pay'],
      },
      {
        plan: 'annual',
        provider: 'dodo_mor',
        currency: 'JPY',
        amountMinor: 4800,
        minorDigits: 0,
        taxRatePercent: 10,
        taxAmountMinor: 436,
        taxInclusive: true,
        taxLabel: '税込',
        paymentMethods: ['credit', 'konbini'],
      },
    ];

    const { container: jpContainer, unmount: unmountJp } = mountUi(
      <div>
        <GlobalSocialAuthPanel locale="ja" />
        <GlobalBarcodeScannerCard
          locale="ja"
          onLookup={async () => ({ found: false, barcode: '4902777000008', symbology: 'JAN13' })}
          expiryPreview={{ date: '2026-11-25', regime: 'USE_BY' }}
        />
        <GlobalDodoCheckoutCard
          locale="ja"
          countryCode="JP"
          currency="JPY"
          plans={jpPlans}
          requiresEuWithdrawalWaiver={false}
          requiresTokushohoDisclosure={true}
          tokushohoUrl="https://jp.takolio.com/api/v1/billing/tokushoho"
          awaitingKonbini={true}
          canOpenCustomerPortal={true}
          onCheckout={() => {}}
        />
        <GlobalPrivacyAndResidencyCard
          locale="ja"
          activeCell="JP"
          aiVisionGranted={true}
          crossBorderGranted={true}
          onToggleConsent={() => {}}
          onExportData={() => {}}
          onConfirmDeleteAccount={() => {}}
        />
      </div>,
    );

    const jpText = jpContainer.textContent || '';
    expect(VIETNAMESE_DIACRITIC_RE.test(jpText)).toBe(false);
    expect(jpText).toContain('LINEでログイン');
    expect(jpText).toContain('特定商取引法に基づく表記');
    expect(jpText).toContain('消費期限');
    expect(jpText).toMatch(/[¥￥]4,800/);
    unmountJp();

    // 2. German (`de` / `DE` / `EUR` 2-decimal + mandatory EU 14-day withdrawal waiver checkbox gating)
    const onDeCheckout = vi.fn();
    const dePlans: GlobalPlanDto[] = [
      {
        plan: 'annual',
        provider: 'dodo_mor',
        currency: 'EUR',
        amountMinor: 4990,
        minorDigits: 2,
        taxRatePercent: 19,
        taxAmountMinor: 797,
        taxInclusive: true,
        taxLabel: 'Incl. 19% VAT',
        paymentMethods: ['credit', 'sepa_debit'],
      },
    ];

    const { container: deContainer, click } = mountUi(
      <div>
        <GlobalLanguageSwitcher locale="de" />
        <GlobalDodoCheckoutCard
          locale="de"
          countryCode="DE"
          currency="EUR"
          plans={dePlans}
          requiresEuWithdrawalWaiver={true}
          requiresTokushohoDisclosure={false}
          onCheckout={onDeCheckout}
        />
      </div>,
    );

    // Strip the language switcher's native "Tiếng Việt" option label before checking German UI copy
    const checkoutSectionText = deContainer.querySelector('section')?.textContent || '';
    expect(VIETNAMESE_DIACRITIC_RE.test(checkoutSectionText)).toBe(false);
    expect(checkoutSectionText).toContain('49,90');

    const checkoutBtn = Array.from(deContainer.querySelectorAll('button')).find((b) =>
      /Weiter zur sicheren Zahlung/i.test(b.textContent || ''),
    ) as HTMLButtonElement | undefined;
    expect(checkoutBtn).toBeDefined();
    // Disabled until EU 14-day withdrawal waiver checkbox is ticked!
    expect(checkoutBtn!.disabled).toBe(true);
    const waiverCheckbox = deContainer.querySelector('input[type="checkbox"]');
    click(waiverCheckbox);
    expect(checkoutBtn!.disabled).toBe(false);
    click(checkoutBtn!);
    expect(onDeCheckout).toHaveBeenCalledWith({ plan: 'annual', euWithdrawalWaiverAccepted: true });
  });

  it('formats multi-currency minor units, dual-expiry badges, and error codes without Vietnamese fallback', () => {
    expect(formatMoneyMinor(480, 'JPY', 'ja')).toMatch(/[¥￥]480/);
    expect(formatMoneyMinor(499, 'EUR', 'de')).toContain('4,99');
    expect(formatMoneyMinor(449, 'GBP', 'en')).toContain('4.49');

    const mhd = formatExpiryWithRegime('2026-11-30', 'BEST_BEFORE', 'de');
    expect(mhd.regimeLabel).toContain('Mindestens haltbar bis');
    expect(mhd.severity).toBe('warning');

    expect(translateApiError({ code: 'EU_WITHDRAWAL_WAIVER_REQUIRED' }, 'fr')).toContain('14 jours');
    // Unknown Tier-2 locale (`sv`) falls back cleanly to English (`en`), NEVER Vietnamese!
    const svFallback = translateApiError({ code: 'UNAUTHORIZED' }, 'sv');
    expect(svFallback).toBe('Please sign in to continue.');
    expect(VIETNAMESE_DIACRITIC_RE.test(svFallback)).toBe(false);
  });

  it('recognizes Japanese (`ja-JP`) and German (`de-DE`) hands-free Voice Sous-Chef commands', () => {
    interface MockSpeechResultEvent {
      results: Array<Array<{ transcript: string }>>;
    }
    let instance: MockSpeechRecognition | null = null;
    class MockSpeechRecognition {
      lang = '';
      continuous = false;
      interimResults = false;
      onresult: ((ev: MockSpeechResultEvent) => void) | null = null;
      onerror: ((ev: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      start() {
        instance = this;
      }
      stop() {}
    }
    (window as unknown as { SpeechRecognition: typeof MockSpeechRecognition }).SpeechRecognition =
      MockSpeechRecognition;

    const chef = new VoiceSousChef();
    const onNext = vi.fn();
    const onRepeat = vi.fn();
    const onPause = vi.fn();

    // 1. Japanese (`ja-JP`) voice recognition
    const stopJa = chef.startListening({ onNext, onRepeat, onPauseTimer: onPause }, 'ja');
    expect(instance).not.toBeNull();
    expect(instance!.lang).toBe('ja-JP');
    instance!.onresult?.({ results: [[{ transcript: 'もう一回読んで' }]] });
    expect(onRepeat).toHaveBeenCalledTimes(1);
    instance!.onresult?.({ results: [[{ transcript: '次へ進んで' }]] });
    expect(onNext).toHaveBeenCalledTimes(1);
    stopJa();

    // 2. German (`de-DE`) voice recognition
    const stopDe = chef.startListening({ onNext, onRepeat, onPauseTimer: onPause }, 'de');
    expect(instance!.lang).toBe('de-DE');
    instance!.onresult?.({ results: [[{ transcript: 'Timer pausieren bitte' }]] });
    expect(onPause).toHaveBeenCalledTimes(1);
    stopDe();
  });
});
