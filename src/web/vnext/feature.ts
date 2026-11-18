import { useCallback, useEffect, useState } from 'react';

export type BrandDirection = 'a' | 'b' | 'c';

const PREVIEW_STORAGE_KEY = 'takolio-vnext-preview';
const DIRECTION_STORAGE_KEY = 'takolio-vnext-direction';

export function isVNextPreviewEnabled(search?: string): boolean {
  if (import.meta.env.VITE_VNEXT_UI_PREVIEW === 'true') return true;
  if (typeof window === 'undefined') return false;
  const rawSearch = search ?? window.location.search;
  const params = new URLSearchParams(rawSearch);
  const queryToggle = params.get('vnext');
  if (queryToggle === '1' || queryToggle === 'true') {
    try {
      sessionStorage.setItem(PREVIEW_STORAGE_KEY, '1');
    } catch {
      // Ignore storage quota/privacy restrictions.
    }
    return true;
  }
  if (queryToggle === '0' || queryToggle === 'false') {
    try {
      sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
    } catch {
      // Ignore storage restrictions.
    }
    return false;
  }
  try {
    return sessionStorage.getItem(PREVIEW_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
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
