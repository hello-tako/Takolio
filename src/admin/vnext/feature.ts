import { useLocation } from 'react-router-dom';

const ADMIN_VNEXT_STORAGE_KEY = 'takolio-admin-vnext';

export function isAdminVNextEnabled(search?: string): boolean {
  if (import.meta.env.VITE_VNEXT_UI_PREVIEW === 'true') return true;
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(search ?? window.location.search);
  const toggle = params.get('vnext');
  if (toggle === '1' || toggle === 'true') {
    try {
      sessionStorage.setItem(ADMIN_VNEXT_STORAGE_KEY, '1');
    } catch {
      // Ignore storage errors.
    }
    return true;
  }
  if (toggle === '0' || toggle === 'false') {
    try {
      sessionStorage.removeItem(ADMIN_VNEXT_STORAGE_KEY);
    } catch {
      // Ignore storage errors.
    }
    return false;
  }
  try {
    return sessionStorage.getItem(ADMIN_VNEXT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function useAdminVNext(): boolean {
  const { search } = useLocation();
  return isAdminVNextEnabled(search);
}
