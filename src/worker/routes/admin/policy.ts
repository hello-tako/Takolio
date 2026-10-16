import type { AdminEnv } from './env';
import { accessConfigured } from './access';

export type AdminEnvironment = 'development' | 'test' | 'staging' | 'production';
export type AdminAuthDecision = 'password' | 'cloudflare_access' | 'unavailable';
export type AdminPolicyReason =
  | 'ok'
  | 'auth_unavailable'
  | 'environment_invalid'
  | 'console_disabled'
  | 'origin_invalid'
  | 'origin_not_local'
  | 'origin_not_public_https'
  | 'customer_origin_missing'
  | 'origin_shared_with_customer';

export interface AdminPolicy {
  /** False means the whole admin surface (documents, assets, API) answers 404. */
  enabled: boolean;
  reason: AdminPolicyReason;
  environment: AdminEnvironment | null;
  /** Exact admin origin; requests for any other origin are 404. */
  origin: string | null;
  authMode: AdminAuthDecision;
  /** development/test: loopback-only console with in-memory limiter fallback. */
  local: boolean;
}

const ENVIRONMENTS: readonly AdminEnvironment[] = ['development', 'test', 'staging', 'production'];

// Defined only by local builds (wrangler.admin-local.jsonc `define`, local tooling,
// tests). Production/staging configs explicitly define false and remove local password code.
declare const __ADMIN_LOCAL_AUTH__: unknown;

export function localPasswordAuthCompiled(): boolean {
  return typeof __ADMIN_LOCAL_AUTH__ !== 'undefined' && __ADMIN_LOCAL_AUTH__ === true;
}

// DNS labels only (no wildcards, underscores or empty labels), IPv4 literals, or [::1].
const HOSTNAME = /^(?:(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?|\d{1,3}(?:\.\d{1,3}){3}|\[::1\])$/;

export function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

/** Accepts only an exact serialized origin (no path, query, credentials or trailing slash). */
export function parseExactOrigin(value: string | undefined): URL | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 255) return null;
  try {
    const url = new URL(value);
    if (url.origin !== value || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || !HOSTNAME.test(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}

function parseUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url : null;
  } catch {
    return null;
  }
}

/**
 * Server-side availability and authentication decision, derived only from
 * Worker configuration. No header, query parameter or client value is an input.
 */
export function resolveAdminPolicy(env: AdminEnv): AdminPolicy {
  const raw = env.ENVIRONMENT;
  const environment = (ENVIRONMENTS as readonly string[]).includes(raw ?? '') ? (raw as AdminEnvironment) : null;
  const local = environment === 'development' || environment === 'test';
  const disabled = (reason: AdminPolicyReason): AdminPolicy => ({ enabled: false, reason, environment, origin: null, authMode: 'unavailable', local });

  if (!environment) return disabled('environment_invalid');
  if (env.ADMIN_CONSOLE_ENABLED !== 'true') return disabled('console_disabled');
  const origin = parseExactOrigin(env.ADMIN_ORIGIN);
  if (!origin) return disabled('origin_invalid');
  const loopback = isLoopbackHostname(origin.hostname);
  if (local && !loopback) return disabled('origin_not_local');
  if (!local) {
    if (origin.protocol !== 'https:' || loopback) return disabled('origin_not_public_https');
    const customer = parseUrl(env.CUSTOMER_APP_URL);
    if (!customer) return disabled('customer_origin_missing');
    if (customer.hostname === origin.hostname) return disabled('origin_shared_with_customer');
  }

  let authMode: AdminAuthDecision = 'unavailable';
  if (env.ADMIN_AUTH_MODE === 'cloudflare_access' && accessConfigured(env)) authMode = 'cloudflare_access';
  else if (env.ADMIN_AUTH_MODE === 'password' && local && loopback && localPasswordAuthCompiled()) authMode = 'password';
  return { enabled: true, reason: authMode === 'unavailable' ? 'auth_unavailable' : 'ok', environment, origin: origin.origin, authMode, local };
}

/** Availability gate only; authorization never relies on the host. */
export function requestOriginMatches(policy: AdminPolicy, requestUrl: string): boolean {
  if (!policy.origin) return false;
  try {
    return new URL(requestUrl).origin === policy.origin;
  } catch {
    return false;
  }
}
