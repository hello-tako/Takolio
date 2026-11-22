import React from 'react';
import { Link } from 'react-router-dom';
import { buildLocalizedPath, type SupportedLocale } from '../../shared/locales';
import { getSiteDictionary } from '../i18n/dictionaries';
import { buildAppHandoffUrl, SatelliteShell } from '../components/SatelliteShell';

const FEATURE_ICON_MAP: Readonly<Record<string, string>> = {
  fridge: '/takolio/brand-v2/icons/feature-fridge-128w.webp',
  scan: '/takolio/brand-v2/icons/feature-scan-128w.webp',
  recipes: '/takolio/brand-v2/icons/feature-recipes-128w.webp',
  planner: '/takolio/brand-v2/icons/feature-planner-128w.webp',
  shopping: '/takolio/brand-v2/icons/feature-shopping-128w.webp',
  cooking: '/takolio/brand-v2/icons/feature-cooking-128w.webp',
};

export const LandingPage: React.FC<{ locale: SupportedLocale }> = ({ locale }) => {
  const dict = getSiteDictionary(locale);
  const lpath = (p: string) => buildLocalizedPath(locale, p);

  return (
    <SatelliteShell locale={locale} barePath="/">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col gap-10 sm:gap-12">
        {/* HERO SECTION — Brand Board v2 with LCP priority + explicit dimensions */}
        <section
          aria-labelledby="tk-hero-heading"
          className="tkv-leaf-wave-band rounded-3xl border border-[var(--tkv-border-mint)] bg-[var(--tkv-surface)] p-4 sm:p-10 shadow-[var(--tkv-shadow-elevated)]"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
            <div className="lg:col-span-6 flex flex-col gap-5">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] px-3.5 py-1.5 text-xs sm:text-sm font-bold text-[var(--tkv-primary)]">
                  <span className="w-2 h-2 rounded-full bg-[var(--tkv-primary)]" aria-hidden="true" />
                  <span>{dict.landing.heroBadge}</span>
                </span>
              </div>

              <h1 id="tk-hero-heading" className="tkv-display tracking-tight">
                <span className="text-[var(--tkv-primary)]">{dict.brand.heroLine1}</span>
                <span className="text-[var(--tkv-coral)]">{dict.brand.heroLine2}</span>
              </h1>

              <div>
                <span className="inline-flex items-center rounded-full bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] px-4 py-1.5 text-sm sm:text-base font-extrabold text-[var(--tkv-primary)]">
                  {dict.brand.slogan}
                </span>
              </div>

              <p className="text-base sm:text-lg text-[var(--tkv-ink-secondary)] leading-relaxed max-w-xl">
                {dict.landing.heroDesc}
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <a
                  href={buildAppHandoffUrl('/auth?mode=guest', locale)}
                  rel="nofollow"
                  className="tkv-focusable min-h-[52px] px-6 py-3 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white font-extrabold text-base inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <span>{dict.landing.ctaPrimary}</span>
                  <span aria-hidden="true" className="rtl:rotate-180">→</span>
                </a>
                <Link
                  to={lpath('/how-it-works')}
                  className="tkv-focusable min-h-[52px] px-6 py-3 rounded-full bg-[var(--tkv-surface-coral)] hover:opacity-95 border border-[var(--tkv-border-coral)] text-[var(--tkv-ink)] font-extrabold text-base inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <span>{dict.landing.ctaSecondary}</span>
                </Link>
              </div>

              {/* 5 Quick Above-the-Fold Feature Tiles (eagerly loaded icons) */}
              <div className="pt-2 grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                {dict.landing.pillars.map((card) => (
                  <Link
                    key={card.to}
                    to={lpath(card.to)}
                    className="tkv-focusable last:col-span-2 sm:last:col-span-1 rounded-2xl bg-[var(--tkv-bg)] hover:bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border)] p-2.5 flex flex-col items-center text-center gap-2 transition-colors min-w-0"
                  >
                    <img
                      src={FEATURE_ICON_MAP[card.icon]}
                      alt=""
                      aria-hidden="true"
                      width={44}
                      height={44}
                      loading="eager"
                      className="w-11 h-11 rounded-xl object-contain"
                    />
                    <span className="tkv-heading text-xs font-extrabold text-[var(--tkv-ink)] leading-snug">
                      {card.title}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Hero Right Visual — LCP Image */}
            <div className="lg:col-span-6">
              <div className="relative rounded-3xl overflow-hidden border-2 border-[var(--tkv-border-mint)] bg-[var(--tkv-bg)] shadow-[var(--tkv-shadow-elevated)]">
                <img
                  src="/takolio/brand-v2/mascot/bemam-hero-kitchen-640w.webp"
                  srcSet="/takolio/brand-v2/mascot/bemam-hero-kitchen-640w.webp 640w, /takolio/brand-v2/mascot/bemam-hero-kitchen.webp 1280w"
                  sizes="(max-width: 1024px) 100vw, 580px"
                  alt={dict.brand.mascotBadge}
                  width={1280}
                  height={720}
                  loading="eager"
                  className="w-full aspect-[16/10] object-cover"
                />
                <div className="absolute bottom-3 end-3 sm:bottom-4 sm:end-4 max-w-[calc(100%-24px)] rounded-full bg-[var(--tkv-primary)] text-white px-3.5 sm:px-4 py-1.5 shadow-[var(--tkv-shadow-float)] border border-white/30 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--tkv-saffron)] shrink-0" aria-hidden="true" />
                  <span className="tkv-heading text-xs sm:text-sm font-extrabold truncate">
                    {dict.brand.mascotBadge}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Answer-First GEO Summary Block (High-Density AI Citation Anchor) */}
        <section
          aria-labelledby="tk-tldr-heading"
          className="rounded-2xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] px-5 py-4 sm:px-6 sm:py-5"
        >
          <h2 id="tk-tldr-heading" className="tkv-heading text-xs uppercase tracking-wider font-extrabold text-[var(--tkv-primary)] mb-1.5">
            {dict.landing.tldrLabel}
          </h2>
          <p className="text-sm sm:text-base text-[var(--tkv-ink)] leading-relaxed font-medium">
            {dict.landing.tldrBody}
          </p>
        </section>

        {/* 6 Core Feature Bento Grid */}
        <section aria-labelledby="tk-features-heading" className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <div>
                <span className="inline-flex items-center rounded-full bg-[var(--tkv-primary)] text-white px-3.5 py-1 text-xs font-extrabold">
                  {dict.landing.featuresEyebrow}
                </span>
              </div>
              <h2 id="tk-features-heading" className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
                {dict.landing.featuresHeading}
              </h2>
            </div>
            <Link
              to={lpath('/how-it-works')}
              className="tkv-focusable min-h-[44px] inline-flex items-center gap-1.5 text-sm font-extrabold text-[var(--tkv-primary)] hover:underline"
            >
              <span>{dict.landing.featuresSeeAll}</span>
              <span aria-hidden="true" className="rtl:rotate-180">→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {dict.landing.coreFeatures.map((feat) => (
              <Link
                key={feat.to}
                to={lpath(feat.to)}
                className="tkv-focusable tkv-bento-card p-4 flex flex-col justify-between gap-3"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3">
                    <img
                      src={FEATURE_ICON_MAP[feat.icon]}
                      alt=""
                      aria-hidden="true"
                      width={50}
                      height={50}
                      loading="lazy"
                      className="w-12 h-12 rounded-xl object-contain shrink-0"
                    />
                    <div className="min-w-0">
                      <h3 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)]">
                        {feat.title}
                      </h3>
                      <p className="text-xs font-bold text-[var(--tkv-primary)]">{feat.subtitle}</p>
                    </div>
                  </div>
                  <p className="text-xs sm:text-sm text-[var(--tkv-ink-secondary)] leading-snug">
                    {feat.description}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[var(--tkv-primary)]">
                  <span>{dict.landing.explorePrefix} {feat.title}</span>
                  <span aria-hidden="true" className="rtl:rotate-180">›</span>
                </span>
              </Link>
            ))}
          </div>
        </section>

        {/* Bé Mầm Bếp 6-Pose Showcase */}
        <section
          aria-labelledby="tk-mascot-heading"
          className="rounded-3xl border border-[var(--tkv-border-mint)] bg-[var(--tkv-surface)] p-4 sm:p-7 flex flex-col gap-5 shadow-[var(--tkv-shadow-card)]"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col gap-1.5">
              <div>
                <span className="inline-flex items-center rounded-full bg-[var(--tkv-primary)] text-white px-3.5 py-1 text-xs font-extrabold">
                  {dict.landing.mascotEyebrow}
                </span>
              </div>
              <h2 id="tk-mascot-heading" className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
                {dict.landing.mascotHeading}
              </h2>
            </div>
            <p className="text-sm font-semibold text-[var(--tkv-ink-secondary)] max-w-md">
              {dict.brand.mascotDesc}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5">
            {dict.landing.mascotPoses.map((item) => (
              <div
                key={item.pose}
                className="rounded-2xl bg-[var(--tkv-bg)] border border-[var(--tkv-border)] p-3 sm:p-3.5 flex flex-col items-center text-center gap-2 min-w-0"
              >
                <img
                  src={item.img}
                  alt={`${dict.brand.mascotName} — ${item.title}`}
                  width={112}
                  height={112}
                  loading="lazy"
                  className="w-20 h-20 sm:w-28 sm:h-28 rounded-2xl object-contain"
                />
                <div className="flex flex-col gap-0.5 min-w-0">
                  <h3 className="tkv-heading text-sm font-extrabold text-[var(--tkv-ink)]">{item.title}</h3>
                  <p className="text-xs font-medium text-[var(--tkv-ink-muted)]">{item.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Verified Global Dishes Showcase — Clickable Links to Real Recipe Pages */}
        <section aria-labelledby="tk-dishes-heading" className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <div>
                <span className="inline-flex items-center rounded-full bg-[var(--tkv-surface-coral)] border border-[var(--tkv-border-coral)] px-3 py-1 text-xs font-extrabold text-[var(--tkv-coral-ink)]">
                  {dict.landing.dishesEyebrow}
                </span>
              </div>
              <h2 id="tk-dishes-heading" className="tkv-heading text-2xl sm:text-3xl font-extrabold text-[var(--tkv-ink)]">
                {dict.landing.dishesHeading}
              </h2>
            </div>
            <Link
              to={lpath('/recipes')}
              className="tkv-focusable min-h-[44px] inline-flex items-center gap-1.5 text-sm font-extrabold text-[var(--tkv-primary)] hover:underline"
            >
              <span>{dict.landing.dishesSeeAll}</span>
              <span aria-hidden="true" className="rtl:rotate-180">→</span>
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {dict.landing.showcaseDishes.map((dish) => (
              <Link
                key={dish.slug}
                to={lpath(`/recipes/${dish.slug}`)}
                className="tkv-focusable tkv-bento-card overflow-hidden flex flex-col justify-between group"
              >
                <div>
                  <div className="aspect-[4/3] overflow-hidden bg-[var(--tkv-surface-mint)]">
                    <img
                      src={dish.img}
                      alt={dish.title}
                      width={640}
                      height={480}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    />
                  </div>
                  <div className="p-4 flex flex-col gap-2">
                    <h3 className="tkv-heading text-base font-extrabold text-[var(--tkv-ink)] group-hover:text-[var(--tkv-primary)] transition-colors">
                      {dish.title}
                    </h3>
                    <p className="text-xs text-[var(--tkv-ink-secondary)] line-clamp-2">{dish.summary}</p>
                    <div className="flex items-center gap-2 flex-wrap pt-1 text-xs font-semibold text-[var(--tkv-ink-muted)] tabular-nums">
                      <span className="px-2 py-0.5 rounded-full bg-[var(--tkv-surface-mint)] text-[var(--tkv-primary)] font-bold">
                        {dish.time}
                      </span>
                      <span>· {dish.servings}</span>
                      <span>· {dish.level}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Transparent Pricing Callout */}
        <section
          aria-labelledby="tk-pricing-heading"
          className="rounded-3xl bg-[var(--tkv-surface-mint)] border border-[var(--tkv-border-mint)] p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6"
        >
          <div className="flex flex-col gap-2 max-w-2xl">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--tkv-surface)] border border-[var(--tkv-border-saffron)] px-3 py-1 text-xs font-extrabold text-[var(--tkv-ink)]">
                <span>{dict.landing.pricingEyebrow}</span>
              </span>
            </div>
            <h2 id="tk-pricing-heading" className="tkv-heading text-2xl font-extrabold text-[var(--tkv-ink)]">
              {dict.landing.pricingHeading}
            </h2>
            <p className="text-sm sm:text-base text-[var(--tkv-ink-secondary)] leading-relaxed">
              {dict.landing.pricingDesc}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <a
              href={buildAppHandoffUrl('/auth?mode=register', locale)}
              rel="nofollow"
              className="tkv-focusable min-h-[48px] px-6 py-2.5 rounded-full bg-[var(--tkv-primary)] hover:bg-[var(--tkv-primary-hover)] text-white font-extrabold text-sm inline-flex items-center justify-center transition-colors"
            >
              {dict.landing.pricingCtaPrimary}
            </a>
            <Link
              to={lpath('/pricing')}
              className="tkv-focusable min-h-[48px] px-5 py-2.5 rounded-full bg-[var(--tkv-surface)] border border-[var(--tkv-primary)] text-[var(--tkv-primary)] font-extrabold text-sm inline-flex items-center justify-center transition-colors"
            >
              {dict.landing.pricingCtaSecondary}
            </Link>
          </div>
        </section>

        {/* Brand Board v2 Culinary Hills Strip */}
        <div className="rounded-3xl overflow-hidden border border-[var(--tkv-border)] bg-white">
          <img
            src="/takolio/brand-v2/decor/culinary-hills-strip-640w.webp"
            srcSet="/takolio/brand-v2/decor/culinary-hills-strip-640w.webp 640w, /takolio/brand-v2/decor/culinary-hills-strip.webp 1280w"
            sizes="(max-width: 768px) 100vw, 1200px"
            alt=""
            aria-hidden="true"
            width={1280}
            height={220}
            loading="lazy"
            className="w-full h-24 sm:h-36 object-cover"
          />
        </div>
      </div>
    </SatelliteShell>
  );
};
