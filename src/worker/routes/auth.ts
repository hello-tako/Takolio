import { Hono, type Context } from 'hono';
import type { D1DatabaseBinding } from '@frigo/db';
import { Env, AuthContext } from '../types';
import { SQL } from '@frigo/db';
import { hashPassword, generateSalt, verifyPassword } from '../utils/password';
import { generateSessionToken, sha256Hex, SESSION_COOKIE } from '../utils/session';
import { SCAN_QUOTA_POLICY } from '../config/scan-quota-policy';
import { verifyGoogleToken } from '../utils/oauth';
import { verifyTurnstileToken } from '../utils/turnstile';
import { hasTrustedOrigin } from '../middleware/csrf';
import { issueStrictOtp, verifyStrictOtp } from '../services/auth-otp-http';
import { getScanQuota } from '../services/scan-quota';

import { rateLimiter } from '../middleware/rate-limit';
import {
  RegisterSchema,
  LoginSchema,
  VerifyOtpSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ResendOtpSchema,
  GoogleAuthSchema,
} from '../validation/schemas';

type AuthRouteEnv = { Bindings: Env; Variables: { auth: AuthContext } };
interface ProfileRow {
  email: string | null; is_guest: number; display_name: string | null; avatar_url: string | null;
  onboarding_completed_at: string | null; household_id: string | null; household_name: string | null;
}
interface PreferencesRow {
  household_size: number; spicy_level: string; favorite_cuisines: string | null; dietary_restrictions: string | null;
}
interface PasswordAccountRow {
  user_id: string; password_hash: string; salt: string; is_verified: number;
  display_name: string | null; avatar_url: string | null; onboarding_completed_at: string | null;
}
interface GoogleAccountRow {
  id: string; user_id: string; email: string; google_id: string | null; onboarding_completed_at: string | null;
}
export const authRoutes = new Hono<AuthRouteEnv>();

// Session bootstrap also needs CSRF protection before a cookie exists.
for (const path of ['login', 'register', 'verify-otp', 'resend-otp', 'forgot-password', 'reset-password', 'google', 'guest', 'logout']) {
  authRoutes.use(`/auth/${path}`, async (c, next) => {
    if (c.req.method === 'POST' && c.env.ENVIRONMENT === 'production' && !hasTrustedOrigin(c)) {
      return c.json({ error: 'Cross-site request blocked', code: 'CSRF_ORIGIN_DENIED' }, 403);
    }
    return next();
  });
}

// First-cutover recovery retains strict accounting and denies OTP work before side effects.
for (const path of ['register', 'verify-otp', 'resend-otp', 'forgot-password', 'reset-password']) {
  authRoutes.use(`/auth/${path}`, async (c, next) => {
    if (c.req.method === 'POST' && c.env.STRICT_OTP_FAIL_CLOSED === 'true') {
      return c.json({ error: 'Xác minh mã tạm thời không khả dụng. Vui lòng thử lại sau.', code: 'AUTH_OTP_MAINTENANCE' }, 503);
    }
    return next();
  });
}

// Apply rate limiting to all auth endpoints (max 15 requests per minute)
authRoutes.use('/auth/*', rateLimiter({ maxRequests: 15, windowSeconds: 60, prefix: 'rl_auth' }));

function setSessionCookie(c: Context<AuthRouteEnv>, token: string): void {
  c.header('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 86400}`);
}

// Persist only the hash of the opaque cookie credential.
async function createSessionAndToken(
  db: D1DatabaseBinding,
  _env: Env,
  user: { id: string; email: string; householdId: string; role?: string; isGuest?: boolean }
): Promise<string> {
  if (!db) throw new Error('SESSION_PERSIST_FAILED');
  const token = generateSessionToken();
  const tokenHash = await sha256Hex(token);
  const expSec = Math.floor(Date.now() / 1000) + 7 * 86400;

  // Persist session to D1 if available
  if (db) {
    try {
      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const expiresAt = new Date(expSec * 1000).toISOString();
      await db
        .prepare('INSERT INTO sessions_v2 (id, user_id, household_id, token_hash, expires_at) VALUES (?, ?, ?, ?, ?)')
        .bind(sessionId, user.id, user.householdId, tokenHash, expiresAt)
        .run();
    } catch {
      console.error(JSON.stringify({ event: 'session_persist_failed' }));
      throw new Error('SESSION_PERSIST_FAILED');
    }
  }

  return token;
}

// 1. GET /me — Current User Profile
authRoutes.get('/me', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;

  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }

  try {
    const userRow = await db.prepare(SQL.GET_USER_PROFILE).bind(auth.householdId, auth.userId).first<ProfileRow>();
    const prefRow = await db.prepare(SQL.GET_USER_PREFERENCES).bind(auth.userId).first<PreferencesRow>();

    const quota = await getScanQuota(db, auth.userId);

    return c.json({
      user: {
        id: auth.userId,
        email: userRow?.email || auth.email || `${auth.userId}@frigo.local`,
        isGuest: Boolean(userRow?.is_guest ?? auth.isGuest),
        isPlus: quota.isPlus,
        displayName: userRow?.display_name || (auth.isGuest ? 'Khách ghé thăm' : 'Người dùng Frigo'),
        avatarUrl: userRow?.avatar_url || '/icons/favicon.svg',
        onboardingCompleted: Boolean(userRow?.onboarding_completed_at),
        household: {
          id: userRow?.household_id || auth.householdId,
          name: userRow?.household_name || 'Tủ lạnh của tôi',
        },
        preferences: prefRow
          ? {
              householdSize: prefRow.household_size,
              spicyLevel: prefRow.spicy_level,
              favoriteCuisines: JSON.parse(prefRow.favorite_cuisines || '["vietnamese"]'),
              dietaryRestrictions: JSON.parse(prefRow.dietary_restrictions || '[]'),
            }
          : {
              householdSize: 2,
              spicyLevel: 'medium',
              favoriteCuisines: ['vietnamese', 'korean'],
              dietaryRestrictions: [],
            },
        subscription: {
          ...quota,
          maxScans: quota.limit,
          scansUsed: quota.used,
        },
      },
    });
  } catch {
    console.error(JSON.stringify({ event: 'profile_load_failed' }));
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }
});

// 2. POST /auth/register — Register new account
authRoutes.post('/auth/register', async (c) => {
  const rawBody = await c.req.json().catch(() => ({}));

  // Production requires bot protection before account lookup.
  const turnstile = await verifyTurnstileToken(
    c.env,
    rawBody?.turnstileToken,
    c.req.header('cf-connecting-ip')
  );
  if (!turnstile.ok) {
    return c.json({ error: 'Xác thực chống bot thất bại. Vui lòng thử lại.', code: 'TURNSTILE_FAILED' }, 403);
  }

  const parseResult = RegisterSchema.safeParse(rawBody);

  if (!parseResult.success) {
    return c.json(
      {
        error: parseResult.error.issues[0]?.message || 'Dữ liệu đăng ký không hợp lệ',
        code: 'VALIDATION_ERROR',
      },
      400
    );
  }

  const { name, email, password } = parseResult.data;
  const normalizedEmail = email.trim().toLowerCase();
  const db = c.env.DB;

  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }

  try {
    return await issueStrictOtp(c, normalizedEmail, 'register', { source: 'register', registration: { name: name.trim(), password } });
  } catch {
    console.error(JSON.stringify({ event: 'registration_failed' }));
    return c.json({ error: 'Không thể tạo tài khoản', code: 'OTP_PROTECTION_UNAVAILABLE' }, 503);
  }
});

// 3. POST /auth/verify-otp — Verify OTP for Register or Forgot Password
authRoutes.post('/auth/verify-otp', async (c) => {
  const rawBody = await c.req.json().catch(() => ({}));
  const parseResult = VerifyOtpSchema.safeParse(rawBody);

  if (!parseResult.success) {
    return c.json(
      {
        error: parseResult.error.issues[0]?.message || 'Dữ liệu OTP không hợp lệ',
        code: 'VALIDATION_ERROR',
      },
      400
    );
  }

  const { email, code, purpose } = parseResult.data;
  const normalizedEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();
  const db = c.env.DB;

  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }

  try {
    return await verifyStrictOtp(c, { email: normalizedEmail, code: cleanCode, purpose, newPassword: purpose === 'register' ? parseResult.data.newPassword : undefined,
      migrateFromHouseholdId: parseResult.data.migrateFromHouseholdId });
  } catch {
    console.error(JSON.stringify({ event: 'otp_verification_failed' }));
    return c.json({ error: 'Dịch vụ OTP tạm thời không khả dụng.', code: 'OTP_PROTECTION_UNAVAILABLE' }, 503);
  }
});

// 4. POST /auth/resend-otp — Resend new OTP
authRoutes.post('/auth/resend-otp', async (c) => {
  const rawBody = await c.req.json().catch(() => ({}));
  const parsed = ResendOtpSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json(
      { error: parsed.error.issues[0]?.message || 'Email hoặc mục đích OTP không hợp lệ' },
      400
    );
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const purpose = parsed.data.purpose;
  const db = c.env.DB;

  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }

  try {
    return await issueStrictOtp(c, normalizedEmail, purpose, { source: 'resend' });
  } catch {
    console.error(JSON.stringify({ event: 'otp_resend_failed' }));
    return c.json({ error: 'Không thể gửi lại OTP lúc này.', code: 'OTP_PROTECTION_UNAVAILABLE' }, 503);
  }
});

// 5. POST /auth/login — Email/Password Login
authRoutes.post('/auth/login', async (c) => {
  const rawBody = await c.req.json().catch(() => ({}));

  const parseResult = LoginSchema.safeParse(rawBody);

  if (!parseResult.success) {
    return c.json(
      {
        error: parseResult.error.issues[0]?.message || 'Email hoặc mật khẩu không hợp lệ',
        code: 'VALIDATION_ERROR',
      },
      400
    );
  }

  const { email, password } = parseResult.data;
  const normalizedEmail = email.trim().toLowerCase();
  const db = c.env.DB;

  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }

  try {
    const account = await db
      .prepare(
        `SELECT a.user_id, a.password_hash, a.salt, a.is_verified, p.display_name, p.avatar_url, p.onboarding_completed_at
         FROM auth_accounts a
         LEFT JOIN profiles p ON p.user_id = a.user_id
         WHERE a.email = ?`
      )
      .bind(normalizedEmail)
      .first<PasswordAccountRow>();

    if (!account) {
      return c.json({ error: 'Email hoặc mật khẩu không chính xác' }, 401);
    }

    // Verify PBKDF2 password
    const isPasswordValid = await verifyPassword(password, account.salt, account.password_hash);
    if (!isPasswordValid) {
      // Legacy SHA-256 fallback migration check
      const encoder = new TextEncoder();
      const data = encoder.encode(`${password}:${account.salt}`);
      const legacyHashBuffer = await crypto.subtle.digest('SHA-256', data);
      const legacyHash = Array.from(new Uint8Array(legacyHashBuffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      if (legacyHash === account.password_hash) {
        // Upgrade legacy hash to PBKDF2 on the fly!
        const newSalt = generateSalt();
        const newPbkdf2Hash = await hashPassword(password, newSalt);
        await db
          .prepare('UPDATE auth_accounts SET password_hash = ?, salt = ? WHERE user_id = ?')
          .bind(newPbkdf2Hash, newSalt, account.user_id)
          .run();
      } else {
        return c.json({ error: 'Email hoặc mật khẩu không chính xác' }, 401);
      }
    }

    // Check email verification status
    if (account.is_verified === 0) {
      const issued = await issueStrictOtp(c, normalizedEmail, 'register', { source: 'login', password });
      const body = await issued.json() as Record<string, unknown>;
      return c.json({ ...body, requireOtp: true, email: normalizedEmail,
        error: 'Tài khoản chưa hoàn tất xác thực OTP.',
        code: issued.status === 200 ? 'OTP_REQUIRED' : body.code,
      }, issued.status === 200 ? 403 : issued.status as 202 | 400 | 409 | 410 | 429 | 503);
    }

    const householdId = `hh_${account.user_id}`;

    // SEC-04 FIX: Return signed cryptographic JWT
    const token = await createSessionAndToken(db, c.env, {
      id: account.user_id,
      email: normalizedEmail,
      householdId,
      role: 'owner',
    });
    setSessionCookie(c, token);

    return c.json({
      success: true,
      user: {
        id: account.user_id,
        email: normalizedEmail,
        displayName: account.display_name || 'Người dùng Frigo',
        avatarUrl: account.avatar_url || '/icons/favicon.svg',
        householdId,
        isGuest: false,
        onboardingCompleted: Boolean(account.onboarding_completed_at),
      },
    });
  } catch {
    console.error(JSON.stringify({ event: 'login_failed' }));
    return c.json({ error: 'Đăng nhập thất bại' }, 500);
  }
});

// 6. POST /auth/forgot-password — Request OTP for password reset
authRoutes.post('/auth/forgot-password', async (c) => {
  const rawBody = await c.req.json().catch(() => ({}));

  const parseResult = ForgotPasswordSchema.safeParse(rawBody);

  if (!parseResult.success) {
    return c.json({ error: 'Email không hợp lệ' }, 400);
  }

  const normalizedEmail = parseResult.data.email.trim().toLowerCase();
  const db = c.env.DB;

  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }

  try {
    return await issueStrictOtp(c, normalizedEmail, 'forgot_password', { source: 'forgot' });
  } catch {
    return c.json({ error: 'Không thể tạo yêu cầu quên mật khẩu', code: 'RESET_REQUEST_UNAVAILABLE' }, 503);
  }
});

// 7. POST /auth/reset-password — Confirm OTP and set new password
authRoutes.post('/auth/reset-password', async (c) => {
  const rawBody = await c.req.json().catch(() => ({}));
  const parseResult = ResetPasswordSchema.safeParse(rawBody);

  if (!parseResult.success) {
    return c.json(
      {
        error: parseResult.error.issues[0]?.message || 'Dữ liệu đặt lại mật khẩu không hợp lệ',
        code: 'VALIDATION_ERROR',
      },
      400
    );
  }

  const { email, code, newPassword } = parseResult.data;
  const normalizedEmail = email.trim().toLowerCase();
  const cleanCode = code.trim();
  const db = c.env.DB;

  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }

  try {
    return await verifyStrictOtp(c, { email: normalizedEmail, code: cleanCode, purpose: 'forgot_password', newPassword });
  } catch {
    console.error(JSON.stringify({ event: 'password_reset_failed' }));
    return c.json({ error: 'Dịch vụ OTP tạm thời không khả dụng.', code: 'OTP_PROTECTION_UNAVAILABLE' }, 503);
  }
});

// 8. POST /auth/google — Google Sign-In with Cryptographic OAuth Token Verification
authRoutes.post('/auth/google', async (c) => {
  const rawBody = await c.req.json().catch(() => ({}));
  const parseResult = GoogleAuthSchema.safeParse(rawBody);

  if (!parseResult.success) {
    return c.json({ error: 'Dữ liệu Google OAuth không hợp lệ' }, 400);
  }

  const { credential, userInfo } = parseResult.data;

  let email = '';
  let name = '';
  let googleId = '';
  let avatarUrl = '/icons/favicon.svg';

  // SEC-03 FIX: Cryptographically verify Google ID Token with Google's public endpoint
  if (credential) {
    if (!c.env.GOOGLE_CLIENT_ID) {
      return c.json({ error: 'Google Sign-In chưa được cấu hình', code: 'GOOGLE_NOT_CONFIGURED' }, 503);
    }
    const googleVerify = await verifyGoogleToken(credential, c.env.GOOGLE_CLIENT_ID);
    if (!googleVerify.valid || !googleVerify.user) {
      return c.json({ error: `Xác thực Google thất bại: ${googleVerify.error || 'Token không hợp lệ'}` }, 401);
    }
    email = googleVerify.user.email;
    name = googleVerify.user.name;
    googleId = googleVerify.user.sub;
    avatarUrl = googleVerify.user.picture || avatarUrl;
  } else if (userInfo && c.env.ENVIRONMENT !== 'production') {
    // Only allow manual userInfo payload in non-production environments
    email = userInfo.email.toLowerCase();
    name = userInfo.name || email.split('@')[0];
    googleId = userInfo.sub || `g_${Date.now()}`;
    avatarUrl = userInfo.picture || avatarUrl;
  } else {
    return c.json({ error: 'Yêu cầu Google OAuth credential hợp lệ' }, 400);
  }

  const db = c.env.DB;

  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }

  try {
    // Resolve email and provider identity independently. They should never
    // silently point at two different local accounts; doing so would let a
    // later upsert rebind one account to another provider identity.
    const existingByEmail = await db
      .prepare(`SELECT a.id, a.user_id, a.email, a.google_id, p.onboarding_completed_at
        FROM auth_accounts a LEFT JOIN profiles p ON p.user_id = a.user_id WHERE a.email = ? LIMIT 1`)
      .bind(email)
      .first<GoogleAccountRow>();
    const existingByGoogle = await db
      .prepare(`SELECT a.id, a.user_id, a.email, a.google_id, p.onboarding_completed_at
        FROM auth_accounts a LEFT JOIN profiles p ON p.user_id = a.user_id WHERE a.google_id = ? LIMIT 1`)
      .bind(googleId)
      .first<GoogleAccountRow>();

    if (
      existingByEmail &&
      existingByGoogle &&
      existingByEmail.user_id !== existingByGoogle.user_id
    ) {
      return c.json(
        {
          error: 'Tài khoản Google đã liên kết với một tài khoản Frigo khác',
          code: 'GOOGLE_ACCOUNT_CONFLICT',
        },
        409
      );
    }

    const existing = existingByEmail || existingByGoogle;
    // Google `sub` values are provider-controlled identifiers. Hash the full
    // value instead of truncating it (the old prefix scheme could collide).
    const googleDigest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(googleId)
    );
    const googleHash = Array.from(new Uint8Array(googleDigest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const userId = existing ? existing.user_id : `usr_g_${googleHash.slice(0, 32)}`;
    const householdId = `hh_${userId}`;

    await db.batch([
      // Preserve existing child rows when a returning Google user signs in.
      db.prepare(
        `INSERT INTO users (id, email, is_guest) VALUES (?, ?, 0)
         ON CONFLICT(id) DO UPDATE SET email = excluded.email, is_guest = 0, updated_at = datetime('now')`
      ).bind(userId, email),
      db.prepare(
        `INSERT INTO profiles (id, user_id, display_name, avatar_url) VALUES (?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name,
           avatar_url = excluded.avatar_url, updated_at = datetime('now')`
      ).bind(
        `prof_${userId}`,
        userId,
        name,
        avatarUrl
      ),
      db.prepare('INSERT OR IGNORE INTO households (id, name, created_by) VALUES (?, ?, ?)').bind(
        householdId,
        `Tủ lạnh của ${name}`,
        userId
      ),
      db.prepare(
        'INSERT OR IGNORE INTO household_members (id, household_id, user_id, role) VALUES (?, ?, ?, ?)'
      ).bind(`hm_${userId}`, householdId, userId, 'owner'),
      db.prepare(
        `INSERT INTO auth_accounts (id, user_id, email, google_id, is_verified)
         VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET
           user_id = excluded.user_id,
           email = excluded.email,
           google_id = excluded.google_id,
           is_verified = 1,
           updated_at = datetime('now')`
      ).bind(existing?.id || userId, userId, email, googleId),
      db.prepare(
        `INSERT OR IGNORE INTO user_preferences
          (id, user_id, household_size, spicy_level, favorite_cuisines, dietary_restrictions)
         VALUES (?, ?, 2, 'medium', '["vietnamese"]', '[]')`
      ).bind(`pref_${userId}`, userId),
      db.prepare(
        `INSERT OR IGNORE INTO subscriptions
          (id, user_id, plan, status, scan_count_current_month, max_scans_per_month)
         VALUES (?, ?, 'free', 'active', 0, ?)`
      ).bind(`sub_${userId}`, userId, SCAN_QUOTA_POLICY.free),
      db.prepare(
        'INSERT OR IGNORE INTO shopping_lists (id, household_id, name) VALUES (?, ?, ?)'
      ).bind(`list_hh_${userId}`, householdId, 'Danh sách mua sắm'),
    ]);

    // SEC-04 FIX: Return signed cryptographic JWT
    const token = await createSessionAndToken(db, c.env, {
      id: userId,
      email,
      householdId,
      role: 'owner',
    });
    setSessionCookie(c, token);

    return c.json({
      success: true,
      user: {
        id: userId,
        email,
        displayName: name,
        avatarUrl,
        householdId,
        isGuest: false,
        onboardingCompleted: Boolean(existing?.onboarding_completed_at),
      },
    });
  } catch {
    console.error(JSON.stringify({ event: 'google_auth_failed' }));
    return c.json({ error: 'Lỗi xác thực Google' }, 500);
  }
});

// 9. POST /auth/guest — Guest Mode with signed token
authRoutes.post('/auth/guest', async (c) => {
  // Keep the suffix alphanumeric so it remains compatible with the guest
  // migration contract (`hh_guest_<suffix>`), while avoiding timestamp-only
  // collisions under concurrent requests.
  const guestSuffix = `${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
  const newGuestId = `guest_${guestSuffix}`;
  const householdId = `hh_${newGuestId}`;
  const email = `${newGuestId}@frigo.local`;

  if (!c.env.DB) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }

  // A guest still needs real FK parents before inventory, scan, or shopping
  // mutations can be persisted. Without these rows every guest write fails
  // once D1 foreign-key enforcement is enabled.
  try {
    await c.env.DB.batch([
        c.env.DB
          .prepare('INSERT OR IGNORE INTO users (id, email, is_guest) VALUES (?, ?, 1)')
          .bind(newGuestId, email),
        c.env.DB
          .prepare('INSERT OR IGNORE INTO profiles (id, user_id, display_name, avatar_url) VALUES (?, ?, ?, ?)')
          .bind(`prof_${newGuestId}`, newGuestId, 'Khách ghé thăm', '/icons/favicon.svg'),
        c.env.DB
          .prepare('INSERT OR IGNORE INTO households (id, name, created_by) VALUES (?, ?, ?)')
          .bind(householdId, 'Tủ lạnh khách ghé thăm', newGuestId),
        c.env.DB
          .prepare(
            'INSERT OR IGNORE INTO household_members (id, household_id, user_id, role) VALUES (?, ?, ?, ?)'
          )
          .bind(`hm_${newGuestId}`, householdId, newGuestId, 'owner'),
        c.env.DB
          .prepare(
            'INSERT OR IGNORE INTO user_preferences (id, user_id, household_size, spicy_level, favorite_cuisines, dietary_restrictions) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .bind(`pref_${newGuestId}`, newGuestId, 2, 'medium', '["vietnamese"]', '[]'),
        c.env.DB
          .prepare(
            'INSERT OR IGNORE INTO subscriptions (id, user_id, plan, status, scan_count_current_month, max_scans_per_month) VALUES (?, ?, ?, ?, ?, ?)'
          )
          .bind(`sub_${newGuestId}`, newGuestId, 'free', 'active', 0, SCAN_QUOTA_POLICY.free),
        c.env.DB
          .prepare('INSERT OR IGNORE INTO shopping_lists (id, household_id, name) VALUES (?, ?, ?)')
          .bind(`list_${householdId}`, householdId, 'Danh sách mua sắm'),
    ]);
  } catch {
    console.error(JSON.stringify({ event: 'guest_initialization_failed' }));
    return c.json(
      {
        error: 'Không thể khởi tạo phiên khách. Vui lòng thử lại sau.',
        code: 'GUEST_INITIALIZATION_FAILED',
      },
      503
    );
  }

  const token = await createSessionAndToken(c.env.DB, c.env, {
    id: newGuestId,
    email,
    householdId,
    role: 'owner',
    isGuest: true,
  });
  setSessionCookie(c, token);

  return c.json({
    success: true,
    user: {
      id: newGuestId,
      email,
      displayName: 'Khách ghé thăm',
      avatarUrl: '/icons/favicon.svg',
      householdId,
      isGuest: true,
      onboardingCompleted: false,
    },
  });
});

// 10. POST /auth/logout — Sign out and revoke session
authRoutes.post('/auth/logout', async (c) => {
  const db = c.env.DB;
  const cookieHeader = c.req.header('cookie') || '';
  const cookieToken = cookieHeader.split(';').map((v) => v.trim()).find((v) => v.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (!db) return c.json({ error: 'Không thể đăng xuất lúc này', code: 'LOGOUT_FAILED' }, 503);
  if (cookieToken) {
    try {
      const tokenHash = await sha256Hex(decodeURIComponent(cookieToken));
      const result = await db.prepare("UPDATE sessions_v2 SET revoked_at = datetime('now') WHERE token_hash = ? AND revoked_at IS NULL").bind(tokenHash).run();
      if (result?.success === false) return c.json({ error: 'Không thể đăng xuất lúc này', code: 'LOGOUT_FAILED' }, 503);
    } catch {
      return c.json({ error: 'Không thể đăng xuất lúc này', code: 'LOGOUT_FAILED' }, 503);
    }
  }
  c.header('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  return c.json({ success: true, message: 'Đăng xuất thành công' });
});

// Legacy clients may check here, but only verified payment intents can grant Plus.
authRoutes.post('/auth/plus/activate', async (c) => {
  const auth = c.get('auth');
  const db = c.env.DB;
  const rawBody = await c.req.json().catch(() => ({}));

  if (auth?.isGuest) {
    return c.json({ error: 'Vui lòng đăng nhập để kích hoạt Frigo Plus.' }, 401);
  }

  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }

  if (rawBody && Object.prototype.hasOwnProperty.call(rawBody, 'grantCode')) {
    return c.json({ error: 'Kích hoạt bằng mã dùng chung không còn được hỗ trợ', code: 'LEGACY_GRANT_DISABLED' }, 410);
  }
  return c.json({
    success: true,
    granted: false,
    status: 'pending_verification',
    message: 'Chưa xác nhận thanh toán. Vui lòng kiểm tra lệnh thanh toán trong Takosan Plus.',
  });
});
