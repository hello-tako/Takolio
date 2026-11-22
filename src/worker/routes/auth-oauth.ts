import { Hono, type Context } from 'hono';
import { z } from 'zod';
import {
  localizeDefaultHouseholdName,
  localizeDefaultShoppingListName,
  resolveMarketDefaults,
  type SupportedLocale,
} from '../../../packages/domain/src/i18n';
import { SCAN_QUOTA_POLICY } from '../config/scan-quota-policy';
import { hasTrustedOrigin } from '../middleware/csrf';
import { negotiateEdgeLocaleContext } from '../middleware/locale';
import { rateLimiter } from '../middleware/rate-limit';
import type { AuthContext, Env } from '../types';
import {
  APPLE_JWKS_URL,
  APPLE_OIDC_ISSUER,
  LINE_JWKS_URL,
  LINE_OIDC_ISSUER,
  verifyOidcIdToken,
} from '../utils/jwks-oidc';
import { generateSessionToken, SESSION_COOKIE, sha256Hex } from '../utils/session';

type OAuthRouteEnv = { Bindings: Env; Variables: { auth: AuthContext } };

export const authOauthRoutes = new Hono<OAuthRouteEnv>();

const AppleAuthRequestSchema = z.object({
  identityToken: z.string().min(20).max(8192),
  nonce: z.string().min(1).max(256).optional(),
  user: z
    .object({
      name: z
        .object({
          firstName: z.string().max(100).optional(),
          lastName: z.string().max(100).optional(),
        })
        .optional(),
      email: z.string().email().max(254).optional(),
    })
    .optional(),
});

const LineAuthRequestSchema = z.object({
  idToken: z.string().min(20).max(8192),
  nonce: z.string().min(1).max(256).optional(),
  displayName: z.string().max(120).optional(),
});

for (const subPath of ['apple', 'line']) {
  authOauthRoutes.use(`/auth/${subPath}`, async (c, next) => {
    if (c.req.method === 'POST' && c.env.ENVIRONMENT === 'production' && !hasTrustedOrigin(c)) {
      return c.json({ error: 'Cross-site request blocked', code: 'CSRF_ORIGIN_DENIED' }, 403);
    }
    return next();
  });
}

authOauthRoutes.use('/auth/apple', rateLimiter({ maxRequests: 15, windowSeconds: 60, prefix: 'rl_auth_apple' }));
authOauthRoutes.use('/auth/line', rateLimiter({ maxRequests: 15, windowSeconds: 60, prefix: 'rl_auth_line' }));

function setSessionCookie(c: Context<OAuthRouteEnv>, token: string): void {
  c.header(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 86400}`,
  );
}

interface FederatedIdentityInput {
  provider: 'apple' | 'line';
  providerSubject: string;
  email: string | null;
  emailVerified: boolean;
  isPrivateRelay: boolean;
  displayName: string;
  avatarUrl: string | null;
  defaultCountryFallback: string;
  defaultLocaleFallback: SupportedLocale;
}

async function provisionFederatedSession(
  c: Context<OAuthRouteEnv>,
  identity: FederatedIdentityInput,
) {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }

  const existingOauth = await db
    .prepare(
      `SELECT oi.id, oi.user_id, oi.email, p.display_name, p.onboarding_completed_at
         FROM oauth_identities oi
         LEFT JOIN profiles p ON p.user_id = oi.user_id
        WHERE oi.provider = ? AND oi.provider_subject = ?
        LIMIT 1`,
    )
    .bind(identity.provider, identity.providerSubject)
    .first<{
      id: string;
      user_id: string;
      email: string | null;
      display_name: string | null;
      onboarding_completed_at: string | null;
    }>();

  let existingByEmail: { user_id: string; onboarding_completed_at: string | null } | null = null;
  if (identity.email && identity.emailVerified && !identity.isPrivateRelay) {
    existingByEmail = await db
      .prepare(
        `SELECT u.id AS user_id, p.onboarding_completed_at
           FROM users u
           LEFT JOIN profiles p ON p.user_id = u.id
          WHERE u.email = ?
          LIMIT 1`,
      )
      .bind(identity.email)
      .first<{ user_id: string; onboarding_completed_at: string | null }>();
  }

  if (existingOauth && existingByEmail && existingOauth.user_id !== existingByEmail.user_id) {
    return c.json(
      {
        error: 'This social identity conflicts with another registered account.',
        code: 'OAUTH_ACCOUNT_CONFLICT',
      },
      409,
    );
  }

  const subjectHashHex = await sha256Hex(`${identity.provider}:${identity.providerSubject}`);
  const prefix = identity.provider === 'apple' ? 'usr_ap_' : 'usr_ln_';
  const userId = existingOauth?.user_id ?? existingByEmail?.user_id ?? `${prefix}${subjectHashHex.slice(0, 30)}`;

  // Find existing primary household if returning user, else deterministic `hh_${userId}`.
  const existingHousehold = await db
    .prepare('SELECT household_id FROM household_members WHERE user_id = ? ORDER BY created_at ASC LIMIT 1')
    .bind(userId)
    .first<{ household_id: string }>();
  const householdId = existingHousehold?.household_id ?? `hh_${userId}`;

  const edgeLocale = negotiateEdgeLocaleContext(c.req, c.env);
  const useEdge = edgeLocale.source !== 'default';
  const bootstrapCountry = useEdge ? edgeLocale.countryCode : identity.defaultCountryFallback;
  const bootstrapLocale = useEdge ? edgeLocale.locale : identity.defaultLocaleFallback;
  const market = resolveMarketDefaults(bootstrapCountry, bootstrapLocale);

  const effectiveDisplayName = existingOauth?.display_name || identity.displayName;
  const effectiveEmail =
    identity.email ??
    existingOauth?.email ??
    `${identity.provider}.${subjectHashHex.slice(0, 20)}@federated.takolio.invalid`;

  const householdName = localizeDefaultHouseholdName(market.locale, { ownerName: effectiveDisplayName });
  const shoppingListName = localizeDefaultShoppingListName(market.locale);
  const defaultCuisinesJson = JSON.stringify(market.defaultCuisines);
  const oauthRowId = existingOauth?.id ?? `oid_${identity.provider}_${subjectHashHex.slice(0, 28)}`;

  await db.batch([
    db
      .prepare(
        `INSERT INTO users (id, email, is_guest)
         VALUES (?, ?, 0)
         ON CONFLICT(id) DO UPDATE SET
           email = COALESCE(users.email, excluded.email),
           is_guest = 0,
           updated_at = datetime('now')`,
      )
      .bind(userId, effectiveEmail),
    db
      .prepare(
        `INSERT INTO profiles (id, user_id, display_name, avatar_url)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           display_name = CASE
             WHEN length(trim(profiles.display_name)) > 0 THEN profiles.display_name
             ELSE excluded.display_name
           END,
           avatar_url = COALESCE(excluded.avatar_url, profiles.avatar_url),
           updated_at = datetime('now')`,
      )
      .bind(`prof_${userId}`, userId, effectiveDisplayName, identity.avatarUrl),
    db
      .prepare(
        `INSERT INTO oauth_identities (
           id, user_id, provider, provider_subject, email,
           email_verified, is_private_relay, display_name, avatar_url
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider, provider_subject) DO UPDATE SET
           email = COALESCE(excluded.email, oauth_identities.email),
           email_verified = MAX(oauth_identities.email_verified, excluded.email_verified),
           is_private_relay = MAX(oauth_identities.is_private_relay, excluded.is_private_relay),
           display_name = COALESCE(excluded.display_name, oauth_identities.display_name),
           avatar_url = COALESCE(excluded.avatar_url, oauth_identities.avatar_url),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
      )
      .bind(
        oauthRowId,
        userId,
        identity.provider,
        identity.providerSubject,
        identity.email,
        identity.emailVerified ? 1 : 0,
        identity.isPrivateRelay ? 1 : 0,
        effectiveDisplayName,
        identity.avatarUrl,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO households
           (id, name, created_by, locale, country_code, currency, timezone, week_start_day, is_default_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      )
      .bind(
        householdId,
        householdName,
        userId,
        market.locale,
        market.countryCode,
        market.currency,
        market.timeZone,
        market.weekStartDay,
      ),
    db
      .prepare('INSERT OR IGNORE INTO household_members (id, household_id, user_id, role) VALUES (?, ?, ?, ?)')
      .bind(`hm_${userId}`, householdId, userId, 'owner'),
    db
      .prepare(
        `INSERT OR IGNORE INTO user_preferences
           (id, user_id, household_size, spicy_level, favorite_cuisines, dietary_restrictions,
            language, locale, country_code, currency, timezone, week_start_day)
         VALUES (?, ?, 2, 'medium', ?, '[]', ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        `pref_${userId}`,
        userId,
        defaultCuisinesJson,
        market.locale,
        market.locale,
        market.countryCode,
        market.currency,
        market.timeZone,
        market.weekStartDay,
      ),
    db
      .prepare(
        `INSERT OR IGNORE INTO subscriptions
           (id, user_id, plan, status, scan_count_current_month, max_scans_per_month)
         VALUES (?, ?, 'free', 'active', 0, ?)`,
      )
      .bind(`sub_${userId}`, userId, SCAN_QUOTA_POLICY.free),
    db
      .prepare('INSERT OR IGNORE INTO shopping_lists (id, household_id, name, is_default_name) VALUES (?, ?, ?, 1)')
      .bind(`list_${householdId}`, householdId, shoppingListName),
  ]);

  const rawSessionToken = generateSessionToken();
  const tokenHash = await sha256Hex(rawSessionToken);
  const expiresAt = new Date((Math.floor(Date.now() / 1000) + 7 * 86400) * 1000).toISOString();
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  await db
    .prepare('INSERT INTO sessions_v2 (id, user_id, household_id, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(sessionId, userId, householdId, tokenHash, expiresAt)
    .run();

  setSessionCookie(c, rawSessionToken);

  return c.json({
    success: true,
    user: {
      id: userId,
      email: identity.email ?? existingOauth?.email ?? null,
      displayName: effectiveDisplayName,
      avatarUrl: identity.avatarUrl,
      householdId,
      provider: identity.provider,
      isPrivateRelay: identity.isPrivateRelay,
      locale: market.locale,
      countryCode: market.countryCode,
      currency: market.currency,
      timeZone: market.timeZone,
      isGuest: false,
      onboardingCompleted: Boolean(
        existingOauth?.onboarding_completed_at ?? existingByEmail?.onboarding_completed_at,
      ),
    },
  });
}

// 1. Sign in with Apple (`POST /api/v1/auth/apple`) — mandatory under iOS App Store Guideline 4.8.
authOauthRoutes.post('/auth/apple', async (c) => {
  if (!c.env.APPLE_CLIENT_ID) {
    return c.json({ error: 'Sign in with Apple is not configured', code: 'OAUTH_PROVIDER_UNAVAILABLE' }, 503);
  }

  const parsed = AppleAuthRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'Invalid Apple authentication payload', code: 'INVALID_PAYLOAD' }, 400);
  }

  let claims;
  try {
    const expectedNonceHash = parsed.data.nonce ? await sha256Hex(parsed.data.nonce) : undefined;
    claims = await verifyOidcIdToken({
      token: parsed.data.identityToken,
      expectedIssuer: APPLE_OIDC_ISSUER,
      expectedAudience: c.env.APPLE_CLIENT_ID,
      jwksUrl: c.env.APPLE_JWKS_URL || APPLE_JWKS_URL,
      expectedNonce: expectedNonceHash,
      cacheKv: c.env.CACHE,
    });
  } catch {
    return c.json({ error: 'Invalid or expired Apple identity token', code: 'INVALID_OAUTH_TOKEN' }, 401);
  }

  const email = (claims.email || parsed.data.user?.email || '').trim().toLowerCase() || null;
  const emailVerified = claims.email_verified === true || claims.email_verified === 'true';
  const isPrivateRelay =
    claims.is_private_email === true ||
    claims.is_private_email === 'true' ||
    Boolean(email && email.endsWith('@privaterelay.appleid.com'));

  // Apple sends `user.name` ONLY on the very first authorization!
  const firstName = parsed.data.user?.name?.firstName?.trim() ?? '';
  const lastName = parsed.data.user?.name?.lastName?.trim() ?? '';
  const fullName = [lastName, firstName].filter(Boolean).join(' ').trim() || email?.split('@')[0] || 'Takolio User';

  return provisionFederatedSession(c, {
    provider: 'apple',
    providerSubject: claims.sub,
    email,
    emailVerified,
    isPrivateRelay,
    displayName: fullName,
    avatarUrl: null,
    defaultCountryFallback: 'JP',
    defaultLocaleFallback: 'en',
  });
});

// 2. LINE Login (`POST /api/v1/auth/line`) — essential consumer login across Japan (`96M+` MAU).
authOauthRoutes.post('/auth/line', async (c) => {
  if (!c.env.LINE_CHANNEL_ID) {
    return c.json({ error: 'LINE Login is not configured', code: 'OAUTH_PROVIDER_UNAVAILABLE' }, 503);
  }

  const parsed = LineAuthRequestSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: 'Invalid LINE authentication payload', code: 'INVALID_PAYLOAD' }, 400);
  }

  let claims;
  try {
    claims = await verifyOidcIdToken({
      token: parsed.data.idToken,
      expectedIssuer: LINE_OIDC_ISSUER,
      expectedAudience: c.env.LINE_CHANNEL_ID,
      jwksUrl: c.env.LINE_JWKS_URL || LINE_JWKS_URL,
      hmacSecret: c.env.LINE_CHANNEL_SECRET,
      expectedNonce: parsed.data.nonce,
      cacheKv: c.env.CACHE,
    });
  } catch {
    return c.json({ error: 'Invalid or expired LINE ID token', code: 'INVALID_OAUTH_TOKEN' }, 401);
  }

  const email = (claims.email || '').trim().toLowerCase() || null;
  const displayName = (claims.name || parsed.data.displayName || '').trim() || 'LINEユーザー';

  return provisionFederatedSession(c, {
    provider: 'line',
    providerSubject: claims.sub,
    email,
    emailVerified: Boolean(email),
    isPrivateRelay: false,
    displayName,
    avatarUrl: claims.picture ?? null,
    defaultCountryFallback: 'JP',
    defaultLocaleFallback: 'ja',
  });
});
