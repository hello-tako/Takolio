export type BrandDirection = 'a';

/**
 * Locked Production Brand Direction A ("Kitchen Studio Leaf & Coral") — Owner approved at Gate G02 & G12.
 * vNext is now the sole, unconditional consumer UI with zero legacy fallback.
 */
export function vnextHref(path: string): string {
  return path;
}

export function resolveInitialDirection(): BrandDirection {
  return 'a';
}

export function useBrandDirection(_search?: string): [BrandDirection, (next: BrandDirection) => void] {
  return ['a', () => {}];
}
