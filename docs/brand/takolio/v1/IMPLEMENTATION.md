# Takolio V1 implementation

Implementation checkpoint commit: `8e81d5d9879f6a8ea22db7cbc232fcf399a354fa`. Documentation/evidence follows in a separate checkpoint.

## Canonical source

- Contract: `src/web/lib/takolio-brand.ts` (`TAKOLIO_BRAND`). It owns name, tagline, supporting line, colors, logos, mascot poses, app icons, OG image and UI icons.
- Compatibility: `src/web/lib/takosan-brand.ts` re-exports the canonical contract; `src/web/lib/takosan-kitchen.ts` exposes the legacy kitchen facade. This keeps existing TypeScript consumers and persisted technical names stable without a second runtime brand source.
- Source masters: `docs/brand/takolio/v1/source/` contains 58 selected files: 2D master SVGs, outlined tagline/question paths, design tokens/guidelines, Plus Jakarta Sans subset and OFL notices. Reference boards, PDF and ZIP are absent.
- Runtime: `public/takolio/v1/` contains 69 hashed manifest assets (478,874 bytes) plus `asset-manifest.json`; generated output is deterministic with local Sharp 0.35.5 and pinned source paths.
- Generator: `scripts/generate-takolio-brand.mjs`; `pnpm brand:icons` regenerates Takolio. `pnpm brand:icons:v3` remains available for the preserved V3 line.

## Asset behavior

The generator creates primary/horizontal/stacked/wordmark/mono/reverse/micro logos, ten mascot poses, all 19 UI icons plus reverse scan, 16/24/32/48/64/128/180/192/256/512 platform icons, iOS 1024, Google Play 512, Android adaptive foreground/background, maskable 512 and OG 1200x630. SVG text is outlined from the pinned local font source; no network or host font is used. Monochrome mascot variants preserve eye/mouth knockouts. Multicolor UI icons render as original SVG images; they are not collapsed through a one-color CSS mask.

The maskable PNG is opaque with its artwork inside the 40% safe circle. Platform PNGs are opaque RGB; Android foreground is transparent RGBA. V3 files are not overwritten or deleted.

## Typography and tokens

Nunito V3 subsets are reused under the existing OFL source. Plus Jakarta Sans is self-hosted at `public/takolio/v1/fonts/plus-jakarta-sans-vietnamese-latin-wght.woff2`, generated from the pinned Google Fonts source commit recorded in `source/provenance.json` and distributed under SIL OFL 1.1. The Vietnamese glyph audit found no missing required codepoints in either family.

`src/web/styles/takosan-tokens.css` remains the semantic authority. The `.takosan-rebuild` scope maps Takolio Coral `#FF6B6B`, Navy `#0F2D46`, Gold `#F7C15A`, Green `#4CAF6B` (with derived accessible action green `#276F3F`), Cream `#FFF8ED` and support colors. Root/payment compatibility tokens and focus/error/warning semantics are retained. Tailwind and explicit CSS accent/yellow utilities resolve through scoped variables.

Contrast decisions are intentional: navy on cream is 13.41:1, white on navy is 14.15:1, white on derived green is 6.119:1 and navy on coral is 5.099:1. White on raw Coral (2.775:1) and white on raw Green (2.745:1) are avoided for normal CTA text.

## Public surfaces

Landing, auth, onboarding, home, planner/week, recipe, cooking, fridge/inventory, scan/review, shopping, profile, household, settings, notification, offline/error/loading states, header/navigation and PWA metadata now use the contract. `start_url`, `id`, scope, OAuth URLs, storage keys and cache lifecycle remain unchanged. `public/sw.js` precaches Takolio assets and retains Nunito plus old `/takosan/` fallback handling.

No native Android/iOS project exists in this repository; the generated platform assets are preparation only. No premium 3D mascot claim is made.

## Refreshed-main integration

Current diff/evidence base is `f7386e6a8d9ef8955cc314daebf4d1aeecf4e5a1` after PR #80. Compact kitchen layouts, progressive setup and shopping disclosure behavior from main are retained. The new `kitchen-density.css` uses existing semantic variables for its five remaining brand-dependent colors, and incoming display text uses Takolio. The synthetic QA harness starts a future valid plan and waits for enabled scan confirmation before checking images. No application business rule changes accompany this integration.
