import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { AuthContext, Env } from '../types';
import { sha256Hex } from '../utils/session';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

export type IdempotencyContext = Context<{
  Bindings: Env;
  Variables: { auth: AuthContext; householdRole?: string };
}>;

interface StoredIdempotencyRow {
  request_sha256: string;
  status_code: number;
  response_json: string;
}

/**
 * Durable D1-backed HTTP idempotency wrapper (`0049_takolio_v6_culinary_os_and_backend_power.sql`).
 *
 * - When `Idempotency-Key` is omitted, executes `handler()` transparently.
 * - When `Idempotency-Key` (`1..128` chars) matches an unexpired receipt with the same
 *   `request_sha256`, replays the stored status + JSON with `X-Idempotency-Replayed: true`.
 * - When `Idempotency-Key` is reused with a different request payload, fails closed with `409`
 *   `IDEMPOTENCY_PAYLOAD_MISMATCH`.
 * - On fresh `2xx` completion, persists the receipt for 24h and sets `X-Idempotency-Replayed: false`.
 */
export async function withDurableIdempotency(
  c: IdempotencyContext,
  routeKey: string,
  rawBodyText: string,
  handler: () => Promise<Response>,
): Promise<Response> {
  const rawHeader = c.req.header('Idempotency-Key');
  if (rawHeader === undefined) {
    return handler();
  }

  const idempotencyKey = rawHeader.trim();
  if (idempotencyKey.length < 1 || idempotencyKey.length > 128) {
    return c.json(
      {
        error: 'Idempotency-Key phải dài từ 1 đến 128 ký tự',
        code: 'VALIDATION_ERROR',
      },
      400,
    );
  }

  const auth = c.get('auth');
  if (!auth?.householdId || !auth?.userId) {
    return c.json({ error: 'Unauthorized: Authentication required', code: 'UNAUTHORIZED' }, 401);
  }

  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database service unavailable', code: 'DATABASE_UNAVAILABLE' }, 503);
  }

  const [keyHash, requestSha256] = await Promise.all([
    sha256Hex(`${auth.householdId}:${auth.userId}:${routeKey}:${idempotencyKey}`),
    sha256Hex(rawBodyText),
  ]);

  const existing = await db
    .prepare(
      `SELECT request_sha256, status_code, response_json
         FROM d1_idempotency_keys
        WHERE key_hash = ? AND datetime(expires_at) > datetime('now')
        LIMIT 1`,
    )
    .bind(keyHash)
    .first<StoredIdempotencyRow>();

  if (existing) {
    if (existing.request_sha256 !== requestSha256) {
      return c.json(
        {
          error: 'Idempotency-Key đã được dùng cho nội dung yêu cầu khác',
          code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
        },
        409,
      );
    }
    c.header('X-Idempotency-Replayed', 'true');
    let parsedBody: unknown = {};
    try {
      parsedBody = JSON.parse(existing.response_json);
    } catch {
      parsedBody = {};
    }
    return c.json(parsedBody, existing.status_code as ContentfulStatusCode);
  }

  const response = await handler();
  if (response.status < 200 || response.status >= 300) {
    return response;
  }

  const responseJson = await response.clone().text();
  const nowMs = Date.now();
  const createdAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + IDEMPOTENCY_TTL_MS).toISOString();

  const insertResult = await db
    .prepare(
      `INSERT INTO d1_idempotency_keys
         (key_hash, household_id, actor_id, route_key, request_sha256, status_code, response_json, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(key_hash) DO UPDATE SET
         household_id = excluded.household_id,
         actor_id = excluded.actor_id,
         route_key = excluded.route_key,
         request_sha256 = excluded.request_sha256,
         status_code = excluded.status_code,
         response_json = excluded.response_json,
         created_at = excluded.created_at,
         expires_at = excluded.expires_at
       WHERE datetime(d1_idempotency_keys.expires_at) <= datetime('now')`,
    )
    .bind(
      keyHash,
      auth.householdId,
      auth.userId,
      routeKey,
      requestSha256,
      response.status,
      responseJson,
      createdAt,
      expiresAt,
    )
    .run();

  if (insertResult.meta?.changes === 0) {
    const raced = await db
      .prepare(
        `SELECT request_sha256, status_code, response_json
           FROM d1_idempotency_keys
          WHERE key_hash = ? AND datetime(expires_at) > datetime('now')
          LIMIT 1`,
      )
      .bind(keyHash)
      .first<StoredIdempotencyRow>();
    if (raced) {
      if (raced.request_sha256 !== requestSha256) {
        return c.json(
          {
            error: 'Idempotency-Key đã được dùng cho nội dung yêu cầu khác',
            code: 'IDEMPOTENCY_PAYLOAD_MISMATCH',
          },
          409,
        );
      }
      c.header('X-Idempotency-Replayed', 'true');
      let parsedBody: unknown = {};
      try {
        parsedBody = JSON.parse(raced.response_json);
      } catch {
        parsedBody = {};
      }
      return c.json(parsedBody, raced.status_code as ContentfulStatusCode);
    }
  }

  c.header('X-Idempotency-Replayed', 'false');
  const headers = new Headers(response.headers);
  headers.set('X-Idempotency-Replayed', 'false');
  return new Response(responseJson, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
