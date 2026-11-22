import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { authMiddleware } from '../../src/worker/middleware/auth';
import { authRoutes } from '../../src/worker/routes/auth';
import type { AuthContext, Env } from '../../src/worker/types';
import { sha256Hex, SESSION_COOKIE } from '../../src/worker/utils/session';
import {
  call,
  closeDatabases,
  count,
  createDatabases,
  fx,
  localEnv,
  login,
  memoryKv,
  PASSWORD,
  setLocalAuthBuild,
  type Databases,
} from '../helpers/admin-harness';
import type { AdminEnv } from '../../src/worker/routes/admin/env';

vi.mock('../../src/worker/services/email', () => ({
  sendEmail: vi.fn(async () => ({ sent: true, provider: 'resend', state: 'accepted', evidence: 'http_response' })),
  buildOtpEmail: (code: string) => ({ subject: 'Test OTP', html: `<p>${code}</p>`, text: code }),
}));

const customerApp = new Hono<{ Bindings: Env; Variables: { auth: AuthContext } }>();
customerApp.use('/api/v1/*', authMiddleware);
customerApp.route('/api/v1', authRoutes);

let dbs: Databases;
let env: AdminEnv;

beforeAll(() => setLocalAuthBuild(true));
afterAll(() => setLocalAuthBuild(false));
beforeEach(() => {
  dbs = createDatabases();
  env = localEnv(dbs);
}, 30_000);
afterEach(() => closeDatabases(dbs));

async function callCustomer(
  pathname: string,
  options: {
    method?: string;
    body?: unknown;
    cookie?: string;
    headers?: Record<string, string>;
  } = {},
) {
  const method = options.method ?? 'GET';
  const headers = new Headers(options.headers);
  headers.set('CF-Connecting-IP', '198.51.100.42');
  if (method !== 'GET') {
    headers.set('Origin', 'http://127.0.0.1:8787');
  }
  if (options.cookie) {
    headers.set('Cookie', options.cookie);
  }
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await customerApp.fetch(
    new Request(`http://127.0.0.1:8787${pathname}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    }),
    {
      DB: dbs.main,
      CACHE: memoryKv(),
      JWT_SECRET: 'local-customer-jwt-secret-at-least-32-chars',
      ENVIRONMENT: 'development',
    } as never,
  );
  const text = await response.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, json, text, headers: response.headers };
}

describe('Admin v2 RBAC enforcement on operational endpoints', () => {
  it('enforces granular role matrix across READ_ONLY_AUDITOR, SUPPORT_AGENT, CONTENT_EDITOR, OPERATIONS_ADMIN, SUPER_ADMIN', async () => {
    const auditor = await login(env, fx('auditor'));
    const support = await login(env, fx('support'));
    const content = await login(env, fx('content'));
    const ops = await login(env, fx('ops'));
    const sup = await login(env, fx('super'));

    const recipe = dbs.main.query<{ id: string; version: number }>('SELECT id, version FROM recipes ORDER BY id LIMIT 1')[0];

    // 1. READ_ONLY_AUDITOR cannot execute any mutation
    for (const [path, method, body] of [
      ['/api/v1/admin/users/fx_user_009/verify-email', 'POST', { reason: 'Kiểm thử quyền kiểm toán' }],
      ['/api/v1/admin/users/fx_user_001/subscription/upgrade', 'POST', { duration: 'monthly', reason: 'Kiểm thử quyền' }],
      ['/api/v1/admin/users/fx_user_001/suspend', 'POST', { reason: 'Kiểm thử quyền' }],
      ['/api/v1/admin/users/fx_user_001/delete', 'POST', { mode: 'anonymize', reason: 'Kiểm thử quyền' }],
      ['/api/v1/admin/households/hh_fx_user_001', 'PATCH', { name: 'Bếp mới', reason: 'Kiểm thử quyền' }],
      ['/api/v1/admin/billing/transactions/fx_pay_4/mark-paid', 'POST', { reason: 'Kiểm thử quyền' }],
      [`/api/v1/admin/recipes/${recipe.id}/verification`, 'POST', { verificationState: 'reviewed', recipeVersion: recipe.version, reason: 'Kiểm thử quyền' }],
      ['/api/v1/admin/ai/scan-jobs/fx_job_2/retry', 'POST', { reason: 'Kiểm thử quyền' }],
      ['/api/v1/admin/system/hygiene', 'POST', { reason: 'Kiểm thử quyền' }],
    ] as const) {
      const res = await call(path, { env, method, session: auditor, body });
      expect(res.status, `auditor ${method} ${path}`).toBe(403);
      expect(res.json.code).toBe('ADMIN_FORBIDDEN');
    }

    // 2. SUPPORT_AGENT can execute support actions (verify-email, quota/reset, sessions/revoke, notify), but gets 403 on billing/suspend/delete
    expect(
      (await call('/api/v1/admin/users/fx_user_009/verify-email', {
        env,
        method: 'POST',
        session: support,
        body: { reason: 'Hỗ trợ xác minh email thủ công' },
      })).status,
    ).toBe(200);
    expect(
      (await call('/api/v1/admin/users/fx_user_001/quota/reset', {
        env,
        method: 'POST',
        session: support,
        body: { reason: 'Hỗ trợ đặt lại hạn mức quét' },
      })).status,
    ).toBe(200);
    expect(
      (await call('/api/v1/admin/users/fx_user_001/sessions/revoke', {
        env,
        method: 'POST',
        session: support,
        body: { reason: 'Hỗ trợ đăng xuất thiết bị' },
      })).status,
    ).toBe(200);
    expect(
      (await call('/api/v1/admin/users/fx_user_001/notify', {
        env,
        method: 'POST',
        session: support,
        body: { title: 'Hỗ trợ Takolio', message: 'Đã xử lý yêu cầu của bạn.', type: 'support', reason: 'Phản hồi phiếu hỗ trợ' },
      })).status,
    ).toBe(200);

    for (const [path, method, body] of [
      ['/api/v1/admin/users/fx_user_001/subscription/upgrade', 'POST', { duration: 'monthly', reason: 'Không đủ quyền' }],
      ['/api/v1/admin/users/fx_user_001/subscription/cancel', 'POST', { immediate: true, reason: 'Không đủ quyền' }],
      ['/api/v1/admin/users/fx_user_001/suspend', 'POST', { reason: 'Không đủ quyền' }],
      ['/api/v1/admin/users/fx_user_001/delete', 'POST', { mode: 'anonymize', reason: 'Không đủ quyền' }],
      ['/api/v1/admin/households/hh_fx_user_001', 'PATCH', { name: 'Bếp mới', reason: 'Không đủ quyền' }],
      ['/api/v1/admin/billing/transactions/fx_pay_4/mark-paid', 'POST', { reason: 'Không đủ quyền' }],
      [`/api/v1/admin/recipes/${recipe.id}/verification`, 'POST', { verificationState: 'reviewed', recipeVersion: recipe.version, reason: 'Không đủ quyền' }],
      ['/api/v1/admin/ai/scan-jobs/fx_job_2/retry', 'POST', { reason: 'Không đủ quyền' }],
      ['/api/v1/admin/system/hygiene', 'POST', { reason: 'Không đủ quyền' }],
    ] as const) {
      const res = await call(path, { env, method, session: support, body });
      expect(res.status, `support ${method} ${path}`).toBe(403);
      expect(res.json.code).toBe('ADMIN_FORBIDDEN');
    }

    // 3. CONTENT_EDITOR can verify & edit recipes, but gets 403 on users/*, billing/*, households/*, ai/*, system/*
    expect(
      (await call(`/api/v1/admin/recipes/${recipe.id}/verification`, {
        env,
        method: 'POST',
        session: content,
        body: { verificationState: 'reviewed', recipeVersion: recipe.version, reason: 'Biên tập viên duyệt công thức' },
      })).status,
    ).toBe(200);
    expect(
      (await call(`/api/v1/admin/recipes/${recipe.id}`, {
        env,
        method: 'PATCH',
        session: content,
        body: { title: 'Canh chua cá lóc chuẩn vị', reason: 'Chuẩn hóa tiêu đề món ăn' },
      })).status,
    ).toBe(200);

    for (const [path, method, body] of [
      ['/api/v1/admin/users/fx_user_001/verify-email', 'POST', { reason: 'Không đủ quyền' }],
      ['/api/v1/admin/users/fx_user_001/subscription/upgrade', 'POST', { duration: 'monthly', reason: 'Không đủ quyền' }],
      ['/api/v1/admin/billing/transactions/fx_pay_4/mark-paid', 'POST', { reason: 'Không đủ quyền' }],
      ['/api/v1/admin/ai/scan-jobs/fx_job_2/retry', 'POST', { reason: 'Không đủ quyền' }],
      ['/api/v1/admin/system/hygiene', 'POST', { reason: 'Không đủ quyền' }],
    ] as const) {
      const res = await call(path, { env, method, session: content, body });
      expect(res.status, `content ${method} ${path}`).toBe(403);
      expect(res.json.code).toBe('ADMIN_FORBIDDEN');
    }

    // 4. OPERATIONS_ADMIN can upgrade, suspend, mark-paid, retry, hygiene, but gets 403 on users/:id/delete
    expect(
      (await call('/api/v1/admin/users/fx_user_001/subscription/upgrade', {
        env,
        method: 'POST',
        session: ops,
        body: { duration: 'monthly', reason: 'Vận hành cấp gói Pro' },
      })).status,
    ).toBe(200);
    expect(
      (await call('/api/v1/admin/users/fx_user_002/suspend', {
        env,
        method: 'POST',
        session: ops,
        body: { reason: 'Vận hành tạm khóa tài khoản vi phạm' },
      })).status,
    ).toBe(200);
    expect(
      (await call('/api/v1/admin/billing/transactions/fx_pay_4/mark-paid', {
        env,
        method: 'POST',
        session: ops,
        body: { reason: 'Đối soát sao kê ngân hàng thành công' },
      })).status,
    ).toBe(200);
    expect(
      (await call('/api/v1/admin/ai/scan-jobs/fx_job_2/retry', {
        env,
        method: 'POST',
        session: ops,
        body: { reason: 'Chạy lại tác vụ OCR bị timeout' },
      })).status,
    ).toBe(200);
    expect(
      (await call('/api/v1/admin/system/hygiene', {
        env,
        method: 'POST',
        session: ops,
        body: { reason: 'Dọn dẹp định kỳ' },
      })).status,
    ).toBe(200);

    const opsDelete = await call('/api/v1/admin/users/fx_user_048/delete', {
      env,
      method: 'POST',
      session: ops,
      body: { mode: 'anonymize', reason: 'Vận hành thử xóa tài khoản' },
    });
    expect(opsDelete.status).toBe(403);
    expect(opsDelete.json.code).toBe('ADMIN_FORBIDDEN');

    // 5. SUPER_ADMIN can delete user
    const supDelete = await call('/api/v1/admin/users/fx_user_048/delete', {
      env,
      method: 'POST',
      session: sup,
      body: { mode: 'anonymize', reason: 'Quản trị cấp cao ẩn danh tài khoản theo yêu cầu' },
    });
    expect(supDelete.status).toBe(200);
  });
});

describe('Fail-closed audit and PII redaction in audit metadata', () => {
  it('blocks customer mutation with 503 if admin_audit_events write fails and never leaks unmasked emails in metadata_json', async () => {
    const sup = await login(env, fx('super'));

    const beforePlan = dbs.main.query<{ plan: string | null }>(
      "SELECT plan FROM subscriptions WHERE user_id = 'fx_user_001'",
    );

    let customerMutated = false;
    dbs.main.hooks.beforeStatement = (e) => {
      if (/INSERT|UPDATE|DELETE/i.test(e.sql)) customerMutated = true;
    };
    dbs.admin.hooks.beforeStatement = (e) => {
      if (e.sql.includes('INSERT INTO admin_audit_events')) {
        throw new Error('simulated audit D1 failure');
      }
    };

    const failedUpgrade = await call('/api/v1/admin/users/fx_user_001/subscription/upgrade', {
      env,
      method: 'POST',
      session: sup,
      body: { duration: 'monthly', reason: 'Nâng cấp khi kiểm toán lỗi' },
    });
    expect(failedUpgrade.status).toBe(503);
    expect(failedUpgrade.json.code).toBe('ADMIN_AUDIT_UNAVAILABLE');
    expect(customerMutated).toBe(false);
    expect(
      dbs.main.query<{ plan: string | null }>("SELECT plan FROM subscriptions WHERE user_id = 'fx_user_001'"),
    ).toEqual(beforePlan);

    // Restore hooks and run a real mutation
    dbs.main.hooks.beforeStatement = undefined;
    dbs.admin.hooks.beforeStatement = undefined;

    const okUpgrade = await call('/api/v1/admin/users/fx_user_001/subscription/upgrade', {
      env,
      method: 'POST',
      session: sup,
      body: { duration: 'monthly', reason: 'Cấp gói bù sự cố thanh toán cho khách hàng' },
    });
    expect(okUpgrade.status).toBe(200);

    const auditRow = dbs.admin.query<{ action: string; target_id: string; metadata_json: string }>(
      "SELECT action, target_id, metadata_json FROM admin_audit_events WHERE action = 'users.subscription.upgrade' ORDER BY occurred_at DESC LIMIT 1",
    )[0];
    expect(auditRow).toBeTruthy();
    expect(auditRow.target_id).toBe('fx_user_001');
    expect(JSON.parse(auditRow.metadata_json)).toMatchObject({
      reason: 'Cấp gói bù sự cố thanh toán cho khách hàng',
    });

    const allMetadata =
      dbs.admin.query<{ m: string | null }>('SELECT group_concat(metadata_json) AS m FROM admin_audit_events')[0].m ?? '';
    expect(allMetadata).not.toMatch(/customer\d{3}@|fixture\.takosan\.test/);
  });
});

describe('User lifecycle operations and Customer Worker enforcement', () => {
  it('upgrades subscription (monthly, annual, custom days + notifyUser) and cancels (period-end vs immediate)', async () => {
    const sup = await login(env, fx('super'));

    // Upgrade fx_user_001 with custom days and notification
    const up = await call('/api/v1/admin/users/fx_user_001/subscription/upgrade', {
      env,
      method: 'POST',
      session: sup,
      body: { duration: 'custom', customDays: 45, notifyUser: true, reason: 'Khuyến mãi trải nghiệm 45 ngày Pro' },
    });
    expect(up.status).toBe(200);
    expect(up.json.data).toMatchObject({
      userId: 'fx_user_001',
      plan: 'plus',
      status: 'active',
      notified: true,
    });
    const expiresAt = up.json.data.expiresAt as string;
    expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now() + 44 * 86_400_000);

    // Check D1 subscriptions & notifications
    const subRow = dbs.main.query<{ plan: string; status: string; max_scans_per_month: number }>(
      "SELECT plan, status, max_scans_per_month FROM subscriptions WHERE user_id = 'fx_user_001'",
    )[0];
    expect(subRow).toEqual({ plan: 'plus', status: 'active', max_scans_per_month: 500 });
    expect(
      count(dbs.main, "SELECT COUNT(*) AS n FROM notifications WHERE user_id = 'fx_user_001' AND type = 'billing'"),
    ).toBe(1);

    // GET /users/fx_user_001 reflects plus plan and 500 scan quota
    const detail = await call('/api/v1/admin/users/fx_user_001', { env, session: sup });
    expect(detail.status).toBe(200);
    expect(detail.json.data).toMatchObject({
      plan: 'plus',
      subscriptionStatus: 'active',
      subscriptionExpiresAt: expiresAt,
      scanQuota: { maxPerMonth: 500 },
    });

    // End-of-period cancel preserves plan='plus' and expiresAt
    const cancelPeriodEnd = await call('/api/v1/admin/users/fx_user_001/subscription/cancel', {
      env,
      method: 'POST',
      session: sup,
      body: { immediate: false, reason: 'Khách yêu cầu tắt gia hạn cuối kỳ' },
    });
    expect(cancelPeriodEnd.status).toBe(200);
    expect(cancelPeriodEnd.json.data).toMatchObject({
      userId: 'fx_user_001',
      plan: 'plus',
      status: 'cancelled',
      expiresAt,
      immediate: false,
    });

    // Immediate cancel drops to free and clears expiresAt
    const cancelImmediate = await call('/api/v1/admin/users/fx_user_001/subscription/cancel', {
      env,
      method: 'POST',
      session: sup,
      body: { immediate: true, reason: 'Hoàn tiền và hạ gói ngay lập tức' },
    });
    expect(cancelImmediate.status).toBe(200);
    expect(cancelImmediate.json.data).toMatchObject({
      userId: 'fx_user_001',
      plan: 'free',
      status: 'cancelled',
      expiresAt: null,
      immediate: true,
    });
  });

  it('suspends user -> revokes sessions & blocks Customer Worker (cookie, login, forgot-password) with 403 ACCOUNT_SUSPENDED -> unsuspends & restores Pro subscription', async () => {
    const sup = await login(env, fx('super'));

    // First upgrade fx_user_001 to Pro so we verify unsuspend preserves plan='plus' and original expiresAt
    const upgradeRes = await call('/api/v1/admin/users/fx_user_001/subscription/upgrade', {
      env,
      method: 'POST',
      session: sup,
      body: { duration: 'annual', reason: 'Gói năm trước khi tạm khóa' },
    });
    expect(upgradeRes.status).toBe(200);
    const originalExpiresAt = upgradeRes.json.data.expiresAt as string;

    // Customer logs in via Customer Worker and gets an active session cookie
    const custLoginBefore = await callCustomer('/api/v1/auth/login', {
      method: 'POST',
      body: { email: fx('customer001'), password: PASSWORD },
    });
    expect(custLoginBefore.status).toBe(200);
    const setCookies = custLoginBefore.headers.getSetCookie().join('\n');
    const tokenMatch = new RegExp(`${SESSION_COOKIE}=([^;]+)`).exec(setCookies);
    expect(tokenMatch).toBeTruthy();
    const customerCookie = `${SESSION_COOKIE}=${tokenMatch![1]}`;

    // Verify customer session works on /api/v1/me before suspension
    expect((await callCustomer('/api/v1/me', { cookie: customerCookie })).status).toBe(200);

    // Also insert an unrevoked session token to test authMiddleware's direct subscription_status check
    const rawDirectToken = 'd'.repeat(64);
    dbs.main.seed(
      `INSERT INTO sessions_v2 (id, user_id, household_id, token_hash, expires_at) VALUES ('sess_direct_check', 'fx_user_001', 'hh_fx_user_001', '${await sha256Hex(rawDirectToken)}', '2099-01-01T00:00:00.000Z')`,
    );

    // Suspend user from Admin Console
    const suspended = await call('/api/v1/admin/users/fx_user_001/suspend', {
      env,
      method: 'POST',
      session: sup,
      body: { reason: 'Phát hiện hành vi spam hệ thống' },
    });
    expect(suspended.status).toBe(200);
    expect(suspended.json.data).toMatchObject({
      userId: 'fx_user_001',
      accountStatus: 'suspended',
    });
    expect(suspended.json.data.revokedSessions).toBeGreaterThanOrEqual(2);
    expect(
      count(dbs.main, "SELECT COUNT(*) AS n FROM sessions_v2 WHERE user_id = 'fx_user_001' AND revoked_at IS NULL"),
    ).toBe(0);

    // Even if a session row were unrevoked, authMiddleware rejects suspended accounts with 403 ACCOUNT_SUSPENDED
    dbs.main.seed("UPDATE sessions_v2 SET revoked_at = NULL WHERE id = 'sess_direct_check'");
    const meWhileSuspended = await callCustomer('/api/v1/me', {
      cookie: `${SESSION_COOKIE}=${rawDirectToken}`,
    });
    expect(meWhileSuspended.status).toBe(403);
    expect(meWhileSuspended.json.code).toBe('ACCOUNT_SUSPENDED');

    // Customer Worker /api/v1/auth/login returns 403 ACCOUNT_SUSPENDED
    const loginWhileSuspended = await callCustomer('/api/v1/auth/login', {
      method: 'POST',
      body: { email: fx('customer001'), password: PASSWORD },
    });
    expect(loginWhileSuspended.status).toBe(403);
    expect(loginWhileSuspended.json.code).toBe('ACCOUNT_SUSPENDED');

    // Customer Worker /api/v1/auth/forgot-password returns 403 ACCOUNT_SUSPENDED
    const forgotWhileSuspended = await callCustomer('/api/v1/auth/forgot-password', {
      method: 'POST',
      body: { email: fx('customer001') },
    });
    expect(forgotWhileSuspended.status).toBe(403);
    expect(forgotWhileSuspended.json.code).toBe('ACCOUNT_SUSPENDED');

    // Unsuspend user from Admin Console
    const unsuspended = await call('/api/v1/admin/users/fx_user_001/unsuspend', {
      env,
      method: 'POST',
      session: sup,
      body: { reason: 'Đã xác minh tài khoản hợp lệ, mở khóa' },
    });
    expect(unsuspended.status).toBe(200);
    expect(unsuspended.json.data).toMatchObject({
      userId: 'fx_user_001',
      accountStatus: 'active',
    });

    // Verify previous Pro subscription and original expiresAt are intact
    const detailAfter = await call('/api/v1/admin/users/fx_user_001', { env, session: sup });
    expect(detailAfter.status).toBe(200);
    expect(detailAfter.json.data).toMatchObject({
      accountStatus: 'active',
      plan: 'plus',
      subscriptionStatus: 'active',
      subscriptionExpiresAt: originalExpiresAt,
    });

    // Customer login works again (200)
    const loginAfterUnsuspend = await callCustomer('/api/v1/auth/login', {
      method: 'POST',
      body: { email: fx('customer001'), password: PASSWORD },
    });
    expect(loginAfterUnsuspend.status).toBe(200);
    expect(loginAfterUnsuspend.json.success).toBe(true);
  });

  it('deletes user in anonymize mode (preserves payment_intents, scrubs PII) and purge mode (removes user cleanly with PRAGMA foreign_key_check)', async () => {
    const sup = await login(env, fx('super'));

    // Find a customer with payment_intents for anonymize test (e.g. fx_user_006)
    const userWithPayments = dbs.main.query<{ user_id: string; c: number }>(
      'SELECT user_id, COUNT(*) AS c FROM payment_intents GROUP BY user_id HAVING c > 0 ORDER BY user_id LIMIT 1',
    )[0];
    expect(userWithPayments.c).toBeGreaterThan(0);
    const anonUserId = userWithPayments.user_id;

    const anonRes = await call(`/api/v1/admin/users/${anonUserId}/delete`, {
      env,
      method: 'POST',
      session: sup,
      body: { mode: 'anonymize', reason: 'Yêu cầu xóa dữ liệu cá nhân theo GDPR/PDPA' },
    });
    expect(anonRes.status).toBe(200);
    expect(anonRes.json.data).toMatchObject({
      userId: anonUserId,
      mode: 'anonymize',
      accountStatus: 'deleted',
    });

    // Payment intents preserved for accounting
    expect(count(dbs.main, 'SELECT COUNT(*) AS n FROM payment_intents WHERE user_id = ?', anonUserId)).toBe(
      userWithPayments.c,
    );
    // Solo household, auth_accounts, sessions_v2 deleted
    expect(count(dbs.main, 'SELECT COUNT(*) AS n FROM households WHERE id = ?', `hh_${anonUserId}`)).toBe(0);
    expect(count(dbs.main, 'SELECT COUNT(*) AS n FROM auth_accounts WHERE user_id = ?', anonUserId)).toBe(0);
    expect(count(dbs.main, 'SELECT COUNT(*) AS n FROM sessions_v2 WHERE user_id = ?', anonUserId)).toBe(0);
    // Email scrubbed & profile anonymized
    const scrubbedUser = dbs.main.query<{ email: string | null; is_guest: number }>(
      'SELECT email, is_guest FROM users WHERE id = ?',
      anonUserId,
    )[0];
    expect(scrubbedUser).toEqual({ email: null, is_guest: 1 });
    const scrubbedProfile = dbs.main.query<{ display_name: string }>(
      'SELECT display_name FROM profiles WHERE user_id = ?',
      anonUserId,
    )[0];
    expect(scrubbedProfile.display_name).toBe('[Tài khoản đã xoá]');

    // Purge mode on fx_user_007 completely removes user and solo household with zero FK violations
    const purgeUserId = 'fx_user_007';
    const purgeRes = await call(`/api/v1/admin/users/${purgeUserId}/delete`, {
      env,
      method: 'POST',
      session: sup,
      body: { mode: 'purge', reason: 'Xóa vĩnh viễn tài khoản thử nghiệm' },
    });
    expect(purgeRes.status).toBe(200);
    expect(purgeRes.json.data).toMatchObject({
      userId: purgeUserId,
      mode: 'purge',
      accountStatus: 'deleted',
    });
    expect(count(dbs.main, 'SELECT COUNT(*) AS n FROM users WHERE id = ?', purgeUserId)).toBe(0);
    expect(count(dbs.main, 'SELECT COUNT(*) AS n FROM households WHERE id = ?', `hh_${purgeUserId}`)).toBe(0);
    expect(dbs.main.query('PRAGMA foreign_key_check')).toEqual([]);
  });

  it('refuses self-suspend, self-delete, and suspending or deleting a platform admin with 403 ADMIN_FORBIDDEN', async () => {
    const sup = await login(env, fx('super'));

    // Self-suspend & self-delete
    const selfSuspend = await call('/api/v1/admin/users/fx_admin_super/suspend', {
      env,
      method: 'POST',
      session: sup,
      body: { reason: 'Tự khóa tài khoản' },
    });
    expect(selfSuspend.status).toBe(403);
    expect(selfSuspend.json.code).toBe('ADMIN_FORBIDDEN');

    const selfDelete = await call('/api/v1/admin/users/fx_admin_super/delete', {
      env,
      method: 'POST',
      session: sup,
      body: { mode: 'anonymize', reason: 'Tự xóa tài khoản' },
    });
    expect(selfDelete.status).toBe(403);
    expect(selfDelete.json.code).toBe('ADMIN_FORBIDDEN');

    // Platform admin protection (fx_admin_ops)
    const adminSuspend = await call('/api/v1/admin/users/fx_admin_ops/suspend', {
      env,
      method: 'POST',
      session: sup,
      body: { reason: 'Thử khóa quản trị viên vận hành' },
    });
    expect(adminSuspend.status).toBe(403);
    expect(adminSuspend.json.code).toBe('ADMIN_FORBIDDEN');

    const adminDelete = await call('/api/v1/admin/users/fx_admin_ops/delete', {
      env,
      method: 'POST',
      session: sup,
      body: { mode: 'purge', reason: 'Thử xóa quản trị viên vận hành' },
    });
    expect(adminDelete.status).toBe(403);
    expect(adminDelete.json.code).toBe('ADMIN_FORBIDDEN');
  });

  it('executes verify-email, quota/reset, sessions/revoke, and notify accurately on D1', async () => {
    const sup = await login(env, fx('super'));

    // fx_user_009 is seeded unverified (9 % 9 === 0)
    expect(
      dbs.main.query<{ is_verified: number }>("SELECT is_verified FROM auth_accounts WHERE user_id = 'fx_user_009'")[0]
        .is_verified,
    ).toBe(0);
    const verifyRes = await call('/api/v1/admin/users/fx_user_009/verify-email', {
      env,
      method: 'POST',
      session: sup,
      body: { reason: 'Xác minh email thủ công cho khách không nhận được OTP' },
    });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.json.data).toMatchObject({ userId: 'fx_user_009', isVerified: true, accountsUpdated: 1 });
    expect(
      dbs.main.query<{ is_verified: number }>("SELECT is_verified FROM auth_accounts WHERE user_id = 'fx_user_009'")[0]
        .is_verified,
    ).toBe(1);

    // Seed used scan quota for fx_user_001 and reset it
    dbs.main.seed(
      "INSERT INTO subscriptions (id, user_id, plan, status, scan_count_current_month, max_scans_per_month) VALUES ('sub_q_1', 'fx_user_001', 'free', 'active', 4, 5) ON CONFLICT(user_id) DO UPDATE SET scan_count_current_month = 4",
    );
    const resetRes = await call('/api/v1/admin/users/fx_user_001/quota/reset', {
      env,
      method: 'POST',
      session: sup,
      body: { reason: 'Hoàn lượt quét do ảnh lỗi' },
    });
    expect(resetRes.status).toBe(200);
    expect(resetRes.json.data).toMatchObject({ userId: 'fx_user_001', usedThisMonth: 0 });
    expect(
      dbs.main.query<{ scan_count_current_month: number }>(
        "SELECT scan_count_current_month FROM subscriptions WHERE user_id = 'fx_user_001'",
      )[0].scan_count_current_month,
    ).toBe(0);

    // Revoke sessions
    const revokeRes = await call('/api/v1/admin/users/fx_user_003/sessions/revoke', {
      env,
      method: 'POST',
      session: sup,
      body: { reason: 'Đăng xuất mọi thiết bị theo yêu cầu bảo mật' },
    });
    expect(revokeRes.status).toBe(200);
    expect(revokeRes.json.data.revokedSessions).toBeGreaterThanOrEqual(1);
    expect(
      count(dbs.main, "SELECT COUNT(*) AS n FROM sessions_v2 WHERE user_id = 'fx_user_003' AND revoked_at IS NULL"),
    ).toBe(0);

    // Direct notify
    const notifyRes = await call('/api/v1/admin/users/fx_user_003/notify', {
      env,
      method: 'POST',
      session: sup,
      body: {
        title: 'Thông báo bảo mật',
        message: 'Phiên đăng nhập của bạn đã được làm mới.',
        type: 'system',
        reason: 'Thông báo sau khi thu hồi phiên',
      },
    });
    expect(notifyRes.status).toBe(200);
    expect(notifyRes.json.data).toMatchObject({ userId: 'fx_user_003', type: 'system' });
    expect(
      count(
        dbs.main,
        "SELECT COUNT(*) AS n FROM notifications WHERE user_id = 'fx_user_003' AND title = 'Thông báo bảo mật'",
      ),
    ).toBe(1);
  });
});

describe('Household inspection, editing, and guest household purge', () => {
  it('inspects household detail, renames, transfers ownership, removes member, and purges old guest households', async () => {
    const sup = await login(env, fx('super'));

    // Add fx_user_002 as a member of hh_fx_user_001
    dbs.main.seed(
      "INSERT INTO household_members (id, household_id, user_id, role, created_at) VALUES ('hm_extra_002', 'hh_fx_user_001', 'fx_user_002', 'member', '2026-10-01T00:00:00.000Z')",
    );

    const detail = await call('/api/v1/admin/households/hh_fx_user_001', { env, session: sup });
    expect(detail.status).toBe(200);
    expect(detail.json.data).toMatchObject({
      id: 'hh_fx_user_001',
      ownerUserId: 'fx_user_001',
      itemCount: 2,
    });
    expect(detail.json.data.members).toHaveLength(2);

    // Rename household & transfer owner to fx_user_002
    const transferred = await call('/api/v1/admin/households/hh_fx_user_001', {
      env,
      method: 'PATCH',
      session: sup,
      body: {
        name: 'Bếp Gia Đình Việt',
        newOwnerUserId: 'fx_user_002',
        reason: 'Chuyển quyền chủ hộ theo yêu cầu gia đình',
      },
    });
    expect(transferred.status).toBe(200);
    expect(transferred.json.data).toMatchObject({
      id: 'hh_fx_user_001',
      name: 'Bếp Gia Đình Việt',
      ownerUserId: 'fx_user_002',
      memberCount: 2,
    });

    // Remove former owner fx_user_001 from hh_fx_user_001
    const removed = await call('/api/v1/admin/households/hh_fx_user_001', {
      env,
      method: 'PATCH',
      session: sup,
      body: {
        removeUserId: 'fx_user_001',
        reason: 'Gỡ thành viên cũ khỏi hộ gia đình',
      },
    });
    expect(removed.status).toBe(200);
    expect(removed.json.data).toMatchObject({
      id: 'hh_fx_user_001',
      ownerUserId: 'fx_user_002',
      removedUserId: 'fx_user_001',
      memberCount: 1,
    });

    // Purge guest households older than 1 day
    const guestsBefore = count(dbs.main, 'SELECT COUNT(*) AS n FROM users WHERE is_guest = 1');
    expect(guestsBefore).toBeGreaterThanOrEqual(6);
    const purged = await call('/api/v1/admin/households/purge-guests', {
      env,
      method: 'POST',
      session: sup,
      body: { olderThanDays: 1, reason: 'Dọn dẹp định kỳ tài khoản khách không hoạt động' },
    });
    expect(purged.status).toBe(200);
    expect(purged.json.data.deletedGuestUsers).toBeGreaterThanOrEqual(6);
    expect(purged.json.data.deletedHouseholds).toBeGreaterThanOrEqual(6);
  });
});

describe('Billing operations: mark-paid, refund, and resolve', () => {
  it('marks pending transaction paid (grants Pro & clears reconciliation), refunds with subscription revocation, and resolves stuck pending intent', async () => {
    const sup = await login(env, fx('super'));

    // fx_pay_4 has a payment_reconciliation_records row (status='failed'), fx_pay_3 is 'pending' with checkout_admissions
    const pay4Before = dbs.main.query<{ user_id: string; status: string }>(
      "SELECT user_id, status FROM payment_intents WHERE id = 'fx_pay_4'",
    )[0];
    expect(pay4Before.status).toBe('failed');
    expect(
      count(dbs.main, "SELECT COUNT(*) AS n FROM payment_reconciliation_records WHERE intent_id = 'fx_pay_4'"),
    ).toBe(1);

    const markedPaid = await call('/api/v1/admin/billing/transactions/fx_pay_4/mark-paid', {
      env,
      method: 'POST',
      session: sup,
      body: { grantDays: 31, reason: 'Đã xác nhận tiền về tài khoản ngân hàng' },
    });
    expect(markedPaid.status).toBe(200);
    expect(markedPaid.json.data).toMatchObject({
      intentId: 'fx_pay_4',
      userId: pay4Before.user_id,
      status: 'paid',
      reconciliationCleared: true,
    });
    expect(
      count(dbs.main, "SELECT COUNT(*) AS n FROM payment_reconciliation_records WHERE intent_id = 'fx_pay_4'"),
    ).toBe(0);
    expect(
      dbs.main.query<{ plan: string; status: string }>(
        'SELECT plan, status FROM subscriptions WHERE user_id = ?',
        pay4Before.user_id,
      )[0],
    ).toEqual({ plan: 'plus', status: 'active' });

    // Refund fx_pay_4 and revoke subscription
    const refunded = await call('/api/v1/admin/billing/transactions/fx_pay_4/refund', {
      env,
      method: 'POST',
      session: sup,
      body: { revokeSubscription: true, reason: 'Hoàn tiền theo yêu cầu khách hàng' },
    });
    expect(refunded.status).toBe(200);
    expect(refunded.json.data).toMatchObject({
      intentId: 'fx_pay_4',
      userId: pay4Before.user_id,
      status: 'refunded',
      subscriptionRevoked: true,
    });
    expect(
      dbs.main.query<{ plan: string; status: string }>(
        'SELECT plan, status FROM subscriptions WHERE user_id = ?',
        pay4Before.user_id,
      )[0],
    ).toEqual({ plan: 'free', status: 'cancelled' });

    // Resolve fx_pay_3 (pending with checkout_admissions, plus a seeded reconciliation record) as 'expired'
    dbs.main.seed(
      "INSERT OR IGNORE INTO payment_reconciliation_records (intent_id, reason, first_observed_at, last_observed_at) VALUES ('fx_pay_3', 'provider_outcome_unknown', '2026-10-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z')",
    );
    expect(count(dbs.main, "SELECT COUNT(*) AS n FROM checkout_admissions WHERE intent_id = 'fx_pay_3'")).toBe(1);
    const resolved = await call('/api/v1/admin/billing/transactions/fx_pay_3/resolve', {
      env,
      method: 'POST',
      session: sup,
      body: { outcome: 'expired', reason: 'Đóng giao dịch treo quá hạn thanh toán' },
    });
    expect(resolved.status).toBe(200);
    expect(resolved.json.data).toMatchObject({
      intentId: 'fx_pay_3',
      status: 'expired',
      reconciliationCleared: true,
    });
    expect(
      count(dbs.main, "SELECT COUNT(*) AS n FROM payment_reconciliation_records WHERE intent_id = 'fx_pay_3'"),
    ).toBe(0);
    expect(count(dbs.main, "SELECT COUNT(*) AS n FROM checkout_admissions WHERE intent_id = 'fx_pay_3'")).toBe(0);
  });
});

describe('Recipes & media canonical mutations vs editorial review ledger', () => {
  it('enforces optimistic version lock on verification, updates metadata safely when recipe_nutrition exists, rejects media, and keeps editorial reviews non-mutating', async () => {
    const editor = await login(env, fx('content'));
    const recipe = dbs.main.query<{ id: string; title: string; version: number; verification_state: string }>(
      'SELECT id, title, version, verification_state FROM recipes ORDER BY id LIMIT 1',
    )[0];

    // 1. Stale version on POST /recipes/:id/verification returns 409 ADMIN_CONFLICT
    const staleVerify = await call(`/api/v1/admin/recipes/${recipe.id}/verification`, {
      env,
      method: 'POST',
      session: editor,
      body: {
        verificationState: 'reviewed',
        recipeVersion: Number(recipe.version) + 99,
        reason: 'Thử duyệt với phiên bản cũ',
      },
    });
    expect(staleVerify.status).toBe(409);
    expect(staleVerify.json.code).toBe('ADMIN_CONFLICT');

    // Matching version succeeds (200) and updates verification_state
    const okVerify = await call(`/api/v1/admin/recipes/${recipe.id}/verification`, {
      env,
      method: 'POST',
      session: editor,
      body: {
        verificationState: 'reviewed',
        recipeVersion: Number(recipe.version),
        reason: 'Đã kiểm định nguyên liệu và định lượng chuẩn',
      },
    });
    expect(okVerify.status).toBe(200);
    expect(okVerify.json.data).toMatchObject({
      id: recipe.id,
      verificationState: 'reviewed',
    });

    // 2. Ensure a recipe_nutrition row exists for this recipe, then PATCH /recipes/:id metadata
    dbs.main.seed(
      `INSERT OR IGNORE INTO nutrition_profiles (id, basis_quantity, basis_unit, source_type, source_reference, energy_kcal, protein_g, carbohydrate_g, fat_g) VALUES ('np_test_01', 1, 'serving', 'calculated', 'fixture-calc', 320, 18, 25, 12);
       INSERT OR IGNORE INTO recipe_nutrition (recipe_id, recipe_version, nutrition_profile_id) VALUES ('${recipe.id}', ${Number(recipe.version)}, 'np_test_01');`,
    );
    const updatedMeta = await call(`/api/v1/admin/recipes/${recipe.id}`, {
      env,
      method: 'PATCH',
      session: editor,
      body: {
        title: 'Canh Chua Cá Lóc Miền Tây',
        cookTimeMinutes: 35,
        prepTimeMinutes: 15,
        servings: 4,
        difficulty: 'medium',
        tags: ['canh-chua', 'mien-tay', 'com-nha'],
        reason: 'Cập nhật thông tin khẩu phần và thẻ phân loại',
      },
    });
    expect(updatedMeta.status).toBe(200);
    expect(updatedMeta.json.data).toMatchObject({
      id: recipe.id,
      title: 'Canh Chua Cá Lóc Miền Tây',
    });

    // 3. Seed or use a recipe_media row and reject it via POST /recipes/:id/media/reject
    dbs.main.seed(
      `INSERT OR REPLACE INTO recipe_media (id, recipe_id, role, version, storage_key, mime_type, width, height, content_length, content_hash, status, source_type) VALUES ('rm_test_hero', '${recipe.id}', 'hero', 1, 'recipes/${recipe.id}/hero/v1.webp', 'image/webp', 1200, 800, 40960, '${'a'.repeat(64)}', 'ready', 'uploaded')`,
    );
    const rejectedMedia = await call(`/api/v1/admin/recipes/${recipe.id}/media/reject`, {
      env,
      method: 'POST',
      session: editor,
      body: {
        role: 'hero',
        version: 1,
        reason: 'Ảnh bìa chưa đúng góc chụp tiêu chuẩn',
      },
    });
    expect(rejectedMedia.status).toBe(200);
    expect(rejectedMedia.json.data).toMatchObject({
      recipeId: recipe.id,
      role: 'hero',
      version: 1,
      status: 'rejected',
    });
    expect(
      dbs.main.query<{ status: string }>(
        "SELECT status FROM recipe_media WHERE recipe_id = ? AND role = 'hero' AND version = 1",
        recipe.id,
      )[0].status,
    ).toBe('rejected');

    // 4. Verify POST /recipes/:id/reviews ONLY writes admin_recipe_editorial_reviews and does NOT mutate recipes table
    const snapshotBeforeReview = dbs.main.query('SELECT * FROM recipes WHERE id = ?', recipe.id)[0];
    const currentVersion = Number((snapshotBeforeReview as { version: number }).version);
    const reviewRes = await call(`/api/v1/admin/recipes/${recipe.id}/reviews`, {
      env,
      method: 'POST',
      session: editor,
      body: {
        state: 'approved',
        note: 'Ghi chú biên tập nội bộ sau khi cập nhật.',
        recipeVersion: currentVersion,
      },
    });
    expect(reviewRes.status).toBe(201);
    const snapshotAfterReview = dbs.main.query('SELECT * FROM recipes WHERE id = ?', recipe.id)[0];
    expect(snapshotAfterReview).toEqual(snapshotBeforeReview);
  });
});

describe('AI & OCR queue operations and System hygiene/broadcast', () => {
  it('lists OCR scan jobs, retries a failed job to pending, and cancels a processing job while refunding 1 scan quota', async () => {
    const ops = await login(env, fx('ops'));

    const listFailed = await call('/api/v1/admin/ai/scan-jobs?status=failed', { env, session: ops });
    expect(listFailed.status).toBe(200);
    expect(listFailed.json.data.items.length).toBeGreaterThan(0);
    const failedJobId = listFailed.json.data.items[0].id as string;

    // Retry failed job -> resets status to 'pending' and attempts to 0
    const retried = await call(`/api/v1/admin/ai/scan-jobs/${failedJobId}/retry`, {
      env,
      method: 'POST',
      session: ops,
      body: { reason: 'Nhà cung cấp OCR đã phục hồi, đẩy lại hàng đợi' },
    });
    expect(retried.status).toBe(200);
    expect(retried.json.data).toMatchObject({
      id: failedJobId,
      status: 'pending',
      attempts: 0,
    });
    expect(
      dbs.main.query<{ status: string; attempts: number }>(
        'SELECT status, attempts FROM scan_queue_jobs WHERE id = ?',
        failedJobId,
      )[0],
    ).toEqual({ status: 'pending', attempts: 0 });

    // Cancel a processing job -> marks failed with ADMIN_CANCELLED and refunds 1 scan quota
    const listProcessing = await call('/api/v1/admin/ai/scan-jobs?status=processing', { env, session: ops });
    expect(listProcessing.status).toBe(200);
    const procJob = listProcessing.json.data.items[0] as { id: string; userId: string };
    expect(procJob).toBeTruthy();

    dbs.main.seed(
      `INSERT INTO subscriptions (id, user_id, plan, status, scan_count_current_month, max_scans_per_month) VALUES ('sub_cancel_test', '${procJob.userId}', 'free', 'active', 3, 5) ON CONFLICT(user_id) DO UPDATE SET scan_count_current_month = 3`,
    );

    const cancelled = await call(`/api/v1/admin/ai/scan-jobs/${procJob.id}/cancel`, {
      env,
      method: 'POST',
      session: ops,
      body: { reason: 'Tác vụ treo quá lâu, hủy và hoàn lượt cho người dùng' },
    });
    expect(cancelled.status).toBe(200);
    expect(cancelled.json.data).toMatchObject({
      id: procJob.id,
      status: 'failed',
    });
    expect(
      dbs.main.query<{ status: string; error_code: string }>(
        'SELECT status, error_code FROM scan_queue_jobs WHERE id = ?',
        procJob.id,
      )[0],
    ).toEqual({ status: 'failed', error_code: 'ADMIN_CANCELLED' });
    expect(
      dbs.main.query<{ scan_count_current_month: number }>(
        'SELECT scan_count_current_month FROM subscriptions WHERE user_id = ?',
        procJob.userId,
      )[0].scan_count_current_month,
    ).toBe(2);
  });

  it('runs system hygiene (deletes expired sessions/OTPs and closes expired approvals) and sends system broadcasts', async () => {
    const sup = await login(env, fx('super'));

    // Seed expired session, used OTP, and expired pending approval
    dbs.main.seed(
      `INSERT INTO sessions_v2 (id, user_id, household_id, token_hash, expires_at, revoked_at) VALUES ('sess_dead_1', 'fx_user_001', 'hh_fx_user_001', 'deadbeef01', '2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z');
       INSERT INTO auth_otps (id, email, code_digest, purpose, expires_at, used) VALUES ('otp_dead_1', 'customer001@fixture.takosan.test', 'digest01', 'login', '2020-01-01T00:00:00.000Z', 1);`,
    );
    dbs.admin.seed(
      `INSERT INTO admin_action_approvals (id, action, target_user_id, requested_by, requested_at, expires_at, status) VALUES ('appr_expired_1', 'role.grant.super_admin', 'fx_admin_ops', 'fx_admin_super', '2020-01-01T00:00:00.000Z', '2020-01-02T00:00:00.000Z', 'pending');`,
    );

    const hygieneRes = await call('/api/v1/admin/system/hygiene', {
      env,
      method: 'POST',
      session: sup,
      body: { reason: 'Dọn dẹp phiên và OTP hết hạn' },
    });
    expect(hygieneRes.status).toBe(200);
    expect(hygieneRes.json.data.revokedSessionsDeleted).toBeGreaterThanOrEqual(1);
    expect(hygieneRes.json.data.expiredOtpsDeleted).toBeGreaterThanOrEqual(1);
    expect(hygieneRes.json.data.expiredApprovalsClosed).toBe(1);
    expect(
      dbs.admin.query<{ status: string }>("SELECT status FROM admin_action_approvals WHERE id = 'appr_expired_1'")[0]
        .status,
    ).toBe('expired');

    // Broadcast to pro_only
    const proBroadcast = await call('/api/v1/admin/system/broadcast', {
      env,
      method: 'POST',
      session: sup,
      body: {
        target: 'pro_only',
        title: 'Ưu đãi thành viên Takolio Pro',
        message: 'Cảm ơn bạn đã đồng hành cùng Takolio Pro!',
        reason: 'Tri ân khách hàng Pro tháng 11',
      },
    });
    expect(proBroadcast.status).toBe(200);
    expect(proBroadcast.json.data.target).toBe('pro_only');
    expect(proBroadcast.json.data.recipientCount).toBeGreaterThan(0);
    expect(
      count(
        dbs.main,
        "SELECT COUNT(*) AS n FROM notifications WHERE title = 'Ưu đãi thành viên Takolio Pro' AND type = 'announcement'",
      ),
    ).toBe(proBroadcast.json.data.recipientCount);
  });
});
