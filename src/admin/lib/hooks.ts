import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ADMIN_RANGES, type AdminPreferences, type AdminRange } from '@shared/admin';

export type UiDensity = AdminPreferences['density'];

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

const SIDEBAR_KEY = 'takolio-admin.sidebar-collapsed';
const LEGACY_SIDEBAR_KEY = 'takosan-admin.sidebar-collapsed';
const DENSITY_KEY = 'takolio-admin.density';

type Listener = () => void;
const sidebarListeners = new Set<Listener>();
const densityListeners = new Set<Listener>();

function readStoredSidebar(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const val = window.localStorage.getItem(SIDEBAR_KEY) ?? window.localStorage.getItem(LEGACY_SIDEBAR_KEY);
    return val === '1';
  } catch {
    return false;
  }
}

let memorySidebarCollapsed: boolean | null = null;

function getSidebarSnapshot(): boolean {
  if (memorySidebarCollapsed === null) {
    memorySidebarCollapsed = readStoredSidebar();
  }
  return memorySidebarCollapsed;
}

function subscribeSidebar(listener: Listener): () => void {
  sidebarListeners.add(listener);
  return () => {
    sidebarListeners.delete(listener);
  };
}

export function storeSidebarPreference(collapsed: boolean): void {
  memorySidebarCollapsed = collapsed;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SIDEBAR_KEY, collapsed ? '1' : '0');
    } catch {
      // Storage unavailable (private mode); memory state still updates current tab.
    }
  }
  sidebarListeners.forEach((listener) => listener());
}

/** Cosmetic sidebar collapse state shared across AdminShell and SettingsPage. */
export function useSidebarCollapsed(): [boolean, () => void, (value: boolean) => void] {
  const collapsed = useSyncExternalStore(subscribeSidebar, getSidebarSnapshot, () => false);
  const setCollapsed = useCallback((value: boolean) => storeSidebarPreference(value), []);
  const toggle = useCallback(() => storeSidebarPreference(!getSidebarSnapshot()), []);
  return [collapsed, toggle, setCollapsed];
}

function isDensity(value: unknown): value is UiDensity {
  return value === 'comfortable' || value === 'compact';
}

function readStoredDensity(): UiDensity {
  if (typeof window === 'undefined') return 'comfortable';
  try {
    const raw = window.localStorage.getItem(DENSITY_KEY);
    return isDensity(raw) ? raw : 'comfortable';
  } catch {
    return 'comfortable';
  }
}

let memoryDensity: UiDensity | null = null;

function applyDocumentDensity(density: UiDensity): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-density', density);
  }
}

function getDensitySnapshot(): UiDensity {
  if (memoryDensity === null) {
    memoryDensity = readStoredDensity();
    applyDocumentDensity(memoryDensity);
  }
  return memoryDensity;
}

function subscribeDensity(listener: Listener): () => void {
  densityListeners.add(listener);
  return () => {
    densityListeners.delete(listener);
  };
}

export function storeDensityPreference(density: UiDensity): void {
  if (!isDensity(density)) return;
  if (memoryDensity === density) {
    applyDocumentDensity(density);
    return;
  }
  memoryDensity = density;
  applyDocumentDensity(density);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(DENSITY_KEY, density);
    } catch {
      // Ignore storage quota / private mode failures.
    }
  }
  densityListeners.forEach((listener) => listener());
}

/** Reactive UI density (`comfortable` | `compact`) synced with `html[data-density]` and `.admin-app[data-density]`. */
export function useUiDensity(): [UiDensity, (next: UiDensity) => void] {
  const density = useSyncExternalStore<UiDensity>(subscribeDensity, getDensitySnapshot, () => 'comfortable');
  useEffect(() => {
    applyDocumentDensity(density);
  }, [density]);
  const setDensity = useCallback((next: UiDensity) => storeDensityPreference(next), []);
  return [density, setDensity];
}
