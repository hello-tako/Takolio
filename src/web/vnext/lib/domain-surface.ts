import { TAKOLIO_APP_ORIGIN, TAKOLIO_MARKETING_ORIGIN } from './seo';

/**
 * Dual-Domain Surface Coordinator (`takolio.com` Satellite/SEO/GEO <-> `takolio.app` Web App).
 *
 * Key browser physics constraint:
 * `.com` and `.app` are distinct eTLD+1 public suffixes — browsers strictly forbid sharing
 * `HttpOnly` session cookies, `localStorage`, or Service Workers across `takolio.com` and `takolio.app`.
 *
 * Therefore:
 * - On `takolio.com` (`www.takolio.com`), all public satellite routes (`/`, `/landing`, `/how-it-works`,
 *   `/features/*`, `/pricing`, `/faq`, `/stories`, `/about`, `/contact`, `/privacy`, `/terms`) render
 *   statelessly with zero session gate, and every app-entry CTA hands off cleanly to `https://takolio.app/...`
 *   so 1st-party cookies & guest/OAuth sessions are established directly on `takolio.app`.
 * - On `localhost` / `127.0.0.1` preview or `takolio.app`, navigation remains fast same-origin SPA routing.
 */

export type RuntimeDomainRole = 'satellite-com' | 'application-app' | 'local-unified';

export function detectRuntimeDomainRole(hostname?: string): RuntimeDomainRole {
  const host = (
    hostname ?? (typeof window !== 'undefined' ? window.location.hostname : '')
  ).toLowerCase();

  if (host === 'takolio.com' || host.endsWith('.takolio.com')) {
    return 'satellite-com';
  }
  if (
    host === 'takolio.app' ||
    host.endsWith('.takolio.app') ||
    host === 'frigo.tungjpstore.net'
  ) {
    return 'application-app';
  }
  return 'local-unified';
}

export function isSatelliteComRuntime(hostname?: string): boolean {
  return detectRuntimeDomainRole(hostname) === 'satellite-com';
}

/**
 * Builds an entry URL targeting the interactive Kitchen Web App (`takolio.app`).
 * - When running on `takolio.com`, returns an absolute `https://takolio.app/...` URL so session cookies
 *   are created 1st-party on `takolio.app`.
 * - When running locally (`127.0.0.1` / `localhost`) or already on `takolio.app`, returns a relative path.
 */
export function resolveAppSurfaceHref(appPath: string, hostname?: string): string {
  const clean = appPath.startsWith('/') ? appPath : `/${appPath}`;
  if (isSatelliteComRuntime(hostname)) {
    return `${TAKOLIO_APP_ORIGIN}${clean}`;
  }
  return clean;
}

/**
 * Builds a URL targeting the public Satellite / SEO / GEO site (`takolio.com`).
 * - When running on `takolio.app` in production, points back to canonical `https://takolio.com/...`.
 * - When running locally or already on `takolio.com`, returns a clean relative path.
 */
export function resolveSatelliteSurfaceHref(sitePath: string, hostname?: string): string {
  const clean = sitePath.startsWith('/') ? sitePath : `/${sitePath}`;
  if (detectRuntimeDomainRole(hostname) === 'application-app') {
    return `${TAKOLIO_MARKETING_ORIGIN}${clean === '/landing' ? '/' : clean}`;
  }
  return clean;
}

/**
 * Navigates to an App route (`takolio.app`), automatically performing a cross-origin handoff
 * when invoked from `takolio.com` or using React Router `navigate` when unified/same-origin.
 */
export function navigateToAppSurface(
  appPath: string,
  spaNavigate: (to: string) => void,
  hostname?: string,
): void {
  const target = resolveAppSurfaceHref(appPath, hostname);
  if (target.startsWith('https://') || target.startsWith('http://')) {
    window.location.assign(target);
    return;
  }
  spaNavigate(target);
}
