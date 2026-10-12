import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ADMIN_RANGES, type AdminRange } from '@shared/admin';

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function parseRange(value: string | null): AdminRange {
  return (ADMIN_RANGES as readonly string[]).includes(value ?? '') ? (value as AdminRange) : '30d';
}

/** Overview, billing and AI share the range in the URL so a view can be deep-linked. */
export function useRangeParam(): [AdminRange, (next: AdminRange) => void] {
  const [params, setParams] = useSearchParams();
  const range = parseRange(params.get('range'));
  const setRange = useCallback(
    (next: AdminRange) => {
      setParams(
        (current) => {
          const updated = new URLSearchParams(current);
          updated.set('range', next);
          return updated;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return [range, setRange];
}

const SIDEBAR_KEY = 'takosan-admin.sidebar-collapsed';

export function storeSidebarPreference(collapsed: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
  } catch {
    // Storage unavailable; the preference applies on the next session that can persist it.
  }
}

/** Cosmetic only: the collapsed sidebar is remembered in this browser, never sent to the server. */
export function useSidebarCollapsed(): [boolean, () => void, (value: boolean) => void] {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(SIDEBAR_KEY) === '1';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
    } catch {
      // Storage can be unavailable (private mode); the preference simply does not persist.
    }
  }, [collapsed]);
  const toggle = useCallback(() => setCollapsed((value) => !value), []);
  return [collapsed, toggle, setCollapsed];
}
