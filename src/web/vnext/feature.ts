import { useCallback, useEffect, useState } from 'react';

export type BrandDirection = 'a' | 'b' | 'c';

const PREVIEW_STORAGE_KEY = 'takolio-vnext-preview';
const DIRECTION_STORAGE_KEY = 'takolio-vnext-direction';

/**
 * Owner approved Gate G02 (2026-11-18):
 * - Brand Direction A ("Kitchen Studio Leaf & Coral") is LOCKED as default.
 * - Production builds (`import.meta.env.PROD`) and explicit `?vnext=1` / `VITE_VNEXT_UI_PREVIEW=true`
 *   activate vNext Kitchen Studio UI by default, with instant `?vnext=0` / `VITE_VNEXT_UI_PREVIEW=false`
 *   rollback for release safety (`G12`).
 * - Vitest (`MODE === 'test'`) and isolated legacy E2E (`DEV` without `?vnext=1`) retain legacy
 *   entry components unless opted in via `?vnext=1`, preserving 100% of existing test contracts.
 */
export function isVNextPreviewEnabled(search?: string): boolean {
  if (import.meta.env.VITE_VNEXT_UI_PREVIEW === 'false') return false;
  if (import.meta.env.VITE_VNEXT_UI_PREVIEW === 'true') return true;
  if (typeof window === 'undefined') return false;

  const rawSearch = search ?? window.location.search;
  const params = new URLSearchParams(rawSearch);
  const queryToggle = params.get('vnext');

  if (queryToggle === '0' || queryToggle === 'false') {
    try {
      sessionStorage.setItem(PREVIEW_STORAGE_KEY, '0');
    } catch {
      // Ignore storage restrictions.
    }
    return false;
  }

  if (queryToggle === '1' || queryToggle === 'true') {
    try {
      sessionStorage.setItem(PREVIEW_STORAGE_KEY, '1');
    } catch {
      // Ignore storage quota/privacy restrictions.
    }
    return true;
  }

  try {
    const stored = sessionStorage.getItem(PREVIEW_STORAGE_KEY);
    if (stored === '0') return false;
    if (stored === '1') return true;
  } catch {
    // Ignore storage restrictions.
  }

  return Boolean(import.meta.env.PROD);
}

/** Appends `?vnext=1` only when running in non-PROD dev preview without session persistence yet. */
export function vnextHref(path: string): string {
  if (import.meta.env.PROD) return path;
  if (path.includes('vnext=')) return path;
  const [base, hash] = path.split('#');
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}vnext=1${hash ? `#${hash}` : ''}`;
}

export function resolveInitialDirection(search?: string): BrandDirection {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(search ?? window.location.search);
    const dir = params.get('dir')?.toLowerCase();
    if (dir === 'a' || dir === 'b' || dir === 'c') return dir;
    try {
      const stored = localStorage.getItem(DIRECTION_STORAGE_KEY);
      if (stored === 'a' || stored === 'b' || stored === 'c') return stored;
    } catch {
      // Ignore storage errors.
    }
  }
  return 'a';
}

export function useBrandDirection(search?: string): [BrandDirection, (next: BrandDirection) => void] {
  const [direction, setDirectionState] = useState<BrandDirection>(() => resolveInitialDirection(search));

  useEffect(() => {
    const params = new URLSearchParams(search ?? (typeof window !== 'undefined' ? window.location.search : ''));
    const dir = params.get('dir')?.toLowerCase();
    if (dir === 'a' || dir === 'b' || dir === 'c') {
      setDirectionState(dir);
    }
  }, [search]);

  const setDirection = useCallback((next: BrandDirection) => {
    setDirectionState(next);
    try {
      localStorage.setItem(DIRECTION_STORAGE_KEY, next);
    } catch {
      // Ignore storage errors.
    }
  }, []);

  return [direction, setDirection];
}
