import { TAKOLIO_BRAND } from './takolio-brand';

/** Canonical Takolio Kitchen brand facade. */
export const TAKOLIO_KITCHEN = {
  name: TAKOLIO_BRAND.name,
  motto: TAKOLIO_BRAND.tagline,
  logo: TAKOLIO_BRAND.logos.horizontal,
  compactLogo: TAKOLIO_BRAND.compactLogo,
  symbol: TAKOLIO_BRAND.symbol,
  symbolMicro: TAKOLIO_BRAND.symbolMicro,
  wordmark: TAKOLIO_BRAND.wordmark,
  stacked: TAKOLIO_BRAND.logos.stacked,
  reverse: `${TAKOLIO_BRAND.base}/logo/horizontal-reverse.svg`,
  mono: `${TAKOLIO_BRAND.base}/logo/horizontal-mono-dark.svg`,
  monoReverse: TAKOLIO_BRAND.logos.horizontalWhite,
  og: TAKOLIO_BRAND.og,
  appIcons: TAKOLIO_BRAND.appIcons,
  colors: {
    coral: TAKOLIO_BRAND.colors.coral,
    pine: TAKOLIO_BRAND.colors.green,
    ink: TAKOLIO_BRAND.colors.navy,
    canvas: TAKOLIO_BRAND.colors.cream,
  },
} as const;
