import { useLocation } from 'react-router-dom';

const ADMIN_VNEXT_STORAGE_KEY = 'takolio-admin-vnext';

/**
 * Gate G10 — Admin Console vNext activation (`AD01–AD11`).
 * Enabled by default in production builds (`dist/admin`) and via `?vnext=1`,
 * with instant `?vnext=0` rollback.
 */
export function isAdminVNextEnabled(search?: string): boolean {
  if (import.meta.env.VITE_VNEXT_UI_PREVIEW === 'false') return false;
  if (import.meta.env.VITE_VNEXT_UI_PREVIEW === 'true') return true;
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(search ?? window.location.search);
  const toggle = params.get('vnext');
  if (toggle === '0' || toggle === 'false') {
    try {
      sessionStorage.setItem(ADMIN_VNEXT_STORAGE_KEY, '0');
    } catch {
      // Ignore storage errors.
    }
    return false;
  }
  if (toggle === '1' || toggle === 'true') {
    try {
      sessionStorage.setItem(ADMIN_VNEXT_STORAGE_KEY, '1');
    } catch {
      // Ignore storage errors.
    }
    return true;
  }
  try {
    const stored = sessionStorage.getItem(ADMIN_VNEXT_STORAGE_KEY);
    if (stored === '0') return false;
    if (stored === '1') return true;
  } catch {
    // Ignore storage errors.
  }
  return Boolean(import.meta.env.PROD);
}

export function useAdminVNext(): boolean {
  const { search } = useLocation();
  return isAdminVNextEnabled(search);
}
