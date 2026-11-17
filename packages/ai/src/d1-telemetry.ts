import type { AIUsageLog } from './schemas';

export const AI_REQUEST_LIVE_PREFIX = 'air_';

export interface TelemetryD1PreparedStatement {
  bind(...values: unknown[]): {
    run(): Promise<unknown>;
  };
}

export interface TelemetryD1Database {
  prepare(query: string): TelemetryD1PreparedStatement;
}

export interface AiRequestTelemetryInput {
  id?: string;
  userId?: string | null;
  /** Primary D1 column name (`task`). */
  task?: string;
  /** Alias accepted for ergonomic V4 callers (`taskType` -> `task`). */
  taskType?: string;
  /** Alias accepted for feature-level callers (`feature` -> `task`). */
  feature?: string;
  provider: string;
  model: string;
  inputTokens?: number;
  promptTokens?: number;
  outputTokens?: number;
  completionTokens?: number;
  latencyMs: number;
  estimatedCost?: number;
  estimatedCostUsd?: number;
  status: 'success' | 'fallback' | 'error' | 'blocked';
  createdAt?: string;
}

export interface AiRequestTelemetryOptions {
  waitUntil?: (promise: Promise<unknown>) => void;
}

export interface AiRequestTelemetryResult {
  id: string;
  recorded: boolean;
}

function generateTelemetryId(): string {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${AI_REQUEST_LIVE_PREFIX}${Date.now().toString(36)}_${randomPart}`;
}

function safeNonNegativeInt(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num);
}

function safeNonNegativeCost(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num * 1_000_000) / 1_000_000;
}

function normalizeStatus(status: AiRequestTelemetryInput['status']): string {
  if (status === 'success' || status === 'fallback' || status === 'error') return status;
  if (status === 'blocked') return 'error';
  return 'success';
}

const INSERT_AI_REQUEST_SQL = `INSERT OR IGNORE INTO ai_requests (
  id, user_id, task, provider, model, input_tokens, output_tokens, latency_ms, estimated_cost, status, created_at
) VALUES (
  ?,
  CASE WHEN ? IS NOT NULL AND EXISTS (SELECT 1 FROM users WHERE id = ?) THEN ? ELSE NULL END,
  ?, ?, ?, ?, ?, ?, ?, ?, ?
)`;

/**
 * Fail-safe persistence helper for `D1:ai_requests` (schema 0001).
 * Never throws: any D1 runtime error is swallowed so observability cannot
 * degrade customer cooking, substitution, or scan requests.
 */
export async function recordAiRequestTelemetry(
  db: TelemetryD1Database | null | undefined,
  record: AiRequestTelemetryInput,
  options: AiRequestTelemetryOptions = {},
): Promise<AiRequestTelemetryResult> {
  const id = record.id?.trim() && !record.id.startsWith('fx_ai_')
    ? record.id.trim()
    : generateTelemetryId();

  if (!db || typeof db.prepare !== 'function') {
    return { id, recorded: false };
  }

  const userId = record.userId?.trim() || null;
  const task = (record.task || record.taskType || record.feature || 'unknown_ai_task').trim().slice(0, 120);
  const provider = (record.provider || 'unknown').trim().slice(0, 80);
  const model = (record.model || 'unknown').trim().slice(0, 120);
  const inputTokens = safeNonNegativeInt(record.inputTokens ?? record.promptTokens ?? 0);
  const outputTokens = safeNonNegativeInt(record.outputTokens ?? record.completionTokens ?? 0);
  const latencyMs = safeNonNegativeInt(record.latencyMs);
  const estimatedCost = safeNonNegativeCost(record.estimatedCostUsd ?? record.estimatedCost ?? 0);
  const status = normalizeStatus(record.status);
  const createdAt = record.createdAt?.trim() || new Date().toISOString();

  const writePromise = Promise.resolve()
    .then(() =>
      db
        .prepare(INSERT_AI_REQUEST_SQL)
        .bind(
          id,
          userId,
          userId,
          userId,
          task,
          provider,
          model,
          inputTokens,
          outputTokens,
          latencyMs,
          estimatedCost,
          status,
          createdAt,
        )
        .run(),
    )
    .then(() => true)
    .catch(() => false);

  if (options.waitUntil) {
    try {
      options.waitUntil(writePromise);
    } catch {
      // Ignore host scheduler errors in non-Worker test harnesses.
    }
    return { id, recorded: true };
  }

  const recorded = await writePromise;
  return { id, recorded };
}

export function telemetryRecordFromUsageLog(
  log: AIUsageLog,
  userId?: string | null,
): AiRequestTelemetryInput {
  return {
    userId: userId ?? log.userId ?? null,
    task: log.task,
    provider: log.provider,
    model: log.physicalModel || log.model,
    inputTokens: log.inputTokens,
    outputTokens: log.outputTokens,
    latencyMs: log.latencyMs,
    estimatedCostUsd: log.estimatedCostUsd ?? log.estimatedCost,
    status: log.status,
    createdAt: log.createdAt,
  };
}
