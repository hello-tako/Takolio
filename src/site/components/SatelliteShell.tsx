import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  buildLocalizedPath,
  LOCALE_CATALOG,
  normalizeLocale,
  parseLocaleFromPathname,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from '../../shared/locales';
import { getSiteDictionary } from '../i18n/dictionaries';

const APP_ORIGIN = 'https://takolio.app';
const LANG_PREF_STORAGE_KEY = 'takolio_site_lang_dismissed';

export function buildAppHandoffUrl(appPath: string, locale: SupportedLocale): string {
  const clean = appPath.startsWith('/') ? appPath : `/${appPath}`;
  const sep = clean.includes('?') ? '&' : '?';
  return `${APP_ORIGIN}${clean}${sep}lang=${encodeURIComponent(locale)}`;
}

interface SatelliteShellProps {
  locale: SupportedLocale;
  barePath: string;
  children: React.ReactNode;
}

export const SatelliteShell: React.FC<SatelliteShellProps> = ({ locale, barePath, children }) => {
  const dict = getSiteDictionary(locale);
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [suggestedLocale, setSuggestedLocale] = useState<SupportedLocale | null>(null);

  const lpath = (path: string) => buildLocalizedPath(locale, path);
  const currentBare = parseLocaleFromPathname(location.pathname).barePath || barePath;

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Non-intrusive browser language suggestion banner (never auto-redirects bots or visitors)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (window.sessionStorage.getItem(LANG_PREF_STORAGE_KEY) === '1') return;
      const browserLang = window.navigator.languages?.[0] || window.navigator.language || '';
      const candidate = normalizeLocale(browserLang, locale);
      if (candidate !== locale) {
        setSuggestedLocale(candidate);
      } else {
        setSuggestedLocale(null);
      }
    } catch {
      // Ignore storage restrictions
    }
  }, [locale]);

  const dismissBanner = () => {
    setSuggestedLocale(null);
    try {
      window.sessionStorage.setItem(LANG_PREF_STORAGE_KEY, '1');
    } catch {
      // Ignore
    }
  };

  const navLinks = [
    { to: '/how-it-works', label: dict.nav.howItWorks },
    { to: '/recipes', label: dict.nav.recipes },
    { to: '/pricing', label: dict.nav.pricing },
    { to: '/stories', label: dict.nav.stories },
    { to: '/faq', label: dict.nav.faq },
  ];

  const isActive = (targetBare: string) =>
    currentBare === targetBare || (targetBare !== '/' && currentBare.startsWith(`${targetBare}/`));

  return (
    <div className="min-h-dvh flex flex-col bg-[var(--tkv-bg)] text-[var(--tkv-ink)]" dir={LOCALE_CATALOG[locale].dir}>
      <a
        href="#tk-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:start-3 focus:z-50 focus:rounded-full focus:bg-[var(--tkv-primary)] focus:px-4 focus:py-2 focus:text-white focus:font-bold"
      >
        {dict.nav.skipToMain}
      </a>

      {/* Non-intrusive Language Suggestion Banner (SEO/GEO bot-safe) */}
      {suggestedLocale && (
        <div
          role="region"
          aria-label={dict.nav.languageLabel}
          className="bg-[var(--tkv-surface-mint)] border-b border-[var(--tkv-border-mint)] px-4 py-2.5 text-xs sm:text-sm"
        >
          <div className="max-w-[1200px] mx-auto flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-[var(--tkv-ink)]">
              {dict.langBanner.prompt} ({LOCALE_CATALOG[suggestedLocale].nativeName})
            </p>
            <div className="flex items-center gap-2">
              <a
                href={buildLocalizedPath(suggestedLocale, currentBare)}
                onClick={dismissBanner}
                className="tkv-focusable inline-flex items-center min-h-[36px] px-3.5 py-1 rounded-full bg-[var(--tkv-primary)] text-white font-bold text-xs hover:bg-[var(--tkv-primary-hover)] transition-colors"
              >
                {LOCALE_CATALOG[suggestedLocale].nativeName} →
              </a>
              <button
                type="button"
                onClick={dismissBanner}
                className="tkv-focusable inline-flex items-center min-h-[36px] px-3 py-1 rounded-full border border-[var(--tkv-border-strong)] bg-white text-[var(--tkv-ink-secondary)] font-semibold text-xs hover:text-[var(--tkv-ink)]"
              >
                {dict.langBanner.dismiss}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Brand Board v2 Header */}
      <header className="sticky top-0 z-40 bg-[var(--tkv-bg)]/95 backdrop-blur border-b border-[var(--tkv-border)]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 min-h-[68px] flex items-center justify-between gap-3">
          <Link
            to={lpath('/')}
            className="tkv-focusable inline-flex items-center gap-2.5 shrink-0"
            aria-label={`${dict.brand.name} — ${dict.nav.home}`}
          >
            <img
              src="/takolio/brand-v2/brand/takolio-logo-mark-128.webp"
              alt="Takolio"
              width={40}
              height={40}
              className="w-10 h-10 rounded-xl object-contain"
            />
            <span className="tkv-heading text-xl font-black tracking-tight text-[var(--tkv-primary)]">
              Takolio
            </span>
          </Link>

          <nav aria-label="Main navigation" className="hidden lg:flex items-center gap-1">
            {navLinks.map((item) => (
              <Link
                key={item.to}
                to={lpath(item.to)}
                aria-current={isActive(item.to) ? 'page' : undefined}
                className={`tkv-focusable px-3.5 py-2 rounded-full text-sm font-bold transition-colors ${
                  isActive(item.to)
                    ? 'bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)]'
                    : 'text-[var(--tkv-ink-secondary)] hover:text-[var(--tkv-primary)] hover:bg-[var(--tkv-surface-mint)]/60'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* Compact Desktop Language Switcher */}
            <details className="relative hidden sm:block">
              <summary
                aria-label={dict.nav.languageLabel}
                className="tkv-focusable list-none cursor-pointer min-h-[40px] px-3 py-1.5 rounded-full border border-[var(--tkv-border-strong)] bg-white text-xs font-bold text-[var(--tkv-ink)] inline-flex items-center gap-1.5 hover:border-[var(--tkv-primary)]"
              >
                <span aria-hidden="true">🌐</span>
                <span>{LOCALE_CATALOG[locale].nativeName}</span>
                <span aria-hidden="true" className="text-[10px]">▾</span>
              </summary>
              <div className="absolute end-0 mt-2 w-44 rounded-2xl bg-white border border-[var(--tkv-border)] shadow-[var(--tkv-shadow-float)] p-1.5 z-50">
                <ul className="flex flex-col gap-0.5">
                  {SUPPORTED_LOCALES.map((loc) => (
                    <li key={loc}>
                      <a
                        href={buildLocalizedPath(loc, currentBare)}
                        hrefLang={LOCALE_CATALOG[loc].hreflang}
                        aria-current={loc === locale ? 'true' : undefined}
                        className={`block px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                          loc === locale
                            ? 'bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)]'
                            : 'text-[var(--tkv-ink-secondary)] hover:bg-[var(--tkv-bg)] hover:text-[var(--tkv-ink)]'
                        }`}
                      >
                        {LOCALE_CATALOG[loc].nativeName}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </details>

            <a
              href={buildAppHandoffUrl('/auth?mode=login', locale)}
              rel="nofollow"
              className="tkv-focusable hidden md:inline-flex items-center min-h-[42px] px-4 py-2 rounded-full border border-[var(--tkv-border-strong)] bg-white text-sm font-bold text-[var(--tkv-ink)] hover:border-[var(--tkv-primary)] transition-colors"
            >
              {dict.nav.openApp}
            </a>
            <a
              href={buildAppHandoffUrl('/auth?mode=guest', locale)}
              rel="nofollow"
              className="tkv-focusable inline-flex items-center min-h-[42px] px-4 py-2 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white text-sm font-extrabold transition-colors"
            >
              {dict.nav.startFree}
            </a>

            <button
              type="button"
              aria-label={dict.nav.menuLabel}
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="tkv-focusable lg:hidden inline-flex items-center justify-center w-11 h-11 rounded-full border border-[var(--tkv-border-strong)] bg-white text-[var(--tkv-ink)] font-bold"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[var(--tkv-border)] bg-white px-4 py-4">
            <nav aria-label="Mobile navigation" className="flex flex-col gap-1.5">
              {navLinks.map((item) => (
                <Link
                  key={item.to}
                  to={lpath(item.to)}
                  className={`px-4 py-3 rounded-2xl text-sm font-bold ${
                    isActive(item.to)
                      ? 'bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)]'
                      : 'text-[var(--tkv-ink)] hover:bg-[var(--tkv-bg)]'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <div className="pt-3 mt-2 border-t border-[var(--tkv-border)]">
                <p className="text-xs font-bold uppercase tracking-wider text-[var(--tkv-ink-muted)] px-2 pb-2">
                  {dict.nav.languageLabel}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SUPPORTED_LOCALES.map((loc) => (
                    <a
                      key={loc}
                      href={buildLocalizedPath(loc, currentBare)}
                      hrefLang={LOCALE_CATALOG[loc].hreflang}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                        loc === locale
                          ? 'bg-[var(--tkv-primary)] text-white border-[var(--tkv-primary)]'
                          : 'bg-[var(--tkv-bg)] text-[var(--tkv-ink-secondary)] border-[var(--tkv-border)]'
                      }`}
                    >
                      {LOCALE_CATALOG[loc].nativeName}
                    </a>
                  ))}
                </div>
              </div>
            </nav>
          </div>
        )}
      </header>

      <main id="tk-main" className="flex-1">
        {children}
      </main>

      {/* Complete Crawl-Friendly Multilingual Footer (0 Orphan Routes) */}
      <footer className="border-t border-[var(--tkv-border)] bg-white mt-12">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-4 flex flex-col gap-3">
            <Link to={lpath('/')} className="inline-flex items-center gap-2.5">
              <img
                src="/takolio/brand-v2/brand/takolio-logo-mark-128.webp"
                alt="Takolio"
                width={36}
                height={36}
                loading="lazy"
                className="w-9 h-9 rounded-xl object-contain"
              />
              <span className="tkv-heading text-lg font-black text-[var(--tkv-primary)]">Takolio</span>
            </Link>
            <p className="text-sm font-semibold text-[var(--tkv-ink-secondary)] leading-relaxed">
              {dict.footer.tagline}
            </p>
            <p className="text-xs text-[var(--tkv-ink-muted)]">{dict.footer.appNote}</p>
            {/* Always-crawlable hreflang switcher links in raw SSR HTML */}
            <nav aria-label={dict.nav.languageLabel} className="flex flex-wrap gap-1.5 pt-1">
              {SUPPORTED_LOCALES.map((loc) => (
                <a
                  key={loc}
                  href={buildLocalizedPath(loc, currentBare)}
                  hrefLang={LOCALE_CATALOG[loc].hreflang}
                  aria-current={loc === locale ? 'true' : undefined}
                  className={`px-2.5 py-1 rounded-full text-xs font-bold border transition-colors ${
                    loc === locale
                      ? 'bg-[var(--tkv-surface-mint)] border-[var(--tkv-primary)] text-[var(--tkv-primary)]'
                      : 'bg-[var(--tkv-bg)] border-[var(--tkv-border)] text-[var(--tkv-ink-secondary)] hover:border-[var(--tkv-primary)]'
                  }`}
                >
                  {LOCALE_CATALOG[loc].nativeName}
                </a>
              ))}
            </nav>
          </div>

          <div className="md:col-span-3 flex flex-col gap-2">
            <h2 className="tkv-heading text-xs uppercase tracking-wider font-extrabold text-[var(--tkv-ink-muted)]">
              {dict.footer.colProduct}
            </h2>
            <ul className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--tkv-ink-secondary)]">
              <li><Link to={lpath('/how-it-works')} className="hover:text-[var(--tkv-primary)]">{dict.nav.howItWorks}</Link></li>
              <li><Link to={lpath('/features/ai-scan')} className="hover:text-[var(--tkv-primary)]">{dict.features['ai-scan'].title}</Link></li>
              <li><Link to={lpath('/features/fridge')} className="hover:text-[var(--tkv-primary)]">{dict.features.fridge.title}</Link></li>
              <li><Link to={lpath('/features/meal-planning')} className="hover:text-[var(--tkv-primary)]">{dict.features['meal-planning'].title}</Link></li>
              <li><Link to={lpath('/features/cooking')} className="hover:text-[var(--tkv-primary)]">{dict.features.cooking.title}</Link></li>
              <li><Link to={lpath('/features/shopping')} className="hover:text-[var(--tkv-primary)]">{dict.features.shopping.title}</Link></li>
            </ul>
          </div>

          <div className="md:col-span-3 flex flex-col gap-2">
            <h2 className="tkv-heading text-xs uppercase tracking-wider font-extrabold text-[var(--tkv-ink-muted)]">
              {dict.footer.colExplore}
            </h2>
            <ul className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--tkv-ink-secondary)]">
              <li><Link to={lpath('/recipes')} className="hover:text-[var(--tkv-primary)]">{dict.nav.recipes}</Link></li>
              <li><Link to={lpath('/features/recipes')} className="hover:text-[var(--tkv-primary)]">{dict.features.recipes.title}</Link></li>
              <li><Link to={lpath('/stories')} className="hover:text-[var(--tkv-primary)]">{dict.nav.stories}</Link></li>
              <li><Link to={lpath('/pricing')} className="hover:text-[var(--tkv-primary)]">{dict.nav.pricing}</Link></li>
              <li><Link to={lpath('/faq')} className="hover:text-[var(--tkv-primary)]">{dict.nav.faq}</Link></li>
            </ul>
          </div>

          <div className="md:col-span-2 flex flex-col gap-2">
            <h2 className="tkv-heading text-xs uppercase tracking-wider font-extrabold text-[var(--tkv-ink-muted)]">
              {dict.footer.colCompany}
            </h2>
            <ul className="flex flex-col gap-1.5 text-sm font-semibold text-[var(--tkv-ink-secondary)]">
              <li><Link to={lpath('/about')} className="hover:text-[var(--tkv-primary)]">{dict.nav.about}</Link></li>
              <li><Link to={lpath('/contact')} className="hover:text-[var(--tkv-primary)]">{dict.nav.contact}</Link></li>
              <li><Link to={lpath('/privacy')} className="hover:text-[var(--tkv-primary)]">{dict.nav.privacy}</Link></li>
              <li><Link to={lpath('/terms')} className="hover:text-[var(--tkv-primary)]">{dict.nav.terms}</Link></li>
              <li><a href="/llms.txt" className="hover:text-[var(--tkv-primary)]">llms.txt</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-[var(--tkv-border)] px-4 sm:px-6 py-4 text-center text-xs text-[var(--tkv-ink-muted)]">
          {dict.footer.copyright}
        </div>
      </footer>
    </div>
  );
};
