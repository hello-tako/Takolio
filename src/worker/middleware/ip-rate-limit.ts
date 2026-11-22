import { Context, Next } from 'hono';
import { Env, AuthContext } from '../types';

interface IpRateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  prefix: string;
}

const memoryIpCounters = new Map<string, { count: number; resetTime: number }>();

type AppContext = Context<{ Bindings: Env; Variables: { auth: AuthContext } }>;

/**
 * IP-bound rate limiter for abuse-sensitive endpoints (e.g. paid Vision/OCR scans).
 * In production, trusts only Cloudflare's authoritative `cf-connecting-ip` header
 * so rotating guest sessions or spoofing `X-Forwarded-For` / `X-Real-IP` cannot evade limits.
 */
export function ipRateLimiter(config: IpRateLimitConfig) {
  const { maxRequests, windowSeconds, prefix } = config;

  return async (c: AppContext, next: Next) => {
    const isProduction = (c.env.ENVIRONMENT || 'development') === 'production';
    const ip = isProduction
      ? c.req.header('cf-connecting-ip') || 'anonymous_client'
      : c.req.header('cf-connecting-ip') ||
        c.req.header('x-real-ip') ||
        c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
        'anonymous_client';

    const key = `${prefix}:${ip}:${c.req.path}`;
    const now = Math.floor(Date.now() / 1000);
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
              429,
            );
          }
          await kv.put(
            key,
            JSON.stringify({ count: record.count + 1, resetTime: record.resetTime }),
            { expirationTtl: Math.max(60, record.resetTime - now) },
          );
        } else {
          await kv.put(
            key,
            JSON.stringify({ count: 1, resetTime: now + windowSeconds }),
            { expirationTtl: Math.max(60, windowSeconds) },
          );
        }
        return await next();
      } catch {
        // Fall back to isolate-local counters below if KV read/write fails.
      }
    }

    const mem = memoryIpCounters.get(key);
    if (mem && mem.resetTime > now) {
      if (mem.count >= maxRequests) {
        const retryAfter = mem.resetTime - now;
        c.header('Retry-After', String(retryAfter));
        return c.json(
          {
            error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau giây lát.',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfterSeconds: retryAfter,
          },
          429,
        );
      }
      mem.count += 1;
    } else {
      memoryIpCounters.set(key, { count: 1, resetTime: now + windowSeconds });
    }
    if (memoryIpCounters.size > 1000) {
      for (const [k, v] of memoryIpCounters.entries()) {
        if (v.resetTime <= now) memoryIpCounters.delete(k);
      }
    }
    return await next();
  };
}
