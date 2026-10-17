import type { D1DatabaseBinding } from '@frigo/db';
import type { AdminAiSummary, AdminAiUsageRow, AdminBillingSummary, AdminPage, AdminRange, AdminTransaction } from '../../shared/admin';
import { rangeStartDay } from '../routes/admin/http';
import { maskOrderCode } from '../routes/admin/mask';
import { AI_NOT_WIRED_NOTE, daily, PLUS_ACTIVE_SQL } from './overview';

type PaymentStatus = AdminTransaction['status'];
const EFFECTIVE_STATUS_SQL = `CASE WHEN status = 'pending' AND datetime(expires_at) <= datetime('now') THEN 'expired' ELSE status END`;

// Read-only view over payment authority tables; nothing here mutates payments or entitlements.
export async function billingSummary(db: D1DatabaseBinding, range: AdminRange): Promise<AdminBillingSummary> {
  const start = rangeStartDay(range);
  const [totals, plus, breakdown, checkout, exceptions] = await Promise.all([
    db.prepare(`SELECT
        COALESCE(SUM(CASE WHEN status = 'paid' AND date(updated_at) >= ?1 THEN amount_vnd END), 0) AS paid_amount,
        COUNT(CASE WHEN status = 'paid' AND date(updated_at) >= ?1 THEN 1 END) AS paid_count,
        COUNT(CASE WHEN status = 'pending' AND datetime(expires_at) > datetime('now') THEN 1 END) AS pending_count,
        COUNT(CASE WHEN status = 'failed' AND date(updated_at) >= ?1 THEN 1 END) AS failed_count
      FROM payment_intents`).bind(start).first<{ paid_amount: number; paid_count: number; pending_count: number; failed_count: number }>(),
    db.prepare(`SELECT COUNT(*) AS value FROM subscriptions WHERE ${PLUS_ACTIVE_SQL}`).first<{ value: number }>(),
    db.prepare(`SELECT ${EFFECTIVE_STATUS_SQL} AS status, COUNT(*) AS count, COALESCE(SUM(amount_vnd), 0) AS amount
      FROM payment_intents WHERE date(created_at) >= ? GROUP BY 1 ORDER BY 1`).bind(start).all<{ status: PaymentStatus; count: number; amount: number }>(),
    db.prepare(`SELECT state, COUNT(*) AS count FROM checkout_admissions GROUP BY state ORDER BY state`).all<{ state: 'dispatching' | 'ready' | 'remote_uncertain'; count: number }>(),
    db.prepare(`SELECT intent_id, reason, first_observed_at, last_observed_at FROM payment_reconciliation_records
      ORDER BY last_observed_at DESC, intent_id DESC LIMIT 20`).all<{ intent_id: string; reason: string; first_observed_at: string; last_observed_at: string }>(),
  ]);
  return {
    range,
    metrics: [
      { key: 'confirmed_total_vnd', label: 'Đã xác nhận', value: Number(totals?.paid_amount ?? 0), unit: 'vnd', status: 'partial', source: 'D1:payment_intents',
        definition: "Tổng amount_vnd có status = 'paid' trong khoảng thời gian.", note: 'Chưa đối soát với nhà cung cấp.' },
      { key: 'paid_count', label: 'Giao dịch thành công', value: Number(totals?.paid_count ?? 0), unit: 'count', status: 'ok', source: 'D1:payment_intents',
        definition: "Số payment_intents status = 'paid' trong khoảng thời gian." },
      { key: 'pending_count', label: 'Đang chờ', value: Number(totals?.pending_count ?? 0), unit: 'count', status: 'ok', source: 'D1:payment_intents',
        definition: "status = 'pending' và chưa quá expires_at (hiện tại)." },
      { key: 'failed_count', label: 'Thất bại', value: Number(totals?.failed_count ?? 0), unit: 'count', status: 'ok', source: 'D1:payment_intents',
        definition: "status = 'failed' trong khoảng thời gian." },
      { key: 'active_plus', label: 'Plus đang hoạt động', value: Number(plus?.value ?? 0), unit: 'count', status: 'ok', source: 'D1:subscriptions',
        definition: "plan = 'plus', status = 'active', chưa hết hạn." },
      { key: 'reconciliation_exceptions', label: 'Cần đối soát', value: exceptions.results.length, unit: 'count', status: 'ok', source: 'D1:payment_reconciliation_records',
        definition: 'Số bản ghi đối soát đang mở (tối đa 20 hiển thị).' },
    ],
    statusBreakdown: breakdown.results.map((row) => ({ status: row.status, count: Number(row.count), amountVnd: Number(row.amount) })),
    checkoutStates: checkout.results.map((row) => ({ state: row.state, count: Number(row.count) })),
    reconciliationExceptions: exceptions.results.map((row) => ({ intentId: row.intent_id, reason: row.reason, firstObservedAt: row.first_observed_at, lastObservedAt: row.last_observed_at })),
    series: [{ key: 'revenue', label: 'Doanh thu đã xác nhận theo ngày', unit: 'vnd', source: 'D1:payment_intents',
      points: await daily(db, `SELECT date(updated_at) AS day, SUM(amount_vnd) AS value FROM payment_intents WHERE status = 'paid' AND date(updated_at) >= ? GROUP BY 1`, start, range) }],
    providerReconciliation: { status: 'unavailable', note: 'Đối soát với nhà cung cấp thanh toán cần adapter trong tương lai; không truy cập API bên ngoài trong V1.' },
  };
}

export async function listTransactions(db: D1DatabaseBinding, query: { status?: PaymentStatus; page: number; pageSize: number }): Promise<AdminPage<AdminTransaction>> {
  const clause = query.status ? `WHERE ${EFFECTIVE_STATUS_SQL} = ?` : '';
  const binds = query.status ? [query.status] : [];
  const total = await db.prepare(`SELECT COUNT(*) AS total FROM payment_intents ${clause}`).bind(...binds).first<{ total: number }>();
  const rows = await db.prepare(`SELECT p.id, p.user_id, p.order_code, p.plan, p.amount_vnd, p.status, ${EFFECTIVE_STATUS_SQL} AS effective_status,
      p.created_at, p.updated_at, p.expires_at, EXISTS (SELECT 1 FROM payment_reconciliation_records r WHERE r.intent_id = p.id) AS has_record
    FROM payment_intents p ${clause} ORDER BY p.created_at DESC, p.id DESC LIMIT ? OFFSET ?`)
    .bind(...binds, query.pageSize, (query.page - 1) * query.pageSize)
    .all<{ id: string; user_id: string; order_code: string; plan: string; amount_vnd: number; status: PaymentStatus; effective_status: PaymentStatus;
      created_at: string; updated_at: string; expires_at: string; has_record: number }>();
  return {
    items: rows.results.map((row) => ({ id: row.id, userId: row.user_id, orderCodeMasked: maskOrderCode(row.order_code), plan: row.plan,
      amountVnd: Number(row.amount_vnd), status: row.status, effectiveStatus: row.effective_status, hasReconciliationRecord: row.has_record === 1,
      createdAt: row.created_at, updatedAt: row.updated_at, expiresAt: row.expires_at })),
    page: query.page, pageSize: query.pageSize, total: Number(total?.total ?? 0),
  };
}

export async function aiSummary(db: D1DatabaseBinding, range: AdminRange): Promise<AdminAiSummary> {
  const start = rangeStartDay(range);
  const [totals, byTask, byModel, scans, jobsRange, jobsAll, retries] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS requests, COUNT(CASE WHEN status <> 'success' THEN 1 END) AS errors, AVG(latency_ms) AS latency,
        COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens, COALESCE(SUM(estimated_cost), 0) AS cost
      FROM ai_requests WHERE date(created_at) >= ?`).bind(start).first<{ requests: number; errors: number; latency: number | null; tokens: number; cost: number }>(),
    db.prepare(`SELECT task, COUNT(*) AS requests, COUNT(CASE WHEN status <> 'success' THEN 1 END) AS errors, AVG(latency_ms) AS latency, COALESCE(SUM(estimated_cost), 0) AS cost
      FROM ai_requests WHERE date(created_at) >= ? GROUP BY task ORDER BY requests DESC, task LIMIT 50`).bind(start)
      .all<{ task: string; requests: number; errors: number; latency: number | null; cost: number }>(),
    db.prepare(`SELECT provider, model, COUNT(*) AS requests, SUM(input_tokens) AS input, SUM(output_tokens) AS output, COALESCE(SUM(estimated_cost), 0) AS cost
      FROM ai_requests WHERE date(created_at) >= ? GROUP BY provider, model ORDER BY requests DESC, provider, model LIMIT 50`).bind(start)
      .all<{ provider: string; model: string; requests: number; input: number; output: number; cost: number }>(),
    db.prepare(`SELECT status, COUNT(*) AS count FROM scans WHERE date(created_at) >= ? GROUP BY status ORDER BY status`).bind(start).all<{ status: string; count: number }>(),
    db.prepare(`SELECT status, COUNT(*) AS count FROM scan_queue_jobs WHERE date(created_at) >= ? GROUP BY status ORDER BY status`).bind(start).all<{ status: string; count: number }>(),
    db.prepare(`SELECT status, COUNT(*) AS count FROM scan_queue_jobs GROUP BY status ORDER BY status`).all<{ status: string; count: number }>(),
    db.prepare(`SELECT COUNT(CASE WHEN attempts > 1 THEN 1 END) AS retried, COUNT(CASE WHEN status = 'failed' AND attempts >= max_attempts THEN 1 END) AS exhausted
      FROM scan_queue_jobs WHERE date(created_at) >= ?`).bind(start).first<{ retried: number; exhausted: number }>(),
  ]);
  const requests = Number(totals?.requests ?? 0);
  const partial = { status: 'partial' as const, source: 'D1:ai_requests', note: AI_NOT_WIRED_NOTE };
  return {
    range,
    metrics: [
      { key: 'ai_requests', label: 'Yêu cầu AI', value: requests, unit: 'count', definition: 'Số dòng ai_requests trong khoảng thời gian.', ...partial },
      { key: 'ai_error_rate', label: 'Tỷ lệ lỗi', value: requests ? Math.round((Number(totals?.errors ?? 0) / requests) * 1000) / 10 : null, unit: 'percent',
        definition: "Tỷ lệ yêu cầu có status khác 'success'.", ...partial },
      { key: 'ai_avg_latency', label: 'Độ trễ trung bình', value: totals?.latency == null ? null : Math.round(totals.latency), unit: 'ms',
        definition: 'Trung bình latency_ms.', ...partial },
      { key: 'ai_tokens', label: 'Token', value: Number(totals?.tokens ?? 0), unit: 'tokens', definition: 'Tổng input_tokens + output_tokens.', ...partial },
      { key: 'ai_estimated_cost', label: 'Chi phí ước tính', value: Math.round(Number(totals?.cost ?? 0) * 10000) / 10000, unit: 'usd',
        definition: 'Tổng estimated_cost (ước tính theo đơn giá token, không phải hoá đơn nhà cung cấp).', ...partial },
      { key: 'ai_retries', label: 'Số lần thử lại AI', value: null, unit: 'count', status: 'unavailable', source: 'none',
        definition: 'Số lần thử lại gọi nhà cung cấp AI.', note: 'Không có nguồn dữ liệu bền vững cho số lần thử lại AI.' },
      { key: 'scan_job_retries', label: 'Tác vụ quét phải thử lại', value: Number(retries?.retried ?? 0), unit: 'count', status: 'ok', source: 'D1:scan_queue_jobs',
        definition: 'Tác vụ quét có attempts > 1 trong khoảng thời gian.' },
    ],
    byTask: byTask.results.map((row) => ({ task: row.task, requests: Number(row.requests), errors: Number(row.errors),
      avgLatencyMs: row.latency == null ? null : Math.round(row.latency), estimatedCostUsd: Math.round(Number(row.cost) * 10000) / 10000 })),
    byModel: byModel.results.map((row) => ({ provider: row.provider, model: row.model, requests: Number(row.requests), inputTokens: Number(row.input ?? 0),
      outputTokens: Number(row.output ?? 0), estimatedCostUsd: Math.round(Number(row.cost) * 10000) / 10000 })),
    ocr: {
      scansByStatus: scans.results.map((row) => ({ status: row.status, count: Number(row.count) })),
      jobsByStatus: jobsRange.results.map((row) => ({ status: row.status, count: Number(row.count) })),
      retriedJobs: Number(retries?.retried ?? 0),
      exhaustedJobs: Number(retries?.exhausted ?? 0),
    },
    queue: {
      localJobStatus: jobsAll.results.map((row) => ({ status: row.status, count: Number(row.count) })),
      remoteBacklog: { status: 'unavailable', note: 'Độ trễ/backlog của Cloudflare Queue cần adapter từ xa; không truy cập trong V1.' },
    },
    instrumentation: { aiRequestsWriter: 'not_wired', note: AI_NOT_WIRED_NOTE },
    series: [{ key: 'ai_requests', label: 'Yêu cầu AI theo ngày', unit: 'count', source: 'D1:ai_requests',
      points: await daily(db, `SELECT date(created_at) AS day, COUNT(*) AS value FROM ai_requests WHERE date(created_at) >= ? GROUP BY 1`, start, range) }],
  };
}

export async function listAiUsage(db: D1DatabaseBinding, query: { task?: string; status?: string; page: number; pageSize: number }): Promise<AdminPage<AdminAiUsageRow>> {
  const where: string[] = [];
  const binds: unknown[] = [];
  if (query.task) { where.push('task = ?'); binds.push(query.task); }
  if (query.status) { where.push('status = ?'); binds.push(query.status); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = await db.prepare(`SELECT COUNT(*) AS total FROM ai_requests ${clause}`).bind(...binds).first<{ total: number }>();
  const rows = await db.prepare(`SELECT id, task, provider, model, input_tokens, output_tokens, latency_ms, estimated_cost, status, created_at
      FROM ai_requests ${clause} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .bind(...binds, query.pageSize, (query.page - 1) * query.pageSize)
    .all<{ id: string; task: string; provider: string; model: string; input_tokens: number; output_tokens: number; latency_ms: number; estimated_cost: number; status: string; created_at: string }>();
  return {
    items: rows.results.map((row) => ({ id: row.id, task: row.task, provider: row.provider, model: row.model, inputTokens: Number(row.input_tokens),
      outputTokens: Number(row.output_tokens), latencyMs: Number(row.latency_ms), estimatedCostUsd: Number(row.estimated_cost), status: row.status, createdAt: row.created_at })),
    page: query.page, pageSize: query.pageSize, total: Number(total?.total ?? 0),
  };
}
