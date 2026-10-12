import type { Env } from '../../types';
import { ADMIN_RBAC_MATRIX_VERSION, type AdminHealthCheck, type AdminSystemStatus } from '../../../shared/admin';
import { validateEnvironment } from '../../config/validation';

// Non-secret configuration only. Secrets are never echoed, not even as booleans.
const FLAG_KEYS = [
  'AI_ENABLED', 'AI_MOCK_MODE', 'AI_QWEN_ONLY', 'SCAN_QUEUE_MODE', 'WEEK_SCHEMA_MODE', 'RECIPE_CATALOG_MODE', 'MEAL_PLANNER_ENABLED',
  'MEAL_PLANNER_AI_ENABLED', 'MEAL_COMPOSITION_V2_ENABLED', 'CHECKOUT_ADMISSION_ENABLED', 'ADMIN_AUTH_MODE', 'ADMIN_CONSOLE_ENABLED',
] as const;

const SCHEMA_OBJECTS = ['admin_role_assignments', 'admin_sessions', 'admin_audit_events', 'admin_action_approvals', 'admin_recipe_editorial_reviews',
  'admin_user_preferences', 'admin_config_metadata', 'sessions_v2', 'payment_intents', 'ai_requests', 'scan_queue_jobs', 'recipes'];

export async function systemChecks(env: Env): Promise<AdminHealthCheck[]> {
  let database: AdminHealthCheck['status'] = 'ok';
  try {
    await env.DB.prepare('SELECT 1 AS ok').first();
  } catch {
    database = 'error';
  }
  const binding = (key: string, label: string, present: boolean): AdminHealthCheck => ({
    key, label, observedBy: 'local', status: present ? 'ok' : 'degraded', detail: present ? 'Binding có mặt trong Worker.' : 'Binding không được gắn trong môi trường này.',
  });
  return [
    { key: 'database', label: 'Cơ sở dữ liệu D1', status: database, observedBy: 'local', detail: database === 'ok' ? 'Truy vấn SELECT 1 thành công.' : 'Truy vấn thất bại.' },
    binding('kv_cache', 'KV (giới hạn tần suất)', Boolean(env.CACHE)),
    binding('r2_images', 'R2 hình ảnh', Boolean(env.IMAGES)),
    binding('scan_queue', 'Hàng đợi quét', Boolean(env.SCAN_QUEUE)),
    binding('workers_ai', 'Workers AI', Boolean(env.AI)),
    binding('static_assets', 'Tài nguyên tĩnh', Boolean(env.ASSETS)),
    { key: 'edge_health', label: 'Sức khoẻ edge Cloudflare', status: 'unavailable', observedBy: 'remote', detail: 'Cần adapter Cloudflare Analytics.' },
    { key: 'queue_backlog', label: 'Backlog Cloudflare Queue', status: 'unavailable', observedBy: 'remote', detail: 'Cần adapter Queues API.' },
  ];
}

export async function systemStatus(env: Env): Promise<AdminSystemStatus> {
  const checks = await systemChecks(env);
  const reachable = checks[0].status === 'ok';
  let present = new Set<string>();
  let fixture: string | null = null;
  if (reachable) {
    const rows = await env.DB.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${SCHEMA_OBJECTS.map(() => '?').join(',')})`)
      .bind(...SCHEMA_OBJECTS).all<{ name: string }>();
    present = new Set(rows.results.map((row) => row.name));
    fixture = (await env.DB.prepare("SELECT value FROM admin_config_metadata WHERE key = 'fixture_dataset'").first<{ value: string }>().catch(() => null))?.value ?? null;
  }
  const environment = env.ENVIRONMENT || 'development';
  const report = validateEnvironment(env);
  const warnings = [...report.fatal, ...report.warnings].map((issue) => ({ code: issue.code, message: issue.severity === 'fatal' ? 'Lỗi cấu hình nghiêm trọng.' : 'Cảnh báo cấu hình.' }));
  if (fixture && environment === 'production') warnings.unshift({ code: 'FIXTURE_DATA_IN_PRODUCTION', message: 'Cơ sở dữ liệu sản xuất có dấu dữ liệu tổng hợp.' });
  if (fixture && environment !== 'production') warnings.push({ code: 'SYNTHETIC_FIXTURE_ACTIVE', message: `Đang dùng dữ liệu tổng hợp (${fixture}).` });
  return {
    checks,
    release: { gitCommit: env.GIT_COMMIT ?? null, environment, rbacMatrixVersion: ADMIN_RBAC_MATRIX_VERSION },
    database: { reachable, schemaChecks: SCHEMA_OBJECTS.map((object) => ({ object, present: present.has(object) })) },
    featureFlags: FLAG_KEYS.map((key) => ({ key, value: (env as unknown as Record<string, string | undefined>)[key] ?? null })),
    warnings,
    remoteAdapters: [
      { key: 'cloudflare_analytics', label: 'Cloudflare Analytics / Logs', status: 'unavailable', note: 'Adapter tương lai; V1 không gọi Cloudflare API.' },
      { key: 'cloudflare_queues', label: 'Cloudflare Queues', status: 'unavailable', note: 'Adapter tương lai.' },
      { key: 'd1_remote_metrics', label: 'D1 metrics từ xa', status: 'unavailable', note: 'Adapter tương lai.' },
      { key: 'github_releases', label: 'GitHub release / deployments', status: 'unavailable', note: 'Adapter tương lai; triển khai vẫn qua quy trình phê duyệt GitHub Environment.' },
    ],
  };
}
