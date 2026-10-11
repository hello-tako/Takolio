import type { Context } from 'hono';
import type { AuthContext, Env } from '../types';
import { StrictOtpCoordinator, type StrictOtpResult } from './auth-otp';
import { readOtpDatabaseTime } from '../../../packages/db/src/auth-otp';
import { sendEmail, buildOtpEmail } from './email';
import { OTP_POLICY, type OtpPurpose } from '../config/otp-policy';
import { signJwt } from '../utils/jwt';
import { getJwtSecret } from '../middleware/auth';
import { SESSION_COOKIE, sha256Hex } from '../utils/session';

type OtpContext = Context<{ Bindings: Env; Variables: { auth: AuthContext } }>;
type Registration = { name: string; password: string };
const RESET_MESSAGE = 'Nếu email này có tài khoản Frigo, hướng dẫn đặt lại mật khẩu sẽ được gửi đến email của bạn.';

async function metadata(c: OtpContext, result?: StrictOtpResult) {
  let epoch = result && 'serverEpochMillis' in result ? result.serverEpochMillis : undefined;
  if (epoch === undefined && c.env.DB) {
    try { epoch = (await readOtpDatabaseTime(c.env.DB)) * 1000; } catch { /* No invented clock on D1 failure. */ }
  }
  return {
    ...(epoch === undefined ? {} : { otpKeyIssuedAtMs: epoch }),
    ...(result && 'expiresAt' in result && typeof result.expiresAt === 'number' ? { otpExpiresAtMs: result.expiresAt * 1000 } : {}),
  };
}

async function failure(c: OtpContext, result: StrictOtpResult) {
  const meta = await metadata(c, result);
  switch (result.kind) {
    case 'budget':
    case 'cooldown':
      c.header('Retry-After', String(result.retryAfterSeconds));
      return c.json({ ...meta, error: result.kind === 'budget'
        ? 'Đã hết lượt xác thực. Vui lòng đợi rồi thử lại.' : 'Vui lòng đợi trước khi yêu cầu mã mới.',
      code: result.kind === 'budget' ? 'OTP_BUDGET_EXHAUSTED' : 'OTP_COOLDOWN', retryAfterSeconds: result.retryAfterSeconds }, 429);
    case 'malformed': return c.json({ ...meta, error: 'Khóa yêu cầu OTP không hợp lệ.', code: 'OTP_KEY_MALFORMED' }, 400);
    case 'expired': return c.json({ ...meta, error: 'Yêu cầu OTP đã hết hạn. Hãy tạo yêu cầu mới.', code: 'OTP_KEY_EXPIRED' }, 410);
    case 'conflict': return c.json({ ...meta, error: 'Khóa yêu cầu đã được dùng cho dữ liệu khác.', code: 'OTP_REQUEST_CONFLICT' }, 409);
    case 'reissue_required': return c.json({ ...meta, error: 'Mã cũ cần được thay thế. Vui lòng yêu cầu mã OTP mới.', code: 'OTP_REISSUE_REQUIRED' }, 400);
    case 'invalid': return c.json({ ...meta, error: 'Mã OTP không chính xác hoặc đã được sử dụng.', code: 'OTP_INVALID' }, 400);
    case 'stale': return c.json({ ...meta, error: 'Mã OTP đã hết hạn hoặc được thay thế. Vui lòng yêu cầu mã mới.', code: 'OTP_STALE' }, 400);
    case 'in_progress': return c.json({ ...meta, success: false, error: 'Yêu cầu đang được xử lý. Vui lòng thử lại cùng yêu cầu.', code: 'OTP_IN_PROGRESS' }, 202);
    default: return c.json({ ...meta, error: 'Dịch vụ OTP tạm thời không khả dụng.', code: 'OTP_PROTECTION_UNAVAILABLE' }, 503);
  }
}

function generateOtp(): string {
  const random = crypto.getRandomValues(new Uint32Array(1));
  return String(100000 + (random[0] % 900000));
}

export async function issueStrictOtp(c: OtpContext, email: string, purpose: OtpPurpose,
  options: { source: 'register' | 'login' | 'forgot' | 'resend'; registration?: Registration; password?: string }) {
  if (!c.env.DB || !c.env.OTP_HASH_SECRET) return failure(c, { kind: 'unavailable' });
  const coordinator = new StrictOtpCoordinator(c.env.DB, c.env.OTP_HASH_SECRET);
  const code = generateOtp();
  const operation = purpose === 'forgot_password' ? 'issue_forgot' : purpose === 'register' ? 'issue_register' : 'issue_login';
  const result = await coordinator.reserveIssuance({ email, purpose, operation, code,
    requestKey: c.req.header('Idempotency-Key'), semanticBody: { source: options.source, ...(options.password ? { password: options.password } : {}) },
    ...(options.registration ? { registration: options.registration } : {}),
  });
  const meta = await metadata(c, result);
  const forgot = purpose === 'forgot_password';
  const retryAfterSeconds = 'expiresAt' in result && typeof result.expiresAt === 'number' && 'serverEpochMillis' in result
    && typeof result.serverEpochMillis === 'number' ? Math.max(0, Math.ceil(result.expiresAt - OTP_POLICY.challengeTtlSeconds + OTP_POLICY.issuanceCooldownSeconds - result.serverEpochMillis / 1000)) : 0;
  const issuanceMeta = { ...meta, retryAfterSeconds };
  const generic = { ...issuanceMeta, success: true, message: RESET_MESSAGE, expiresInMinutes: OTP_POLICY.challengeTtlSeconds / 60,
    otpDelivered: false, deliveryState: 'pending' as const };
  if (forgot && result.kind === 'stale') return c.json(generic);
  if (result.kind !== 'reserved' && result.kind !== 'issuance' && result.kind !== 'in_progress') {
    if (result.kind === 'unavailable' && options.registration) {
      const existing = await c.env.DB.prepare('SELECT is_verified FROM auth_accounts WHERE email = ?').bind(email).first<{ is_verified: number }>();
      if (existing?.is_verified === 1) return c.json({ ...meta, error: 'Email này đã được đăng ký. Vui lòng đăng nhập.', code: 'EMAIL_ALREADY_REGISTERED' }, 409);
    }
    return failure(c, result);
  }

  // Only a freshly acknowledged reservation can dispatch. A lost DB response is fail-closed.
  const deliver = async () => {
    if (result.kind !== 'reserved') return null;
    let state: 'accepted' | 'rejected' | 'delivery_unknown';
    if (result.accountId === null || result.userId === null) {
      state = 'accepted'; // Synthetic authority preserves accounting without sending to unknown accounts.
    } else {
      try {
        const message = buildOtpEmail(code, purpose);
        const sent = await sendEmail(c.env, { to: email, ...message, purpose });
        state = sent.state === 'accepted' ? 'accepted' : sent.state === 'delivery_unknown' ? 'delivery_unknown' : 'rejected';
        if (c.env.ENVIRONMENT === 'development' && sent.state === 'not_configured') state = 'accepted';
      } catch { state = 'delivery_unknown'; }
    }
    if (!await coordinator.recordDelivery(result.issuanceId, state)) return null;
    return state;
  };
  if (forgot) {
    if (result.kind === 'reserved') {
      const task = deliver().then(() => {}).catch(() => { console.error(JSON.stringify({ event: 'password_reset_delivery_record_failed' })); });
      try { c.executionCtx.waitUntil(task); } catch { void task; }
    }
    return c.json({ ...generic,
      ...(c.env.ENVIRONMENT === 'development' && result.kind === 'reserved' ? { devOtp: code } : {}),
    });
  }
  if (result.kind === 'in_progress') return c.json({ ...issuanceMeta, success: true, code: 'OTP_IN_PROGRESS',
    message: 'Yêu cầu gửi mã đang được xử lý.', expiresInMinutes: OTP_POLICY.challengeTtlSeconds / 60, otpDelivered: false, deliveryState: 'pending' }, 202);
  const state = result.kind === 'issuance' ? result.deliveryState : await deliver();
  if (state !== null && 'accountId' in result && result.accountId === null) return c.json({ ...issuanceMeta,
    success: true, message: 'Nếu tài khoản đang chờ xác thực, mã OTP mới sẽ được gửi.', expiresInMinutes: OTP_POLICY.challengeTtlSeconds / 60,
    otpDelivered: false, deliveryState: 'pending',
  });
  if (state === null) return failure(c, { kind: 'unavailable' });
  const response = { ...issuanceMeta, success: state === 'accepted', email, expiresInMinutes: OTP_POLICY.challengeTtlSeconds / 60,
    otpDelivered: state === 'accepted', deliveryState: state, replayed: result.kind === 'issuance',
    ...(c.env.ENVIRONMENT === 'development' && result.kind === 'reserved' ? { devOtp: code } : {}),
    ...(options.registration ? { accountCreated: true } : {}),
  };
  if (state === 'accepted') return c.json({ ...response, message: options.registration
    ? 'Mã xác thực đã được gửi. Mật khẩu được xác lập khi bạn hoàn tất xác thực email.' : 'Mã OTP đã được gửi đến email của bạn.' });
  return c.json({ ...response, error: state === 'delivery_unknown'
    ? 'Chưa xác định được kết quả gửi. Hãy kiểm tra email hoặc thử lại cùng yêu cầu.' : 'Email OTP chưa gửi được. Vui lòng đợi trước khi gửi lại.',
  code: state === 'delivery_unknown' ? 'OTP_DELIVERY_UNKNOWN' : 'OTP_DELIVERY_UNAVAILABLE' }, 503);
}

export async function verifyStrictOtp(c: OtpContext,
  input: { email: string; code: string; purpose: OtpPurpose; newPassword?: string; migrateFromHouseholdId?: string }) {
  // Inventory ownership transfer is a separate transaction design; keep the original household intact.
  if (input.purpose === 'register' && input.migrateFromHouseholdId) return c.json({
    ...await metadata(c), error: 'Chưa hỗ trợ chuyển dữ liệu hộ khách an toàn. Hãy giữ dữ liệu hộ khách và tài khoản mới riêng biệt.',
    code: 'INVENTORY_TRANSFER_DEFERRED',
  }, 409);
  if (!c.env.DB || !c.env.OTP_HASH_SECRET) return failure(c, { kind: 'unavailable' });
  const coordinator = new StrictOtpCoordinator(c.env.DB, c.env.OTP_HASH_SECRET);
  const operation = input.purpose === 'forgot_password' && input.newPassword !== undefined ? 'reset_final' : input.purpose === 'register'
    ? 'register_verify' : input.purpose === 'login' ? 'login_verify' : 'reset_preliminary';
  const result = await coordinator.verify({ ...input, operation, requestKey: c.req.header('Idempotency-Key') });
  const meta = await metadata(c, result);
  if (result.kind === 'proof') {
    const resetToken = await signJwt({ sub: input.email, hid: 'reset_flow', typ: 'reset',
      purpose: 'password_reset', exp: result.proofExpiresAt,
    }, getJwtSecret(c.env));
    return c.json({ ...meta, success: true, resetToken, email: input.email,
      replayed: result.replayed, message: 'Mã OTP hợp lệ. Hãy nhập mật khẩu mới của bạn.' });
  }
  if (input.purpose === 'forgot_password' && ['invalid', 'stale', 'reissue_required', 'delivery_not_ready'].includes(result.kind)) {
    return failure(c, { kind: 'invalid', ...('serverEpochMillis' in result ? { serverEpochMillis: result.serverEpochMillis } : {}) });
  }
  if (result.kind !== 'completed') return failure(c, result);
  if (result.sessionRequired) return c.json({ ...meta, success: true, replayed: true, sessionRequired: true,
    message: 'Yêu cầu đã hoàn tất. Vui lòng đăng nhập để lấy phiên mới.' });
  if (input.purpose === 'login') return c.json({ ...meta, success: true, replayed: result.replayed });
  if (!result.sessionToken || !result.accountId || !result.userId) return failure(c, { kind: 'unavailable' });
  const profile = await c.env.DB.prepare(`SELECT a.user_id, a.email, p.display_name, p.avatar_url, p.onboarding_completed_at
    FROM auth_accounts a JOIN users u ON u.id = a.user_id LEFT JOIN profiles p ON p.user_id = a.user_id
    WHERE a.id = ? AND a.user_id = ? AND lower(trim(a.email)) = ? AND a.is_verified = 1
      AND EXISTS (SELECT 1 FROM household_members m WHERE m.user_id = a.user_id AND m.household_id = ?)
      AND EXISTS (SELECT 1 FROM sessions_v2 s WHERE s.user_id = a.user_id AND s.household_id = ?
        AND s.token_hash = ? AND s.revoked_at IS NULL AND datetime(s.expires_at) > datetime('now'))`)
    .bind(result.accountId, result.userId, input.email, `hh_${result.userId}`, `hh_${result.userId}`, await sha256Hex(result.sessionToken))
    .first<{ user_id: string; email: string; display_name?: string; avatar_url?: string; onboarding_completed_at?: string }>();
  if (!profile) return failure(c, { kind: 'unavailable' });
  c.header('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(result.sessionToken)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${7 * 86400}`);
  return c.json({ ...meta, success: true, replayed: false, sessionRequired: false,
    message: input.purpose === 'register' ? 'Xác thực tài khoản thành công!' : 'Đặt lại mật khẩu thành công!',
    user: { id: profile.user_id, email: profile.email, displayName: profile.display_name || 'Người dùng Frigo',
      avatarUrl: profile.avatar_url || '/icons/favicon.svg', householdId: `hh_${profile.user_id}`,
      isGuest: false, onboardingCompleted: Boolean(profile.onboarding_completed_at) },
  });
}
