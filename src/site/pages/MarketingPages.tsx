import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { buildLocalizedPath, LOCALE_CATALOG, type SupportedLocale } from '../../shared/locales';
import {
  buildRegionalPriceReferences,
  defaultCurrencyForLocale,
  formatGlobalMinorCurrency,
  GLOBAL_DISPLAY_CURRENCIES,
  marketCodeForCurrency,
  type GlobalDisplayCurrency,
  type RegionalPriceReference,
} from '../../shared/global-pricing';
import { getSiteDictionary } from '../i18n/dictionaries';
import type { FeatureKey } from '../i18n/types';
import type { SiteSsrPayload } from '../types/ssr-data';
import { buildAppHandoffUrl, SatelliteShell } from '../components/SatelliteShell';

const DEFAULT_VND_PRICES = Object.freeze({ monthly: 49000, annual: 499000 });

export const HowItWorksPage: React.FC<{ locale: SupportedLocale }> = ({ locale }) => {
  const dict = getSiteDictionary(locale);
  const hw = dict.howItWorks;
  const lpath = (p: string) => buildLocalizedPath(locale, p);

  return (
    <SatelliteShell locale={locale} barePath="/how-it-works">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col gap-10">
        <header className="flex flex-col gap-3 max-w-3xl">
          <div>
            <span className="inline-flex items-center rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] px-3.5 py-1 text-xs font-extrabold text-[var(--tkv-primary)]">
              {hw.eyebrow}
            </span>
          </div>
          <h1 className="tkv-heading text-3xl sm:text-[2.6rem] font-black text-[var(--tkv-ink)] leading-tight">
            {hw.h1}
          </h1>
          <p className="text-base sm:text-lg text-[var(--tkv-ink-secondary)] leading-relaxed">{hw.subtitle}</p>
        </header>

        {/* Answer-First GEO Summary */}
        <section className="rounded-2xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] p-5 sm:p-6">
          <p className="tkv-heading text-xs uppercase tracking-wider font-extrabold text-[var(--tkv-primary)] mb-1.5">
            {hw.tldrLabel}
          </p>
          <p className="text-sm sm:text-base text-[var(--tkv-ink)] leading-relaxed font-medium">{hw.tldr}</p>
        </section>

        <div className="rounded-3xl overflow-hidden border border-[var(--tkv-border)] bg-white shadow-[var(--tkv-shadow-card)]">
          <img
            src="/takolio/vnext/marketing/m02-closed-loop-kitchen.webp"
            alt={hw.h1}
            width={1280}
            height={720}
            loading="eager"
            className="w-full max-h-[420px] object-cover"
          />
        </div>

        {/* 6 Connected Steps */}
        <section aria-labelledby="hw-loop-heading" className="flex flex-col gap-5">
          <h2 id="hw-loop-heading" className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
            {hw.loopHeading}
          </h2>
          <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hw.steps.map((step) => (
              <li key={step.num} className="tkv-bento-card p-5 flex flex-col justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <span className="tabular-nums text-xs font-black text-[var(--tkv-primary)] bg-[var(--tkv-surface-mint)] px-2.5 py-1 rounded-full self-start">
                    {step.num}
                  </span>
                  <h3 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">{step.title}</h3>
                  <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">{step.detail}</p>
                </div>
                <Link
                  to={lpath(step.to)}
                  className="text-xs font-extrabold text-[var(--tkv-primary)] hover:underline inline-flex items-center gap-1"
                >
                  <span>{dict.landing.explorePrefix}</span>
                  <span aria-hidden="true" className="rtl:rotate-180">→</span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        {/* Factual Comparison Table (GEO Gold Standard) */}
        <section aria-labelledby="hw-compare-heading" className="flex flex-col gap-4">
          <h2 id="hw-compare-heading" className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink)]">
            {hw.compareHeading}
          </h2>
          <div className="overflow-x-auto rounded-2xl border border-[var(--tkv-border)] bg-white shadow-[var(--tkv-shadow-card)]">
            <table className="w-full text-start border-collapse text-sm">
              <thead>
                <tr className="bg-[var(--tkv-surface-mint)] border-b border-[var(--tkv-border-mint)]">
                  <th className="p-4 text-start font-extrabold text-[var(--tkv-ink)]">{hw.compareColFeature}</th>
                  <th className="p-4 text-start font-extrabold text-[var(--tkv-ink-muted)]">{hw.compareColGeneric}</th>
                  <th className="p-4 text-start font-extrabold text-[var(--tkv-primary)]">{hw.compareColTakolio}</th>
                </tr>
              </thead>
              <tbody>
                {hw.compareRows.map((row) => (
                  <tr key={row.criterion} className="border-b border-[var(--tkv-border)] last:border-b-0">
                    <td className="p-4 font-bold text-[var(--tkv-ink)]">{row.criterion}</td>
                    <td className="p-4 text-[var(--tkv-ink-muted)]">{row.generic}</td>
                    <td className="p-4 font-semibold text-[var(--tkv-ink)] bg-[var(--tkv-surface-mint)]/35">{row.takolio}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="tkv-heading text-xl sm:text-2xl font-extrabold text-[var(--tkv-ink)]">{hw.ctaTitle}</h2>
          <a
            href={buildAppHandoffUrl('/auth?mode=guest', locale)}
            rel="nofollow"
            className="tkv-focusable min-h-[48px] px-6 py-2.5 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white font-extrabold text-sm inline-flex items-center justify-center shrink-0"
          >
            {hw.ctaButton}
          </a>
        </section>
      </div>
    </SatelliteShell>
  );
};

export const FeatureDetailPage: React.FC<{ locale: SupportedLocale; featureKey: FeatureKey }> = ({
  locale,
  featureKey,
}) => {
  const dict = getSiteDictionary(locale);
  const feat = dict.features[featureKey];
  const lpath = (p: string) => buildLocalizedPath(locale, p);

  return (
    <SatelliteShell locale={locale} barePath={feat.slug}>
      <article className="max-w-[1080px] mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col gap-9">
        <nav aria-label="Breadcrumb" className="text-xs font-bold text-[var(--tkv-ink-muted)] flex items-center gap-2">
          <Link to={lpath('/')} className="hover:text-[var(--tkv-primary)]">{dict.nav.home}</Link>
          <span aria-hidden="true">/</span>
          <Link to={lpath('/how-it-works')} className="hover:text-[var(--tkv-primary)]">{dict.nav.features}</Link>
          <span aria-hidden="true">/</span>
          <span className="text-[var(--tkv-ink)]">{feat.title}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-6 flex flex-col gap-4">
            <h1 className="tkv-heading text-3xl sm:text-[2.5rem] font-black text-[var(--tkv-ink)] leading-tight">
              {feat.h1}
            </h1>
            <p className="text-base sm:text-lg text-[var(--tkv-ink-secondary)] leading-relaxed">{feat.subtitle}</p>
            <div className="rounded-2xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] p-4">
              <p className="text-xs uppercase tracking-wider font-extrabold text-[var(--tkv-primary)] mb-1">
                {feat.tldrLabel}
              </p>
              <p className="text-sm text-[var(--tkv-ink)] leading-relaxed font-medium">{feat.tldr}</p>
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              <a
                href={buildAppHandoffUrl('/auth?mode=guest', locale)}
                rel="nofollow"
                className="tkv-focusable min-h-[48px] px-6 py-2.5 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white font-extrabold text-sm inline-flex items-center justify-center"
              >
                {dict.nav.startFree}
              </a>
              {featureKey === 'recipes' && (
                <Link
                  to={lpath('/recipes')}
                  className="tkv-focusable min-h-[48px] px-5 py-2.5 rounded-full bg-white border border-[var(--tkv-primary)] text-[var(--tkv-primary)] font-extrabold text-sm inline-flex items-center justify-center"
                >
                  {dict.landing.dishesSeeAll}
                </Link>
              )}
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="rounded-3xl overflow-hidden border border-[var(--tkv-border)] bg-white shadow-[var(--tkv-shadow-card)]">
              <img
                src={feat.ogImage}
                alt={feat.heroAlt}
                width={feat.ogWidth}
                height={feat.ogHeight}
                loading="eager"
                className="w-full aspect-[4/3] object-cover"
              />
            </div>
          </div>
        </div>

        <section aria-labelledby="feat-q-heading" className="flex flex-col gap-5">
          <h2 id="feat-q-heading" className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink)]">
            {feat.questionHeading}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {feat.highlights.map((hl) => (
              <div key={hl.title} className="tkv-bento-card p-5 flex flex-col gap-2">
                <h3 className="tkv-heading text-base font-extrabold text-[var(--tkv-primary)]">{hl.title}</h3>
                <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">{hl.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white border border-[var(--tkv-border)] p-6 sm:p-8 flex flex-col gap-5 shadow-[var(--tkv-shadow-card)]">
          <ol className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {feat.steps.map((st, idx) => (
              <li key={st.title} className="flex flex-col gap-2">
                <span className="tabular-nums text-xs font-black text-[var(--tkv-coral-ink)] bg-[var(--tkv-surface-coral)] px-2.5 py-1 rounded-full self-start">
                  0{idx + 1}
                </span>
                <h3 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">{st.title}</h3>
                <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">{st.detail}</p>
              </li>
            ))}
          </ol>
        </section>
      </article>
    </SatelliteShell>
  );
};

const PRIMARY_PRICING_CURRENCIES: readonly GlobalDisplayCurrency[] = ['VND', 'JPY', 'EUR', 'USD', 'GBP'];

export const PricingPage: React.FC<{ locale: SupportedLocale; ssrData?: SiteSsrPayload | null }> = ({
  locale,
  ssrData,
}) => {
  const dict = getSiteDictionary(locale);
  const pr = dict.pricing;
  const [regionalCatalog, setRegionalCatalog] = useState<RegionalPriceReference[]>(
    () => ssrData?.pricing?.regionalCatalog ?? buildRegionalPriceReferences(DEFAULT_VND_PRICES),
  );
  const [selectedCurrency, setSelectedCurrency] = useState<GlobalDisplayCurrency>(() =>
    defaultCurrencyForLocale(locale),
  );
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');

  // Live refresh against public read-only server-truth pricing endpoint
  useEffect(() => {
    let active = true;
    fetch('/api/v1/public/pricing', { credentials: 'omit' })
      .then((res) => (res.ok ? res.json() : null))
      .then((raw) => {
        const body = raw as { regionalCatalog?: RegionalPriceReference[] } | null;
        if (active && body?.regionalCatalog && body.regionalCatalog.length > 0) {
          setRegionalCatalog(body.regionalCatalog);
        }
      })
      .catch(() => {
        // Retain SSR authoritative fallback gracefully
      });
    return () => {
      active = false;
    };
  }, []);

  const currentTier =
    regionalCatalog.find((c) => c.currency === selectedCurrency) ?? regionalCatalog[0];
  const intlLocale = LOCALE_CATALOG[locale].bcp47;
  const activeMinor = billingCycle === 'annual' ? currentTier.annualMinor : currentTier.monthlyMinor;
  const activeFormatted = formatGlobalMinorCurrency(
    activeMinor,
    currentTier.currency,
    currentTier.minorDigits,
    intlLocale,
  );
  const monthlyEquivalentFormatted = formatGlobalMinorCurrency(
    Math.round(currentTier.annualMinor / 12),
    currentTier.currency,
    currentTier.minorDigits,
    intlLocale,
  );
  const marketCode = marketCodeForCurrency(currentTier.currency);
  const proReturnPath = `/plus?plan=${billingCycle}&market=${encodeURIComponent(marketCode)}`;
  const proHandoffHref = buildAppHandoffUrl(`/auth?mode=login&returnTo=${encodeURIComponent(proReturnPath)}`, locale);
  const extraCurrencies = GLOBAL_DISPLAY_CURRENCIES.filter((c) => !PRIMARY_PRICING_CURRENCIES.includes(c));

  return (
    <SatelliteShell locale={locale} barePath="/pricing">
      <section className="max-w-[1000px] mx-auto px-4 sm:px-6 py-10 sm:py-16 flex flex-col gap-9">
        {/* Centered Calm Kitchen Editorial Header */}
        <header className="flex flex-col items-center text-center gap-3 max-w-2xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] px-3.5 py-1 text-xs font-extrabold text-[var(--tkv-primary)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--tkv-primary)]" aria-hidden="true" />
            <span>{pr.eyebrow}</span>
          </span>
          <h1 className="tkv-heading text-3xl sm:text-[2.75rem] font-black text-[var(--tkv-ink)] leading-tight">
            {pr.h1}
          </h1>
          <p className="text-base sm:text-lg text-[var(--tkv-ink-secondary)] leading-relaxed">
            {pr.subtitle}
          </p>
        </header>

        {/* Single Tactile Control Bar: Billing Cycle Toggle + Currency Pills */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 rounded-3xl border border-[var(--tkv-border)] bg-[var(--tkv-surface)] p-3 sm:px-5 shadow-[var(--tkv-shadow-card)]">
          <div
            role="group"
            aria-label={pr.proTitle}
            className="inline-flex items-center gap-1 rounded-full bg-[var(--tkv-surface-subtle)] p-1 border border-[var(--tkv-border)] w-full md:w-auto"
          >
            <button
              type="button"
              aria-pressed={billingCycle === 'annual'}
              onClick={() => setBillingCycle('annual')}
              className={[
                'tkv-focusable min-h-[42px] flex-1 md:flex-initial inline-flex items-center justify-center gap-2 rounded-full px-4 text-xs sm:text-sm font-extrabold transition-colors',
                billingCycle === 'annual'
                  ? 'bg-[var(--tkv-primary)] text-white shadow-xs'
                  : 'text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-ink)]',
              ].join(' ')}
            >
              <span>{pr.annualLabel}</span>
              <span
                className={[
                  'rounded-full px-2 py-0.5 text-[10px] font-black',
                  billingCycle === 'annual'
                    ? 'bg-[var(--tkv-saffron)] text-[var(--tkv-ink)]'
                    : 'bg-[var(--tkv-surface-saffron)] text-[var(--tkv-warning-ink)]',
                ].join(' ')}
              >
                {pr.saveNote}
              </span>
            </button>
            <button
              type="button"
              aria-pressed={billingCycle === 'monthly'}
              onClick={() => setBillingCycle('monthly')}
              className={[
                'tkv-focusable min-h-[42px] flex-1 md:flex-initial inline-flex items-center justify-center rounded-full px-4 text-xs sm:text-sm font-extrabold transition-colors',
                billingCycle === 'monthly'
                  ? 'bg-[var(--tkv-primary)] text-white shadow-xs'
                  : 'text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-ink)]',
              ].join(' ')}
            >
              {pr.monthlyLabel}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label={pr.currencyLabel}>
            {PRIMARY_PRICING_CURRENCIES.map((code) => {
              const active = selectedCurrency === code;
              return (
                <button
                  key={code}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedCurrency(code)}
                  className={[
                    'tkv-focusable min-h-[38px] rounded-full px-3 text-xs font-extrabold transition-colors',
                    active
                      ? 'bg-[var(--tkv-ink)] text-white'
                      : 'bg-[var(--tkv-bg)] border border-[var(--tkv-border)] text-[var(--tkv-ink-secondary)] hover:border-[var(--tkv-border-strong)] hover:text-[var(--tkv-ink)]',
                  ].join(' ')}
                >
                  {code}
                </button>
              );
            })}
            <select
              aria-label={pr.currencyLabel}
              value={extraCurrencies.includes(selectedCurrency) ? selectedCurrency : ''}
              onChange={(e) => {
                if (e.target.value) setSelectedCurrency(e.target.value as GlobalDisplayCurrency);
              }}
              className="tkv-focusable min-h-[38px] rounded-full border border-[var(--tkv-border)] bg-[var(--tkv-bg)] px-3 text-xs font-bold text-[var(--tkv-ink-secondary)]"
            >
              <option value="">+ More</option>
              {extraCurrencies.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 2-Column Balanced Ceramic Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
          {/* Free Tier */}
          <div className="rounded-[28px] bg-[var(--tkv-surface)] border border-[var(--tkv-border)] p-6 sm:p-8 flex flex-col justify-between gap-7 shadow-[var(--tkv-shadow-card)]">
            <div className="flex flex-col gap-4">
              <div>
                <span className="inline-flex px-3 py-1 rounded-full text-xs font-extrabold bg-[var(--tkv-surface-subtle)] text-[var(--tkv-ink-secondary)] border border-[var(--tkv-border)]">
                  {pr.freeBadge}
                </span>
              </div>
              <div>
                <h2 className="tkv-heading text-2xl sm:text-3xl font-black text-[var(--tkv-ink)]">
                  {pr.freeTitle}
                </h2>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="tkv-heading tabular-nums text-3xl sm:text-4xl font-black text-[var(--tkv-ink)]">
                    {pr.freePriceLabel}
                  </span>
                  <span className="text-xs font-semibold text-[var(--tkv-ink-muted)]">{pr.freePer}</span>
                </div>
              </div>
              <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)] leading-relaxed">{pr.freeDesc}</p>
              <ul className="flex flex-col gap-3 pt-1 text-sm text-[var(--tkv-ink)]">
                {pr.freePerks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--tkv-border)] bg-[var(--tkv-surface-subtle)] text-[11px] font-black text-[var(--tkv-ink-secondary)]"
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span className="leading-relaxed">{perk}</span>
                  </li>
                ))}
              </ul>
            </div>

            <a
              href={buildAppHandoffUrl('/auth?mode=guest', locale)}
              rel="nofollow"
              className="tkv-focusable w-full min-h-[52px] px-6 py-3 rounded-full bg-[var(--tkv-surface)] border border-[var(--tkv-border-strong)] hover:bg-[var(--tkv-surface-subtle)] text-[var(--tkv-ink)] font-extrabold text-base inline-flex items-center justify-center transition-colors"
            >
              {pr.freeCta}
            </a>
          </div>

          {/* Takolio Pro Tier — Highlighted Leaf Green Ceramic Card */}
          <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-b from-[var(--tkv-surface)] via-[var(--tkv-bg)] to-[var(--tkv-surface-mint)] border-2 border-[var(--tkv-primary)] p-6 sm:p-8 flex flex-col justify-between gap-7 shadow-[var(--tkv-shadow-elevated)]">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <div>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[var(--tkv-surface-saffron)] text-[var(--tkv-warning-ink)] border border-[var(--tkv-border-saffron)]">
                      {pr.proBadge}
                    </span>
                  </div>
                  <h2 className="tkv-heading text-2xl sm:text-3xl font-black text-[var(--tkv-ink)]">
                    {pr.proTitle}
                  </h2>
                </div>
                <div className="h-16 w-16 shrink-0 rounded-2xl bg-[var(--tkv-surface)] border border-[var(--tkv-border-mint)] p-1.5 shadow-xs">
                  <img
                    src="/takolio/vnext/mascot/pose-06-achievement-256w.webp"
                    alt=""
                    aria-hidden="true"
                    className="h-full w-full object-contain"
                  />
                </div>
              </div>

              <div className="rounded-2xl bg-[var(--tkv-surface)] border border-[var(--tkv-border-mint)] p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-1.5">
                    <span className="tkv-heading tabular-nums text-3xl sm:text-4xl font-black text-[var(--tkv-ink)]">
                      {activeFormatted}
                    </span>
                    <span className="text-xs font-bold text-[var(--tkv-ink-muted)]">
                      / {billingCycle === 'annual' ? pr.annualLabel : pr.monthlyLabel}
                    </span>
                  </div>
                  {billingCycle === 'annual' && (
                    <span className="rounded-full bg-[var(--tkv-surface-mint)] px-2.5 py-0.5 text-xs font-extrabold text-[var(--tkv-primary)] tabular-nums">
                      ~{monthlyEquivalentFormatted} / {pr.monthlyLabel}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs font-medium text-[var(--tkv-ink-secondary)] leading-relaxed">
                  {currentTier.checkoutMode === 'live_vietqr' ? pr.checkoutVndNote : pr.checkoutIntlNote}
                </p>
              </div>

              <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)] leading-relaxed">{pr.proDesc}</p>
              <ul className="flex flex-col gap-3 text-sm text-[var(--tkv-ink)]">
                {pr.proPerks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--tkv-border-mint)] bg-[var(--tkv-surface-mint)] text-[11px] font-black text-[var(--tkv-primary)]"
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                    <span className="leading-relaxed">{perk}</span>
                  </li>
                ))}
              </ul>
            </div>

            <a
              href={proHandoffHref}
              rel="nofollow"
              className="tkv-focusable w-full min-h-[52px] px-6 py-3 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-cta-hover)] text-white font-extrabold text-base shadow-[var(--tkv-shadow-cta)] inline-flex items-center justify-center transition-colors"
            >
              {pr.proCta}
            </a>
          </div>
        </div>

        {/* Calm Transparency & GEO Summary Footer */}
        <div className="rounded-[24px] bg-[var(--tkv-surface)] border border-[var(--tkv-border)] p-5 sm:p-6 space-y-2 text-xs sm:text-sm text-[var(--tkv-ink-secondary)]">
          <p className="font-semibold text-[var(--tkv-ink)] leading-relaxed">
            <span className="text-[var(--tkv-primary)] font-extrabold mr-1.5">{pr.tldrLabel}:</span>
            {pr.tldr}
          </p>
          <p className="leading-relaxed">
            <strong className="text-[var(--tkv-ink)]">{pr.transparencyTitle}: </strong>
            {pr.transparencyBody}
          </p>
        </div>
      </section>
    </SatelliteShell>
  );
};

export const FaqPage: React.FC<{ locale: SupportedLocale }> = ({ locale }) => {
  const dict = getSiteDictionary(locale);
  const fq = dict.faq;
  const [query, setQuery] = useState('');
  const normalized = query.trim().toLowerCase();
  const visible = normalized
    ? fq.items.filter(
        (item) =>
          item.q.toLowerCase().includes(normalized) || item.a.toLowerCase().includes(normalized),
      )
    : fq.items;

  return (
    <SatelliteShell locale={locale} barePath="/faq">
      <section className="max-w-[920px] mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col gap-7">
        <header className="flex flex-col gap-2.5">
          <div>
            <span className="inline-flex items-center rounded-full bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] px-3 py-1 text-xs font-extrabold text-[var(--tkv-coral-ink)]">
              {fq.eyebrow}
            </span>
          </div>
          <h1 className="tkv-heading text-3xl sm:text-[2.6rem] font-black text-[var(--tkv-ink)]">{fq.h1}</h1>
          <p className="text-base text-[var(--tkv-ink-secondary)]">{fq.subtitle}</p>
        </header>

        <div className="rounded-2xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] p-4">
          <p className="text-xs uppercase tracking-wider font-extrabold text-[var(--tkv-primary)] mb-1">
            {fq.tldrLabel}
          </p>
          <p className="text-sm text-[var(--tkv-ink)] font-medium leading-relaxed">{fq.tldr}</p>
        </div>

        <input
          type="search"
          aria-label={fq.searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={fq.searchPlaceholder}
          className="tkv-focusable w-full min-h-[48px] px-4 py-2.5 rounded-2xl bg-white border border-[var(--tkv-border-strong)] text-base text-[var(--tkv-ink)] placeholder:text-[var(--tkv-ink-muted)]"
        />

        {visible.length === 0 ? (
          <div className="rounded-2xl bg-white border border-[var(--tkv-border)] p-6 text-center flex flex-col items-center gap-3">
            <p className="font-bold text-[var(--tkv-ink)]">{fq.noResults}</p>
            <button
              type="button"
              onClick={() => setQuery('')}
              className="tkv-focusable min-h-[44px] px-4 py-2 rounded-full bg-[var(--tkv-primary)] text-white text-xs font-bold"
            >
              {fq.resetSearch}
            </button>
          </div>
        ) : (
          /* Native <details> guarantees 100% DOM Visible Content Parity for FAQPage JSON-LD */
          <div className="flex flex-col gap-3">
            {visible.map((item, idx) => (
              <details
                key={item.id}
                open={idx === 0 || Boolean(normalized)}
                className="group rounded-2xl bg-white border border-[var(--tkv-border)] overflow-hidden shadow-[var(--tkv-shadow-card)]"
              >
                <summary className="tkv-focusable cursor-pointer list-none min-h-[60px] px-5 py-4 flex items-center justify-between gap-4 hover:bg-[var(--tkv-bg)]">
                  <h2 className="tkv-heading text-base sm:text-lg font-extrabold text-[var(--tkv-ink)]">
                    {item.q}
                  </h2>
                  <span
                    aria-hidden="true"
                    className="w-8 h-8 rounded-full bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] text-[var(--tkv-primary)] font-black inline-flex items-center justify-center shrink-0 group-open:rotate-45 transition-transform"
                  >
                    +
                  </span>
                </summary>
                <div className="px-5 pb-5 pt-2.5 text-sm sm:text-base text-[var(--tkv-ink-secondary)] leading-relaxed border-t border-[var(--tkv-border)]">
                  {item.a}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>
    </SatelliteShell>
  );
};

export const StoriesIndexPage: React.FC<{ locale: SupportedLocale }> = ({ locale }) => {
  const dict = getSiteDictionary(locale);
  const st = dict.stories;
  const lpath = (p: string) => buildLocalizedPath(locale, p);

  return (
    <SatelliteShell locale={locale} barePath="/stories">
      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col gap-8">
        <header className="flex flex-col gap-2.5 max-w-3xl">
          <div>
            <span className="inline-flex items-center rounded-full bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] px-3 py-1 text-xs font-extrabold text-[var(--tkv-coral-ink)]">
              {st.eyebrow}
            </span>
          </div>
          <h1 className="tkv-heading text-3xl sm:text-[2.6rem] font-black text-[var(--tkv-ink)]">{st.h1}</h1>
          <p className="text-base sm:text-lg text-[var(--tkv-ink-secondary)]">{st.subtitle}</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {st.guides.map((guide) => (
            <article key={guide.slug} className="tkv-bento-card overflow-hidden flex flex-col justify-between">
              <div>
                <div className="aspect-[4/3] overflow-hidden bg-[var(--tkv-surface-mint)]">
                  <img
                    src={guide.coverSrc640}
                    srcSet={`${guide.coverSrc640} 640w, ${guide.coverSrc} 1200w`}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 380px"
                    alt={guide.coverAlt}
                    width={640}
                    height={480}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="p-5 flex flex-col gap-2">
                  <p className="text-xs tabular-nums font-bold text-[var(--tkv-ink-muted)]">
                    {guide.readTime} · {guide.category}
                  </p>
                  <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink)]">
                    <Link to={lpath(`/stories/${guide.slug}`)} className="hover:text-[var(--tkv-primary)]">
                      {guide.title}
                    </Link>
                  </h2>
                  <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">{guide.excerpt}</p>
                </div>
              </div>
              <div className="px-5 pb-5">
                <Link
                  to={lpath(`/stories/${guide.slug}`)}
                  className="tkv-focusable w-full min-h-[44px] px-4 py-2 rounded-full bg-[var(--tkv-surface-mint)] hover:bg-[var(--tkv-primary)] text-[var(--tkv-primary)] hover:text-white text-sm font-extrabold inline-flex items-center justify-center transition-colors"
                >
                  {st.readArticle}
                </Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </SatelliteShell>
  );
};

export const StoryDetailPage: React.FC<{ locale: SupportedLocale; slugOverride?: string }> = ({
  locale,
  slugOverride,
}) => {
  const params = useParams<{ slug: string }>();
  const slug = slugOverride || params.slug || '';
  const dict = getSiteDictionary(locale);
  const st = dict.stories;
  const guide = st.guides.find((g) => g.slug === slug);
  const lpath = (p: string) => buildLocalizedPath(locale, p);

  if (!guide) {
    return <SatelliteNotFoundPage locale={locale} />;
  }

  return (
    <SatelliteShell locale={locale} barePath={`/stories/${guide.slug}`}>
      <article className="max-w-[860px] mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col gap-7">
        <nav aria-label="Breadcrumb" className="text-xs font-bold text-[var(--tkv-ink-muted)] flex items-center gap-2">
          <Link to={lpath('/')} className="hover:text-[var(--tkv-primary)]">{dict.nav.home}</Link>
          <span aria-hidden="true">/</span>
          <Link to={lpath('/stories')} className="hover:text-[var(--tkv-primary)]">{dict.nav.stories}</Link>
          <span aria-hidden="true">/</span>
          <span className="text-[var(--tkv-ink)] truncate">{guide.title}</span>
        </nav>

        <header className="flex flex-col gap-3">
          <p className="text-xs tabular-nums font-bold text-[var(--tkv-primary)]">
            {guide.category} · {guide.readTime} · {guide.publishedAt}
          </p>
          <h1 className="tkv-heading text-3xl sm:text-[2.5rem] font-black text-[var(--tkv-ink)] leading-tight">
            {guide.title}
          </h1>
          <p className="text-base sm:text-lg text-[var(--tkv-ink-secondary)] leading-relaxed">{guide.excerpt}</p>
        </header>

        <div className="rounded-2xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] p-5">
          <p className="text-xs uppercase tracking-wider font-extrabold text-[var(--tkv-primary)] mb-1">
            {st.tldrLabel}
          </p>
          <p className="text-sm sm:text-base text-[var(--tkv-ink)] font-medium leading-relaxed">{guide.tldr}</p>
        </div>

        <div className="rounded-3xl overflow-hidden border border-[var(--tkv-border)] bg-white">
          <img
            src={guide.coverSrc}
            alt={guide.coverAlt}
            width={1200}
            height={900}
            loading="eager"
            className="w-full max-h-[440px] object-cover"
          />
        </div>

        <div className="flex flex-col gap-4 text-base text-[var(--tkv-ink-secondary)] leading-relaxed">
          {guide.paragraphs.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <section className="rounded-3xl bg-white border border-[var(--tkv-border)] p-6 sm:p-7 flex flex-col gap-4 shadow-[var(--tkv-shadow-card)]">
          <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink)]">{st.checklistHeading}</h2>
          <ol className="flex flex-col gap-3 text-sm sm:text-base text-[var(--tkv-ink)]">
            {guide.steps.map((step, idx) => (
              <li key={step} className="flex items-start gap-3">
                <span className="tabular-nums w-6 h-6 rounded-full bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] font-extrabold text-xs inline-flex items-center justify-center shrink-0 mt-0.5">
                  {idx + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="pt-2 flex flex-wrap gap-3">
            <a
              href={buildAppHandoffUrl('/auth?mode=guest', locale)}
              rel="nofollow"
              className="tkv-focusable min-h-[46px] px-5 py-2.5 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white text-sm font-extrabold inline-flex items-center"
            >
              {st.applyInApp}
            </a>
            <Link
              to={lpath('/stories')}
              className="tkv-focusable min-h-[46px] px-5 py-2.5 rounded-full bg-white border border-[var(--tkv-border-strong)] text-[var(--tkv-ink)] text-sm font-bold inline-flex items-center"
            >
              ← {st.backToStories}
            </Link>
          </div>
        </section>
      </article>
    </SatelliteShell>
  );
};

export const CompanyLegalPage: React.FC<{
  locale: SupportedLocale;
  section: 'about' | 'contact' | 'privacy' | 'terms';
}> = ({ locale, section }) => {
  const dict = getSiteDictionary(locale);
  const co = dict.company;
  const page = co.pages[section];
  const lpath = (p: string) => buildLocalizedPath(locale, p);

  const tabs: Array<{ key: 'about' | 'contact' | 'privacy' | 'terms'; label: string; to: string }> = [
    { key: 'about', label: dict.nav.about, to: '/about' },
    { key: 'contact', label: dict.nav.contact, to: '/contact' },
    { key: 'privacy', label: dict.nav.privacy, to: '/privacy' },
    { key: 'terms', label: dict.nav.terms, to: '/terms' },
  ];

  return (
    <SatelliteShell locale={locale} barePath={`/${section}`}>
      <section className="max-w-[1160px] mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col gap-7">
        <nav aria-label={co.tabsLabel} className="flex flex-wrap gap-2">
          {tabs.map((t) => (
            <Link
              key={t.key}
              to={lpath(t.to)}
              aria-current={section === t.key ? 'page' : undefined}
              className={`tkv-focusable min-h-[44px] px-4 py-2 rounded-full text-sm font-bold inline-flex items-center border transition-colors ${
                section === t.key
                  ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)]'
                  : 'bg-white text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)] hover:border-[var(--tkv-primary)]'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 flex flex-col gap-5">
            <div>
              <span className="inline-flex items-center rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] px-3 py-1 text-xs font-extrabold text-[var(--tkv-primary)]">
                {co.badge}
              </span>
            </div>
            <h1 className="tkv-heading text-3xl sm:text-[2.5rem] font-black text-[var(--tkv-ink)] leading-tight">
              {page.h1}
            </h1>
            <p className="text-base text-[var(--tkv-ink-secondary)] leading-relaxed">{page.lead}</p>

            <div className="rounded-3xl bg-white border border-[var(--tkv-border)] p-6 flex flex-col gap-4 shadow-[var(--tkv-shadow-card)]">
              <div className="flex items-center gap-4">
                <img
                  src="/takolio/brand-v2/mascot/bemam-01-welcome-256w.webp"
                  alt={dict.brand.mascotName}
                  width={60}
                  height={60}
                  className="w-15 h-15 rounded-2xl border border-[var(--tkv-border)] bg-[var(--tkv-bg)] object-contain shrink-0"
                />
                <h2 className="tkv-heading text-lg font-extrabold text-[var(--tkv-ink)]">{page.heading}</h2>
              </div>
              {page.paragraphs.map((p) => (
                <p key={p} className="text-sm sm:text-base text-[var(--tkv-ink-secondary)] leading-relaxed">
                  {p}
                </p>
              ))}
              <ul className="flex flex-col gap-3 text-sm text-[var(--tkv-ink-secondary)] list-disc ps-5">
                {page.bullets.map((b) => (
                  <li key={b.label}>
                    <strong className="text-[var(--tkv-ink)]">{b.label}: </strong>
                    {b.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="lg:col-span-5 rounded-3xl bg-white border border-[var(--tkv-border)] p-6 flex flex-col gap-5 shadow-[var(--tkv-shadow-card)]">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wider font-extrabold text-[var(--tkv-ink-muted)]">
                {co.supportEyebrow}
              </span>
              <h2 className="tkv-heading text-xl font-extrabold text-[var(--tkv-ink)]">{co.supportHeading}</h2>
              <p className="text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">{co.supportDesc}</p>
            </div>
            <ol className="flex flex-col gap-3 text-sm">
              {co.supportSteps.map((s, idx) => (
                <li key={s.title} className="rounded-2xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] p-4 flex flex-col gap-1">
                  <p className="font-extrabold text-[var(--tkv-ink)]">
                    <span className="tabular-nums text-[var(--tkv-primary)] me-1.5">0{idx + 1}.</span>
                    {s.title}
                  </p>
                  <p className="text-xs sm:text-sm text-[var(--tkv-ink-secondary)] leading-relaxed">{s.detail}</p>
                </li>
              ))}
            </ol>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Link
                to={lpath('/faq')}
                className="tkv-focusable min-h-[44px] px-4 py-2 rounded-full bg-[var(--tkv-primary)] text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center"
              >
                {co.supportFaqCta}
              </Link>
              <a
                href={buildAppHandoffUrl('/auth?mode=login', locale)}
                rel="nofollow"
                className="tkv-focusable min-h-[44px] px-4 py-2 rounded-full bg-white border border-[var(--tkv-border-strong)] text-[var(--tkv-ink)] text-xs sm:text-sm font-bold inline-flex items-center justify-center"
              >
                {co.supportLoginCta}
              </a>
            </div>
          </aside>
        </div>
      </section>
    </SatelliteShell>
  );
};

export const SatelliteNotFoundPage: React.FC<{ locale: SupportedLocale }> = ({ locale }) => {
  const dict = getSiteDictionary(locale);
  const lpath = (p: string) => buildLocalizedPath(locale, p);

  return (
    <SatelliteShell locale={locale} barePath="/404">
      <section className="max-w-xl mx-auto px-4 sm:px-6 py-16 text-center flex flex-col items-center gap-5">
        <img
          src="/takolio/brand-v2/mascot/bemam-07-empty-fridge-256w.webp"
          alt={dict.brand.mascotName}
          width={120}
          height={120}
          className="w-28 h-28 rounded-3xl object-contain bg-[var(--tkv-surface-mint)] p-2 border border-[var(--tkv-border-mint)]"
        />
        <h1 className="tkv-heading text-3xl font-black text-[var(--tkv-ink)]">{dict.footer.notFoundTitle}</h1>
        <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)]">{dict.footer.notFoundDesc}</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link
            to={lpath('/')}
            className="tkv-focusable min-h-[46px] px-6 py-2.5 rounded-full bg-[var(--tkv-primary)] text-white font-extrabold text-sm inline-flex items-center"
          >
            {dict.footer.backHome}
          </Link>
          <Link
            to={lpath('/recipes')}
            className="tkv-focusable min-h-[46px] px-5 py-2.5 rounded-full bg-white border border-[var(--tkv-border-strong)] text-[var(--tkv-ink)] font-bold text-sm inline-flex items-center"
          >
            {dict.nav.recipes}
          </Link>
        </div>
      </section>
    </SatelliteShell>
  );
};
