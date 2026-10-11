import { Context, Next } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { Env, AuthContext } from '../types';
import { verifyJwt, JwtPayload } from '../utils/jwt';
import { sha256Hex, SESSION_COOKIE } from '../utils/session';
import { hasTrustedOrigin } from './csrf';
import { SESSION_LAST_SEEN_INTERVAL_MINUTES } from '../config/sessions';

// SEC-01: No default JWT secret. If JWT_SECRET is not configured as a Wrangler
// secret, auth fails closed (503) instead of silently trusting a public key.
export function getJwtSecret(env: Env): string {
  const secret = env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new HTTPException(503, {
      message: 'Server auth chưa được cấu hình (JWT_SECRET). Liên hệ quản trị viên.',
    });
  }
  return secret;
}

// Paths that do not require authentication
const PUBLIC_PATHS = [
  '/health',
  '/config',
  '/auth/login',
  '/auth/register',
  '/auth/verify-otp',
  '/auth/resend-otp',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/google',
  '/auth/guest',
  '/auth/logout',
  '/billing/payos/webhook',
];

function hasExpectedOwner(
  c: Context<{ Bindings: Env; Variables: { auth: AuthContext } }>,
  auth: Pick<AuthContext, 'userId' | 'householdId'>,
): boolean {
  const userId = c.req.header('X-Frigo-Expected-User-Id');
  const householdId = c.req.header('X-Frigo-Expected-Household-Id');
  // Legacy clients omit both; owner-bound reads and writes must match both exactly.
  if (userId === undefined && householdId === undefined) return true;
  return Boolean(userId && householdId && userId === auth.userId && householdId === auth.householdId);
}

export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: { auth: AuthContext } }>,
  next: Next
) {
  const path = c.req.path;

  const cookieHeader = c.req.header('cookie') || '';
  const cookieToken = cookieHeader.split(';').map((v) => v.trim()).find((v) => v.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  const authHeader = c.req.header('authorization');
  const hasSessionCookie = cookieToken !== undefined;

  const isPublic = PUBLIC_PATHS.some((p) => path.endsWith(p));
  if (hasSessionCookie && (!isPublic || path.includes('/auth/')) && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
    if (!hasTrustedOrigin(c)) {
      return c.json({ error: 'Cross-site request blocked', code: 'CSRF_ORIGIN_DENIED' }, 403);
    }
  }

  if (isPublic) return await next();

  // Cookie-only sessions are authoritative. Bearer JWTs are retained only for
  // guest migration/reset compatibility and are never accepted for normal API access.
  if (hasSessionCookie) {
    c.header('Cache-Control', 'no-store');
    if (!c.env.DB) return c.json({ error: 'Authentication service unavailable', code: 'AUTH_UNAVAILABLE' }, 503);
    try {
      let tokenValue = '';
      try { tokenValue = decodeURIComponent(cookieToken ?? ''); } catch { tokenValue = ''; }
      if (!tokenValue) return c.json({ error: 'Unauthorized: Missing or invalid authorization token', code: 'UNAUTHORIZED' }, 401);
      const tokenHash = await sha256Hex(tokenValue);
      const row = await c.env.DB.prepare(
        `SELECT s.id, s.user_id, s.household_id, COALESCE(s.last_seen_at, s.created_at) AS last_seen_at, u.email, u.is_guest, p.display_name,
                EXISTS (SELECT 1 FROM household_members hm JOIN households h ON h.id = hm.household_id
                         WHERE hm.household_id = s.household_id AND hm.user_id = s.user_id
                           AND (u.is_guest = 0 OR h.created_by = s.user_id)) AS household_authorized
           FROM sessions_v2 s JOIN users u ON u.id = s.user_id
           LEFT JOIN profiles p ON p.user_id = s.user_id
          WHERE s.token_hash = ? AND s.revoked_at IS NULL AND datetime(s.expires_at) > datetime('now') LIMIT 1`
      ).bind(tokenHash).first<{ id: string; user_id: string; household_id: string; last_seen_at: string | null;
        email: string | undefined; is_guest: number; household_authorized: number }>();
      if (row) {
        if (!hasExpectedOwner(c, { userId: row.user_id, householdId: row.household_id })) {
          return c.json({ error: 'Request owner does not match authenticated session', code: 'SESSION_OWNER_MISMATCH' }, 403);
        }
        if (row.household_authorized !== 1) {
          return c.json({ error: 'Forbidden: You do not have permission to access this household data', code: 'TENANCY_VIOLATION' }, 403);
        }
        c.set('auth', { userId: row.user_id, householdId: row.household_id, email: row.email, isGuest: Boolean(row.is_guest), sessionId: row.id });
        const lastSeen = Date.parse(row.last_seen_at?.replace(' ', 'T') + (row.last_seen_at?.endsWith('Z') ? '' : 'Z'));
        if (!Number.isFinite(lastSeen) || lastSeen <= Date.now() - SESSION_LAST_SEEN_INTERVAL_MINUTES * 60_000) {
          await c.env.DB.prepare(`UPDATE sessions_v2 SET last_seen_at = datetime('now') WHERE id = ?
            AND (last_seen_at IS NULL OR datetime(last_seen_at) <= datetime('now', ?))`)
            .bind(row.id, `-${SESSION_LAST_SEEN_INTERVAL_MINUTES} minutes`).run().catch(() => {});
        }
        return await next();
      }
      return c.json({ error: 'Unauthorized: Missing or invalid authorization token', code: 'UNAUTHORIZED' }, 401);
    } catch {
      return c.json({ error: 'Authentication service unavailable', code: 'AUTH_UNAVAILABLE' }, 503);
    }
  }

  // Legacy bearer JWTs are accepted only for guest migration and reset-free
  // public compatibility; authenticated users must use the opaque cookie.
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // If public recipe reading, allow guest browsing
    if (c.req.method === 'GET' && path.includes('/recipes')) {
      if (!hasExpectedOwner(c, { userId: 'guest_anonymous', householdId: 'hh_guest_anonymous' })) {
        return c.json({ error: 'Request owner does not match authenticated session', code: 'SESSION_OWNER_MISMATCH' }, 403);
      }
      c.set('auth', {
        userId: 'guest_anonymous',
        householdId: 'hh_guest_anonymous',
        isGuest: true,
      });
      return await next();
    }

    return c.json(
      {
        error: 'Unauthorized: Missing or invalid authorization token',
        code: 'UNAUTHORIZED',
      },
      401
    );
  }

  const token = authHeader.replace('Bearer ', '').trim();

  const jwtSecret = getJwtSecret(c.env);

  // 1. Verify Cryptographic JWT
  const verification = await verifyJwt<JwtPayload>(token, jwtSecret);
  if (verification.valid && verification.payload && c.env.ENVIRONMENT !== 'production') {
    const p = verification.payload;
    const isValidAccess = p.typ === 'access' && p.isGuest !== true;
    const isValidGuest = p.typ === 'guest' && p.isGuest === true;
    if (!isValidAccess && !isValidGuest) {
      return c.json(
        {
          error: 'Unauthorized: Token type is not valid for API access',
          code: 'TOKEN_TYPE_INVALID',
        },
        401
      );
    }

    if (!hasExpectedOwner(c, { userId: p.sub, householdId: p.hid })) {
      return c.json({ error: 'Request owner does not match authenticated session', code: 'SESSION_OWNER_MISMATCH' }, 403);
    }
    c.set('auth', {
      userId: p.sub,
      householdId: p.hid,
      email: p.email,
      role: p.role || 'user',
      isGuest: isValidGuest,
    });
    return await next();
  }

  // SEC-5: No raw-token fallbacks. Previously a bearer token of `guest_*` was
  // accepted unconditionally and `usr_*` was accepted if the id existed in D1 —
  // letting anyone impersonate any user by guessing their id. Only signed JWTs
  // issued by /auth/* endpoints are accepted; guests get theirs from /auth/guest.
  // Token is invalid or expired
  return c.json(
    {
      error: `Unauthorized: ${verification.error || 'Token không hợp lệ hoặc đã hết hạn'}`,
      code: 'TOKEN_INVALID',
    },
    401
  );
}
