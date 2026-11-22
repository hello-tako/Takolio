import type { KVNamespace } from '@cloudflare/workers-types';

/**
 * Edge-native OIDC ID Token & JWKS cryptographic verifier using Web Crypto (`crypto.subtle`).
 * Eliminates synchronous `tokeninfo` HTTP calls on every login and powers:
 * - Sign in with Apple (`RS256` via `https://appleid.apple.com/auth/keys`)
 * - LINE Login (`ES256` via `https://api.line.me/oauth2/v2.1/certs` or `HS256` via channel secret)
 * - Google OIDC (`RS256` via `https://www.googleapis.com/oauth2/v3/certs`)
 */

export interface OidcJwk extends JsonWebKey {
  kid?: string;
  alg?: string;
  use?: string;
}

export interface JwksDocument {
  keys: OidcJwk[];
}

export interface VerifiedOidcClaims {
  iss: string;
  sub: string;
  aud: string | string[];
  exp: number;
  iat?: number;
  email?: string;
  email_verified?: boolean | string;
  is_private_email?: boolean | string;
  name?: string;
  picture?: string;
  nonce?: string;
}

export interface VerifyOidcIdTokenOptions {
  token: string;
  expectedIssuer: string | readonly string[];
  expectedAudience: string;
  jwksUrl?: string;
  hmacSecret?: string;
  expectedNonce?: string;
  cacheKv?: KVNamespace;
  nowSec?: number;
  clockSkewSec?: number;
}

const isolateJwksCache = new Map<string, { expiresAtMs: number; keys: OidcJwk[] }>();

export function clearIsolateJwksCache(): void {
  isolateJwksCache.clear();
}

function base64UrlToBytes(input: string): Uint8Array {
  let b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function decodeJwtPartJson<T>(segment: string): T {
  const bytes = base64UrlToBytes(segment);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

async function fetchJwksKeys(jwksUrl: string, cacheKv?: KVNamespace): Promise<OidcJwk[]> {
  const nowMs = Date.now();
  const mem = isolateJwksCache.get(jwksUrl);
  if (mem && mem.expiresAtMs > nowMs) {
    return mem.keys;
  }

  const kvKey = `oidc_jwks:${jwksUrl}`;
  if (cacheKv) {
    try {
      const cached = await cacheKv.get<JwksDocument>(kvKey, 'json');
      if (cached && Array.isArray(cached.keys) && cached.keys.length > 0) {
        isolateJwksCache.set(jwksUrl, { expiresAtMs: nowMs + 5 * 60 * 1000, keys: cached.keys });
        return cached.keys;
      }
    } catch {
      // Fall through to live JWKS fetch
    }
  }

  const res = await fetch(jwksUrl, { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`JWKS_FETCH_FAILED_${res.status}`);
  }
  const doc = (await res.json()) as JwksDocument;
  if (!doc || !Array.isArray(doc.keys) || doc.keys.length === 0) {
    throw new Error('JWKS_EMPTY_KEYSET');
  }

  isolateJwksCache.set(jwksUrl, { expiresAtMs: nowMs + 15 * 60 * 1000, keys: doc.keys });
  if (cacheKv) {
    try {
      await cacheKv.put(kvKey, JSON.stringify({ keys: doc.keys }), { expirationTtl: 3600 });
    } catch {
      // Best-effort KV cache write
    }
  }
  return doc.keys;
}

async function verifySignatureWithJwk(
  alg: string,
  jwk: OidcJwk,
  signingInputBytes: Uint8Array,
  signatureBytes: Uint8Array,
): Promise<boolean> {
  if (alg === 'RS256') {
    if (jwk.kty !== 'RSA') return false;
    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      { ...jwk, alg: 'RS256', ext: true },
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    return crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      signatureBytes as BufferSource,
      signingInputBytes as BufferSource,
    );
  }

  if (alg === 'ES256') {
    if (jwk.kty !== 'EC' || jwk.crv !== 'P-256') return false;
    const cryptoKey = await crypto.subtle.importKey(
      'jwk',
      { ...jwk, alg: 'ES256', ext: true },
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    );
    return crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      cryptoKey,
      signatureBytes as BufferSource,
      signingInputBytes as BufferSource,
    );
  }

  return false;
}

async function verifyHmacSha256(
  secret: string,
  signingInputBytes: Uint8Array,
  signatureBytes: Uint8Array,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify(
    'HMAC',
    key,
    signatureBytes as BufferSource,
    signingInputBytes as BufferSource,
  );
}

export async function verifyOidcIdToken(options: VerifyOidcIdTokenOptions): Promise<VerifiedOidcClaims> {
  const parts = options.token.split('.');
  if (parts.length !== 3) {
    throw new Error('OIDC_MALFORMED_JWT');
  }

  const [headerSeg, payloadSeg, sigSeg] = parts;
  let header: { alg?: string; kid?: string; typ?: string };
  let claims: VerifiedOidcClaims;
  try {
    header = decodeJwtPartJson(headerSeg);
    claims = decodeJwtPartJson(payloadSeg);
  } catch {
    throw new Error('OIDC_INVALID_ENCODING');
  }

  const alg = header.alg ?? '';
  if (!['RS256', 'ES256', 'HS256'].includes(alg)) {
    throw new Error('OIDC_UNSUPPORTED_ALG');
  }

  const signingInputBytes = new TextEncoder().encode(`${headerSeg}.${payloadSeg}`);
  const signatureBytes = base64UrlToBytes(sigSeg);

  let signatureValid = false;
  if (alg === 'HS256') {
    if (!options.hmacSecret) throw new Error('OIDC_HMAC_SECRET_MISSING');
    signatureValid = await verifyHmacSha256(options.hmacSecret, signingInputBytes, signatureBytes);
  } else {
    if (!options.jwksUrl) throw new Error('OIDC_JWKS_URL_MISSING');
    const keys = await fetchJwksKeys(options.jwksUrl, options.cacheKv);
    const matchingKeys = header.kid ? keys.filter((k) => k.kid === header.kid) : keys;
    for (const jwk of matchingKeys) {
      if (await verifySignatureWithJwk(alg, jwk, signingInputBytes, signatureBytes)) {
        signatureValid = true;
        break;
      }
    }
  }

  if (!signatureValid) {
    throw new Error('OIDC_INVALID_SIGNATURE');
  }

  const allowedIssuers = Array.isArray(options.expectedIssuer)
    ? options.expectedIssuer
    : [options.expectedIssuer];
  if (!claims.iss || !allowedIssuers.includes(claims.iss)) {
    throw new Error('OIDC_ISSUER_MISMATCH');
  }

  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audiences.includes(options.expectedAudience)) {
    throw new Error('OIDC_AUDIENCE_MISMATCH');
  }

  if (typeof claims.sub !== 'string' || claims.sub.trim().length === 0) {
    throw new Error('OIDC_MISSING_SUBJECT');
  }

  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);
  const skew = options.clockSkewSec ?? 60;
  if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp + skew <= nowSec) {
    throw new Error('OIDC_TOKEN_EXPIRED');
  }
  if (claims.iat !== undefined && (typeof claims.iat !== 'number' || claims.iat - skew > nowSec)) {
    throw new Error('OIDC_ISSUED_IN_FUTURE');
  }

  if (options.expectedNonce !== undefined && claims.nonce !== options.expectedNonce) {
    throw new Error('OIDC_NONCE_MISMATCH');
  }

  return claims;
}

export const APPLE_OIDC_ISSUER = 'https://appleid.apple.com';
export const APPLE_JWKS_URL = 'https://appleid.apple.com/auth/keys';

export const LINE_OIDC_ISSUER = 'https://access.line.me';
export const LINE_JWKS_URL = 'https://api.line.me/oauth2/v2.1/certs';

export const GOOGLE_OIDC_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'] as const;
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
