import type { Context } from 'hono';
import { sha256Hex } from '../../utils/session';
import type { AdminEnv } from './env';
import type { AdminPolicy } from './policy';

export type LimitResult = { ok: true } | { ok: false; status: 429 | 503; retryAfter: number };

// Development/test fallback only; deployed environments fail closed without KV.
const memoryCounters = new Map<string, { count: number; resetAt: number }>();

/**
 * Fixed-window counter keyed by a hashed identity. KV is shared across isolates
 * but not atomic, so this is abuse control, not an exact quota.
 */
export async function consumeLimit(env: AdminEnv, local: boolean, name: string, identity: string, max: number, windowSeconds: number): Promise<LimitResult> {
  const key = `adm:${name}:${(await sha256Hex(`${name}:${identity}`)).slice(0, 40)}`;
  const now = Math.floor(Date.now() / 1000);
  if (env.CACHE) {
    try {
      const record = await env.CACHE.get<{ count: number; resetAt: number }>(key, 'json');
      if (record && record.resetAt > now) {
        if (record.count >= max) return { ok: false, status: 429, retryAfter: record.resetAt - now };
        await env.CACHE.put(key, JSON.stringify({ count: record.count + 1, resetAt: record.resetAt }), { expirationTtl: Math.max(60, record.resetAt - now) });
      } else {
        await env.CACHE.put(key, JSON.stringify({ count: 1, resetAt: now + windowSeconds }), { expirationTtl: Math.max(60, windowSeconds) });
      }
      return { ok: true };
    } catch {
      if (!local) return { ok: false, status: 503, retryAfter: 30 };
    }
  } else if (!local) {
    return { ok: false, status: 503, retryAfter: 30 };
  }
  const record = memoryCounters.get(key);
  if (record && record.resetAt > now) {
    if (record.count >= max) return { ok: false, status: 429, retryAfter: record.resetAt - now };
    record.count += 1;
  } else {
    memoryCounters.set(key, { count: 1, resetAt: now + windowSeconds });
  }
  if (memoryCounters.size > 5000) {
    for (const [k, v] of memoryCounters) if (v.resetAt <= now) memoryCounters.delete(k);
  }
  return { ok: true };
}

/**
 * Client address from Cloudflare's CF-Connecting-IP only. Spoofable forwarding
 * headers are ignored; without the header every caller shares one bucket.
 */
export function clientIdentity(c: Context, policy: AdminPolicy): string {
  const ip = c.req.header('CF-Connecting-IP');
  if (ip && /^[0-9A-Fa-f:.]{2,45}$/.test(ip)) return ip;
  return policy.local ? 'local' : 'unknown-ingress';
}

export function limitResponse(c: Context, result: Extract<LimitResult, { ok: false }>): Response {
  c.header('Retry-After', String(result.retryAfter));
  return result.status === 429
    ? c.json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.', code: 'RATE_LIMIT_EXCEEDED' }, 429)
    : c.json({ error: 'Dịch vụ giới hạn yêu cầu tạm thời không khả dụng.', code: 'RATE_LIMIT_UNAVAILABLE' }, 503);
}
