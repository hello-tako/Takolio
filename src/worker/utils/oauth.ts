// Google OAuth ID Token Verification Utility
// Verifies Google ID tokens via Google's official public tokeninfo endpoint.
// SEC-8: the token's `aud` claim MUST match our OAuth Client ID — without this
// check, an ID token minted for ANY other Google OAuth client would be accepted
// (cross-client token substitution).

import type { KVNamespace } from '@cloudflare/workers-types';
import { GOOGLE_JWKS_URL, GOOGLE_OIDC_ISSUERS, verifyOidcIdToken } from './jwks-oidc';

export interface GoogleUserPayload {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  email_verified: boolean;
}

const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

export async function verifyGoogleTokenViaJwks(
  idToken: string,
  expectedAudience: string | undefined,
  options?: { cacheKv?: KVNamespace; jwksUrl?: string },
): Promise<{ valid: boolean; user?: GoogleUserPayload; error?: string }> {
  try {
    if (!idToken || typeof idToken !== 'string') {
      return { valid: false, error: 'Missing or invalid Google token' };
    }
    if (!expectedAudience) {
      return { valid: false, error: 'Google OAuth is not configured' };
    }
    const claims = await verifyOidcIdToken({
      token: idToken,
      expectedIssuer: GOOGLE_OIDC_ISSUERS,
      expectedAudience,
      jwksUrl: options?.jwksUrl || GOOGLE_JWKS_URL,
      cacheKv: options?.cacheKv,
    });
    if (!claims.email || !claims.sub) {
      return { valid: false, error: 'Google token does not contain email or sub claim' };
    }
    if (claims.email_verified === 'false' || claims.email_verified === false) {
      return { valid: false, error: 'Google account email is not verified' };
    }
    return {
      valid: true,
      user: {
        sub: claims.sub,
        email: claims.email.toLowerCase(),
        name: claims.name || claims.email.split('@')[0],
        picture: claims.picture,
        email_verified: true,
      },
    };
  } catch (err: unknown) {
    return { valid: false, error: err instanceof Error ? err.message : 'Failed to verify Google JWKS token' };
  }
}

export async function verifyGoogleToken(
  idToken: string,
  expectedAudience: string | undefined,
  options?: { useJwks?: boolean; cacheKv?: KVNamespace; jwksUrl?: string },
): Promise<{ valid: boolean; user?: GoogleUserPayload; error?: string }> {
  if (options?.useJwks) {
    return verifyGoogleTokenViaJwks(idToken, expectedAudience, options);
  }
  try {
    if (!idToken || typeof idToken !== 'string') {
      return { valid: false, error: 'Missing or invalid Google token' };
    }

    if (!expectedAudience) {
      return { valid: false, error: 'Google OAuth is not configured' };
    }

    // Query Google's tokeninfo API to cryptographically verify signature, audience, issuer and expiration
    const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      return { valid: false, error: (errBody as any)?.error_description || 'Invalid Google token signature' };
    }

    const data: any = await res.json();

    if (!data.email || !data.sub) {
      return { valid: false, error: 'Google token does not contain email or sub claim' };
    }

    // SEC-8: audience binding — token must have been issued FOR this app.
    if (data.aud !== expectedAudience) {
      return { valid: false, error: 'Google token was issued for a different application (aud mismatch)' };
    }

    // Validate issuer strictly against Google's official OIDC issuers.
    if (!GOOGLE_ISSUERS.has(String(data.iss || ''))) {
      return { valid: false, error: 'Google token issuer is not valid (iss mismatch)' };
    }

    // Ensure email is verified by Google
    if (data.email_verified === 'false' || data.email_verified === false) {
      return { valid: false, error: 'Google account email is not verified' };
    }

    return {
      valid: true,
      user: {
        sub: data.sub,
        email: data.email.toLowerCase(),
        name: data.name || data.email.split('@')[0],
        picture: data.picture,
        email_verified: true,
      },
    };
  } catch (err: any) {
    return { valid: false, error: err?.message || 'Failed to verify Google token' };
  }
}
