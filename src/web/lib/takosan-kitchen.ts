import { TAKOSAN_BRAND } from './takosan-brand';

/** Compatibility facade: both shells read the same V3 identity. */
export const TAKOSAN_KITCHEN = {
  name: TAKOSAN_BRAND.name,
  motto: TAKOSAN_BRAND.tagline,
  logo: TAKOSAN_BRAND.logos.horizontal,
  symbol: TAKOSAN_BRAND.symbol,
  symbolMicro: TAKOSAN_BRAND.symbolMicro,
  wordmark: TAKOSAN_BRAND.wordmark,
  stacked: TAKOSAN_BRAND.logos.stacked,
  reverse: `${TAKOSAN_BRAND.base}/logo/horizontal-reverse.svg`,
  mono: `${TAKOSAN_BRAND.base}/logo/horizontal-mono-dark.svg`,
  monoReverse: TAKOSAN_BRAND.logos.horizontalWhite,
  og: TAKOSAN_BRAND.og,
  appIcons: TAKOSAN_BRAND.appIcons,
  colors: { coral: TAKOSAN_BRAND.colors.coral, pine: TAKOSAN_BRAND.colors.green, ink: TAKOSAN_BRAND.colors.navy, canvas: TAKOSAN_BRAND.colors.cream },
} as const;
