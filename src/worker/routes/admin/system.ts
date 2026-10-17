import type { CustomerReadClient } from './customer-facade-client';
import type { D1DatabaseBinding } from '@frigo/db';
import { ADMIN_RBAC_MATRIX_VERSION, type AdminHealthCheck, type AdminSystemStatus } from '../../../shared/admin';
import type { AdminEnv } from './env';
import type { AdminPolicy } from './policy';

const CUSTOMER_TABLES = ['users', 'auth_accounts', 'sessions_v2', 'payment_intents', 'subscriptions', 'ai_requests', 'scan_queue_jobs', 'recipes'];
const ADMIN_TABLES = ['admin_config_metadata', 'admin_role_assignments', 'admin_sessions', 'admin_audit_events', 'admin_action_approvals',
  'admin_recipe_editorial_reviews', 'admin_user_preferences'];

async function reachable(db: D1DatabaseBinding): Promise<boolean> {
  try {
    await db.prepare('SELECT 1 AS ok').first();
    return true;
  } catch {
    return false;
  }
}

/** Checks observed by this admin Worker; customer-Worker internals require a remote adapter. */
export async function systemChecks(env: AdminEnv, main: CustomerReadClient, adminDb: D1DatabaseBinding, policy: AdminPolicy): Promise<AdminHealthCheck[]> {
  const [mainOk, adminOk] = await Promise.all([main.read<{reachable:boolean}>('system',{}).then(r=>r.reachable).catch(()=>false), reachable(adminDb)]);
  const local = (key: string, label: string, status: AdminHealthCheck['status'], detail: string): AdminHealthCheck => ({ key, label, status, observedBy: 'local', detail });
  const remote = (key: string, label: string, detail: string): AdminHealthCheck => ({ key, label, status: 'unavailable', observedBy: 'remote', detail });
  return [
    local('customer_db', 'D1 khách hàng (chỉ đọc)', mainOk ? 'ok' : 'error', mainOk ? 'Truy vấn SELECT 1 thành công.' : 'Truy vấn thất bại.'),
    local('admin_db', 'D1 quản trị', adminOk ? 'ok' : 'error', adminOk ? 'Truy vấn SELECT 1 thành công; phiên bản schema hợp lệ.' : 'Truy vấn thất bại.'),
    local('rate_limit_kv', 'KV giới hạn tần suất', env.CACHE ? 'ok' : policy.local ? 'degraded' : 'error',
      env.CACHE ? 'Binding có mặt.' : policy.local ? 'Không có KV; dùng bộ đếm cục bộ (chỉ môi trường local).' : 'Thiếu KV; đăng nhập và thao tác ghi bị chặn.'),
    local('admin_assets', 'Tài nguyên giao diện quản trị', env.ASSETS ? 'ok' : 'degraded', env.ASSETS ? 'Binding có mặt.' : 'Không gắn tài nguyên tĩnh.'),
    local('admin_auth', 'Xác thực quản trị', policy.authMode === 'unavailable' ? 'error' : 'ok', `Chế độ: ${policy.authMode}.`),
    remote('customer_worker_bindings', 'Binding của worker khách hàng (R2, Queue, AI)', 'Không quan sát được từ worker quản trị; cần adapter từ xa.'),
    remote('edge_health', 'Sức khoẻ edge Cloudflare', 'Cần adapter Cloudflare Analytics.'),
    remote('queue_backlog', 'Backlog Cloudflare Queue', 'Cần adapter Queues API.'),
  ];
}

async function presentTables(db: D1DatabaseBinding, names: string[]): Promise<Set<string>> {
  const rows = await db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (SELECT value FROM json_each(?))`)
    .bind(JSON.stringify(names)).all<{ name: string }>();
  return new Set(rows.results.map((row) => row.name));
}

export async function systemStatus(env: AdminEnv, main: CustomerReadClient, adminDb: D1DatabaseBinding, policy: AdminPolicy, fixture: string | null): Promise<AdminSystemStatus> {
  const checks = await systemChecks(env, main, adminDb, policy);
  const reachableDbs = checks[0].status === 'ok' && checks[1].status === 'ok';
  const [customer, admin] = reachableDbs ? await Promise.all([main.read<{tables:string[]}>('system',{}).then(r=>new Set(r.tables)), presentTables(adminDb, ADMIN_TABLES)]) : [new Set<string>(), new Set<string>()];
  const warnings: AdminSystemStatus['warnings'] = [];
  if (fixture) warnings.push({ code: 'SYNTHETIC_FIXTURE_ACTIVE', message: `Đang dùng dữ liệu tổng hợp (${fixture}); chỉ được phép ở môi trường local.` });
  if (policy.authMode === 'password') warnings.push({ code: 'LOCAL_PASSWORD_AUTH', message: 'Đăng nhập bằng mật khẩu chỉ dành cho bản build local.' });
  if (!env.ADMIN_AUDIT_HMAC_SECRET) warnings.push({ code: 'AUDIT_IP_HASH_DISABLED', message: 'Chưa cấu hình ADMIN_AUDIT_HMAC_SECRET; nhật ký không lưu băm IP.' });
  return {
    checks,
    release: { gitCommit: env.GIT_COMMIT ?? null, environment: policy.environment ?? 'unknown', rbacMatrixVersion: ADMIN_RBAC_MATRIX_VERSION },
    database: {
      reachable: reachableDbs,
      schemaChecks: [
        ...CUSTOMER_TABLES.map((name) => ({ object: `DB.${name}`, present: customer.has(name) })),
        ...ADMIN_TABLES.map((name) => ({ object: `ADMIN_DB.${name}`, present: admin.has(name) })),
      ],
    },
    // Non-secret admin Worker configuration only.
    featureFlags: [
      { key: 'ENVIRONMENT', value: policy.environment },
      { key: 'ADMIN_CONSOLE_ENABLED', value: env.ADMIN_CONSOLE_ENABLED ?? null },
      { key: 'ADMIN_AUTH_MODE', value: env.ADMIN_AUTH_MODE ?? null },
      { key: 'ADMIN_ORIGIN', value: policy.origin },
      { key: 'ADMIN_ACCESS_TEAM_DOMAIN', value: env.ADMIN_ACCESS_TEAM_DOMAIN ?? null },
      { key: 'RECIPE_CATALOG_MODE (mirror)', value: env.RECIPE_CATALOG_MODE ?? null },
    ],
    warnings,
    remoteAdapters: [
      { key: 'customer_worker_config', label: 'Cấu hình worker khách hàng (feature flags)', status: 'unavailable', note: 'Adapter tương lai; V1 không gọi Cloudflare API.' },
      { key: 'cloudflare_analytics', label: 'Cloudflare Analytics / Logs', status: 'unavailable', note: 'Adapter tương lai.' },
      { key: 'cloudflare_queues', label: 'Cloudflare Queues', status: 'unavailable', note: 'Adapter tương lai.' },
      { key: 'github_releases', label: 'GitHub release / deployments', status: 'unavailable', note: 'Adapter tương lai; triển khai vẫn qua phê duyệt GitHub Environment.' },
    ],
  };
}
