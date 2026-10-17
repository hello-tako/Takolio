import type { D1DatabaseBinding } from '@frigo/db';
import type { AdminHealthCheck, AdminIncident, AdminMetric, AdminOverview, AdminRange, AdminSeries } from '../../shared/admin';
import { fillDays, rangeStartDay } from '../routes/admin/http';

export const AI_NOT_WIRED_NOTE = 'Runtime hiện chưa ghi bảng ai_requests (LOG_AI_REQUEST chưa được gọi); số liệu chỉ phản ánh dữ liệu đã có trong bảng.';

async function scalar(db: D1DatabaseBinding, sql: string, ...binds: unknown[]): Promise<number> {
  const row = await db.prepare(sql).bind(...binds).first<{ value: number | null }>();
  return Number(row?.value ?? 0);
}

export async function daily(db: D1DatabaseBinding, sql: string, start: string, range: AdminRange) {
  const rows = await db.prepare(sql).bind(start).all<{ day: string; value: number | null }>();
  return fillDays(range, rows.results);
}

export const PLUS_ACTIVE_SQL = `plan = 'plus' AND status = 'active' AND (expires_at IS NULL OR datetime(expires_at) > datetime('now'))`;

export async function buildOverview(main: D1DatabaseBinding, range: AdminRange, checks: AdminHealthCheck[]): Promise<AdminOverview> {
  const start = rangeStartDay(range);
  const [registered, active, newUsers, plus, revenue, aiRequests, scans] = await Promise.all([
    scalar(main, 'SELECT COUNT(*) AS value FROM users WHERE is_guest = 0'),
    scalar(main, `SELECT COUNT(DISTINCT s.user_id) AS value FROM sessions_v2 s JOIN users u ON u.id = s.user_id
      WHERE u.is_guest = 0 AND date(COALESCE(s.last_seen_at, s.created_at)) >= ?`, start),
    scalar(main, 'SELECT COUNT(*) AS value FROM users WHERE is_guest = 0 AND date(created_at) >= ?', start),
    scalar(main, `SELECT COUNT(*) AS value FROM subscriptions WHERE ${PLUS_ACTIVE_SQL}`),
    scalar(main, "SELECT COALESCE(SUM(amount_vnd), 0) AS value FROM payment_intents WHERE status = 'paid' AND date(updated_at) >= ?", start),
    scalar(main, 'SELECT COUNT(*) AS value FROM ai_requests WHERE date(created_at) >= ?', start),
    scalar(main, 'SELECT COUNT(*) AS value FROM scans WHERE date(created_at) >= ?', start),
  ]);
  const metrics: AdminMetric[] = [
    { key: 'registered_users', label: 'Người dùng đã đăng ký', value: registered, unit: 'count', status: 'ok', source: 'D1:users',
      definition: 'Tổng số tài khoản không phải khách (is_guest = 0).' },
    { key: 'active_users', label: 'Người dùng hoạt động', value: active, unit: 'count', status: 'partial', source: 'D1:sessions_v2',
      definition: 'Số người dùng không phải khách có phiên được thấy trong khoảng thời gian.',
      note: 'last_seen_at chỉ cập nhật tối đa 15 phút/lần; phiên đã xoá không được tính.' },
    { key: 'new_registrations', label: 'Đăng ký mới', value: newUsers, unit: 'count', status: 'ok', source: 'D1:users',
      definition: 'Tài khoản không phải khách được tạo trong khoảng thời gian (theo ngày UTC).' },
    { key: 'active_plus', label: 'Gói Plus đang hoạt động', value: plus, unit: 'count', status: 'ok', source: 'D1:subscriptions',
      definition: "plan = 'plus', status = 'active' và chưa hết hạn tại thời điểm truy vấn." },
    { key: 'confirmed_revenue_vnd', label: 'Doanh thu đã xác nhận', value: revenue, unit: 'vnd', status: 'partial', source: 'D1:payment_intents',
      definition: "Tổng amount_vnd của payment_intents có status = 'paid', cập nhật trong khoảng thời gian.",
      note: 'Xác nhận nội bộ; chưa đối soát với sao kê nhà cung cấp.' },
    { key: 'ai_requests', label: 'Yêu cầu AI', value: aiRequests, unit: 'count', status: 'partial', source: 'D1:ai_requests',
      definition: 'Số dòng ai_requests trong khoảng thời gian.', note: AI_NOT_WIRED_NOTE },
    { key: 'scan_jobs', label: 'Lượt quét', value: scans, unit: 'count', status: 'ok', source: 'D1:scans',
      definition: 'Số bản ghi scans được tạo trong khoảng thời gian.' },
  ];
  const series: AdminSeries[] = [
    { key: 'registrations', label: 'Đăng ký mới theo ngày', unit: 'count', source: 'D1:users',
      points: await daily(main, `SELECT date(created_at) AS day, COUNT(*) AS value FROM users WHERE is_guest = 0 AND date(created_at) >= ? GROUP BY 1`, start, range) },
    { key: 'scans', label: 'Lượt quét theo ngày', unit: 'count', source: 'D1:scans',
      points: await daily(main, `SELECT date(created_at) AS day, COUNT(*) AS value FROM scans WHERE date(created_at) >= ? GROUP BY 1`, start, range) },
    { key: 'revenue', label: 'Doanh thu đã xác nhận theo ngày', unit: 'vnd', source: 'D1:payment_intents',
      points: await daily(main, `SELECT date(updated_at) AS day, SUM(amount_vnd) AS value FROM payment_intents WHERE status = 'paid' AND date(updated_at) >= ? GROUP BY 1`, start, range) },
  ];
  return { range, metrics, series, health: { status: healthStatus(checks), checks }, incidents: await incidents(main) };
}

export function healthStatus(checks: AdminHealthCheck[]): 'ok' | 'degraded' | 'unhealthy' {
  const local = checks.filter((check) => check.observedBy === 'local');
  if (local.some((check) => check.status === 'error')) return 'unhealthy';
  if (local.some((check) => check.status === 'degraded')) return 'degraded';
  return 'ok';
}

async function incidents(main: D1DatabaseBinding): Promise<AdminIncident[]> {
  const [jobs, reconciliation] = await Promise.all([
    main.prepare(`SELECT id, updated_at, error_code FROM scan_queue_jobs WHERE status = 'failed' ORDER BY updated_at DESC, id DESC LIMIT 5`)
      .all<{ id: string; updated_at: string; error_code: string | null }>(),
    main.prepare(`SELECT intent_id, reason, last_observed_at FROM payment_reconciliation_records ORDER BY last_observed_at DESC, intent_id DESC LIMIT 5`)
      .all<{ intent_id: string; reason: string; last_observed_at: string }>(),
  ]);
  const items: AdminIncident[] = [
    ...jobs.results.map((row) => ({ id: row.id, occurredAt: row.updated_at, severity: 'warning' as const,
      title: `Tác vụ quét thất bại${row.error_code ? ` (${row.error_code})` : ''}`, source: 'D1:scan_queue_jobs' })),
    ...reconciliation.results.map((row) => ({ id: row.intent_id, occurredAt: row.last_observed_at, severity: 'critical' as const,
      title: `Thanh toán cần đối soát (${row.reason})`, source: 'D1:payment_reconciliation_records' })),
  ];
  return items.sort((a, b) => Date.parse(b.occurredAt.replace(' ', 'T')) - Date.parse(a.occurredAt.replace(' ', 'T')) || b.id.localeCompare(a.id)).slice(0, 10);
}
