import type { AdminEnv } from './env';

/**
 * Cloudflare Access JWT verification adapter (RS256 against the team JWKS).
 * Verified offline only with locally generated keys; production use requires
 * a reviewed Access application. It never reports success without a valid
 * signature, audience, issuer and time window.
 */
export type AccessResult = { ok: true; email: string } | { ok: false; reason: string };

export interface AccessVerifierOptions {
  fetcher?: (url: string) => Promise<Response>;
  now?: () => number;
}

interface Jwk { kid?: string; kty: string; n?: string; e?: string; alg?: string }
// Test seam for the JWKS fetch and clock; production leaves it empty.
export const accessOptions: AccessVerifierOptions = {};

const JWKS_TTL_MS = 10 * 60_000;
const JWKS_FORCED_REFRESH_MIN_MS = 60_000;
const jwksCache = new Map<string, { keys: Jwk[]; fetchedAt: number }>();

export function resetAccessJwksCache(): void {
  jwksCache.clear();
}

function base64UrlDecode(input: string): Uint8Array<ArrayBuffer> {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(input.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function decodeJson(segment: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(new TextDecoder().decode(base64UrlDecode(segment)));
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

export function accessConfigured(env: Pick<AdminEnv, 'ADMIN_ACCESS_TEAM_DOMAIN' | 'ADMIN_ACCESS_AUD'>): boolean {
  return Boolean(env.ADMIN_ACCESS_TEAM_DOMAIN && /^[a-z0-9-]+\.cloudflareaccess\.com$/i.test(env.ADMIN_ACCESS_TEAM_DOMAIN) &&
    env.ADMIN_ACCESS_AUD && env.ADMIN_ACCESS_AUD.length >= 16);
}

async function loadKeys(teamDomain: string, fetcher: (url: string) => Promise<Response>, now: number, forceRefresh: boolean): Promise<Jwk[]> {
  const cached = jwksCache.get(teamDomain);
  if (cached && !forceRefresh && now - cached.fetchedAt < JWKS_TTL_MS) return cached.keys;
  const response = await fetcher(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!response.ok) throw new Error('JWKS_UNAVAILABLE');
  const body = await response.json() as { keys?: Jwk[] };
  const keys = Array.isArray(body.keys) ? body.keys.filter((key) => key.kty === 'RSA' && key.n && key.e) : [];
  jwksCache.set(teamDomain, { keys, fetchedAt: now });
  return keys;
}

export async function verifyAccessAssertion(
  assertion: string | undefined,
  env: Pick<AdminEnv, 'ADMIN_ACCESS_TEAM_DOMAIN' | 'ADMIN_ACCESS_AUD'>,
  options: AccessVerifierOptions = {},
): Promise<AccessResult> {
  if (!accessConfigured(env)) return { ok: false, reason: 'not_configured' };
  if (!assertion) return { ok: false, reason: 'missing_assertion' };
  const parts = assertion.split('.');
  if (parts.length !== 3) return { ok: false, reason: 'malformed' };
  const header = decodeJson(parts[0]);
  const payload = decodeJson(parts[1]);
  if (!header || !payload || header.alg !== 'RS256') return { ok: false, reason: 'malformed' };

  const teamDomain = env.ADMIN_ACCESS_TEAM_DOMAIN!.toLowerCase();
  const now = (options.now ?? Date.now)();
  const fetcher = options.fetcher ?? ((url: string) => fetch(url));
  let keys: Jwk[];
  try {
    keys = await loadKeys(teamDomain, fetcher, now, false);
    // Unknown kid: refresh at most once per minute so forged kids cannot amplify JWKS fetches.
    const fetchedAt = jwksCache.get(teamDomain)?.fetchedAt ?? 0;
    if (!keys.some((key) => key.kid === header.kid) && now - fetchedAt >= JWKS_FORCED_REFRESH_MIN_MS) {
      keys = await loadKeys(teamDomain, fetcher, now, true);
    }
  } catch {
    return { ok: false, reason: 'jwks_unavailable' };
  }
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) return { ok: false, reason: 'unknown_key' };

  let valid = false;
  try {
    const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, base64UrlDecode(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  } catch {
    valid = false;
  }
  if (!valid) return { ok: false, reason: 'bad_signature' };

  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audience.includes(env.ADMIN_ACCESS_AUD)) return { ok: false, reason: 'wrong_audience' };
  if (payload.iss !== `https://${teamDomain}`) return { ok: false, reason: 'wrong_issuer' };
  const seconds = Math.floor(now / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= seconds) return { ok: false, reason: 'expired' };
  if (typeof payload.nbf === 'number' && payload.nbf > seconds + 60) return { ok: false, reason: 'not_yet_valid' };
  if (typeof payload.email !== 'string' || !payload.email.includes('@')) return { ok: false, reason: 'missing_email' };
  return { ok: true, email: payload.email.trim().toLowerCase() };
}
