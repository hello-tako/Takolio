import { Context, Next } from 'hono';
import { Env, AuthContext } from '../types';

/**
 * Rate limiting with explicit failure semantics.
 *
 * Classification:
 * - `best-effort` (default): when KV is unavailable the limiter falls back to
 *   isolate-local counters and SAYS SO via the X-RateLimit-Mode response
 *   header plus a one-time warning log. Isolate-local counters are NOT
 *   globally atomic — Cloudflare runs many isolates per worker — so this is
 *   abuse control, not reliable enforcement.
 * - `fail-closed`: in production a primary-limiter (KV) failure rejects the
 *   request with 503 RATE_LIMIT_UNAVAILABLE instead of silently downgrading.
 *   Intended for security-critical routes (auth/OTP). Neither mode should be
 *   trusted for quota/financial enforcement.
 *
 * The operator can switch production-wide behavior with the
 * RATE_LIMIT_ENFORCEMENT var; per-call `enforcement` overrides the default.
 */

export type RateLimitEnforcement = 'best-effort' | 'fail-closed';

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  prefix?: string;
  enforcement?: RateLimitEnforcement;
  scope?: 'path' | 'account';
}

// In-memory fallback sliding window for dev / when KV is not bound
const memoryCounters = new Map<string, { count: number; resetTime: number }>();

// One warning per limiter prefix + failure reason per isolate, not per request.
const degradedWarned = new Set<string>();

type AppContext = Context<{ Bindings: Env; Variables: { auth: AuthContext } }>;

function memoryLimiter(
  c: AppContext,
  key: string,
  maxRequests: number,
  windowSeconds: number,
  now: number
): Response | null {
  const memRecord = memoryCounters.get(key);
  if (memRecord && memRecord.resetTime > now) {
    if (memRecord.count >= maxRequests) {
      const retryAfter = memRecord.resetTime - now;
      c.header('Retry-After', String(retryAfter));
      return c.json(
        {
          error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau giây lát.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfterSeconds: retryAfter,
        },
        429
      );
    }
    memRecord.count += 1;
  } else {
    memoryCounters.set(key, { count: 1, resetTime: now + windowSeconds });
  }

  // Periodic cleanup of stale memory records
  if (memoryCounters.size > 1000) {
    for (const [k, v] of memoryCounters.entries()) {
      if (v.resetTime <= now) memoryCounters.delete(k);
    }
  }
  return null;
}

function rejectUnavailable(c: AppContext, retryAfterSeconds: number) {
  c.header('Retry-After', String(retryAfterSeconds));
  return c.json(
    {
      error: 'Dịch vụ giới hạn yêu cầu tạm thời không khả dụng. Vui lòng thử lại sau.',
      code: 'RATE_LIMIT_UNAVAILABLE',
      retryAfterSeconds,
    },
    503
  );
}

function warnDegradedOnce(prefix: string, reason: string) {
  const marker = `${prefix}:${reason}`;
  if (degradedWarned.has(marker)) return;
  degradedWarned.add(marker);
  console.warn(
    JSON.stringify({
      level: 'warn',
      limiter: prefix,
      reason,
      message: 'Rate limiter degraded to isolate-local counters; enforcement is not globally reliable.',
    })
  );
}

export function rateLimiter(config: RateLimitConfig) {
  const { maxRequests, windowSeconds, prefix = 'rl' } = config;

  return async (c: AppContext, next: Next) => {
    // Prefer the authenticated user id (set by authMiddleware, which runs
    // before route-level limiters) so limits are per-account, not per-IP —
    // users behind shared NAT/office IPs don't starve each other.
    const auth = c.get('auth') as { userId?: string } | undefined;
    const ip =
      auth?.userId ||
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-real-ip') ||
      c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
      'anonymous_client';

    const path = c.req.path;
    const key = config.scope === 'account' ? `${prefix}:${ip}` : `${prefix}:${ip}:${path}`;
    const now = Math.floor(Date.now() / 1000);

    const isProduction = (c.env.ENVIRONMENT || 'development') === 'production';
    const enforcement: RateLimitEnforcement =
      config.enforcement ??
      (c.env.RATE_LIMIT_ENFORCEMENT === 'fail-closed' ? 'fail-closed' : 'best-effort');

    // KV shares counters across isolates but read/put is not an atomic reservation.
    const kv = c.env.CACHE;
    if (kv) {
      try {
        const record = await kv.get<{ count: number; resetTime: number }>(key, 'json');
        if (record && record.resetTime > now) {
          if (record.count >= maxRequests) {
            const retryAfter = record.resetTime - now;
            c.header('Retry-After', String(retryAfter));
            return c.json(
              {
                error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau giây lát.',
                code: 'RATE_LIMIT_EXCEEDED',
                retryAfterSeconds: retryAfter,
              },
              429
            );
          }
          await kv.put(
            key,
            JSON.stringify({ count: record.count + 1, resetTime: record.resetTime }),
            { expirationTtl: Math.max(60, record.resetTime - now) }
          );
        } else {
          await kv.put(
            key,
            JSON.stringify({ count: 1, resetTime: now + windowSeconds }),
            { expirationTtl: Math.max(60, windowSeconds) }
          );
        }
        return await next();
      } catch {
        // Primary limiter failed; behavior depends on enforcement below.
      }
    }

    const degradeReason = kv ? 'kv-error' : 'kv-unbound';
    if (enforcement === 'fail-closed' && isProduction) {
      console.warn(
        JSON.stringify({ level: 'warn', limiter: prefix, reason: degradeReason, message: 'Rate limiter failed closed in production.' })
      );
      return rejectUnavailable(c, 30);
    }

    c.header('X-RateLimit-Mode', 'degraded-isolate-local');
    warnDegradedOnce(prefix, degradeReason);

    // 2. Isolate-local sliding window fallback (explicitly degraded).
    const degradedResponse = memoryLimiter(c, key, maxRequests, windowSeconds, now);
    if (degradedResponse) return degradedResponse;

    await next();
  };
}
